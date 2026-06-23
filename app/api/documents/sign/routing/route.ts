import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createServerClient, getUser } from '@/lib/supabase-server';

export const runtime = 'nodejs';
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Multi-party e-signature routing with an audit trail.
 *
 * POST  → create an ordered routing: one document_signatures row per signer,
 *         signer #1 'pending', the rest 'queued'; logs a document_audit event.
 * GET ?routingId= → the routing's signers (in order) + the full audit trail.
 *
 * Sequential routing means signer N+1 only becomes active once signer N signs
 * (see ./advance). This is the DocuSign-style flow Procore charges extra for.
 */

async function audit(db: any, documentId: string, tenantId: string, userId: string, userName: string, action: string, details: Record<string, unknown>) {
  try {
    await db.from('document_audit').insert({ document_id: documentId, tenant_id: String(tenantId), user_id: String(userId), user_name: userName, action, details });
  } catch { /* audit is best-effort */ }
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let b: { documentId?: string; docTitle?: string; docType?: string; pdfUrl?: string; projectId?: string;
    signers?: { name: string; email: string; role?: string; company?: string; order?: number }[] };
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  const signers = (b.signers || []).filter((s) => s && s.name);
  if (signers.length === 0) return NextResponse.json({ error: 'At least one signer required' }, { status: 400 });

  const ordered = signers
    .map((s, i) => ({ ...s, order: s.order ?? i + 1 }))
    .sort((x, y) => x.order - y.order);

  const routingId = randomUUID();
  const db = createServerClient() as any;

  try {
    // document_signatures.document_id has an FK to documents — ensure a real row.
    let documentId = b.documentId && /^[0-9a-f-]{36}$/i.test(b.documentId) ? b.documentId : '';
    if (!documentId) {
      const { data: docRow, error: docErr } = await db.from('documents')
        .insert({ user_id: user.id, tenant_id: user.tenantId, title: b.docTitle || 'Document for signature' })
        .select('id').single();
      if (docErr || !docRow) throw docErr || new Error('document create failed');
      documentId = (docRow as { id: string }).id;
    }

    const rows = ordered.map((s, i) => ({
      tenant_id: user.tenantId,
      document_id: documentId,
      project_id: b.projectId && /^[0-9a-f-]{36}$/i.test(b.projectId) ? b.projectId : null,
      doc_type: b.docType || 'document',
      doc_title: b.docTitle || 'Document',
      pdf_url: b.pdfUrl || null,
      status: i === 0 ? 'pending' : 'queued',
      signer_name: s.name,
      signer_email: s.email || '',
      signer_company: s.company || null,
      signer_role: s.role || null,
      signing_order: s.order,
      routing_id: routingId,
      request_id: routingId,
      created_by: user.id,
      sent_by: user.id,
      sent_at: i === 0 ? new Date().toISOString() : null,
    }));

    const { data, error } = await db.from('document_signatures').insert(rows).select();
    if (error) throw error;

    await audit(db, documentId, user.tenantId, user.id, user.email || 'user', 'routing_created', {
      routing_id: routingId, signer_count: ordered.length, signers: ordered.map((s) => ({ name: s.name, order: s.order })),
    });
    await audit(db, documentId, user.tenantId, user.id, user.email || 'user', 'sent_to_signer', {
      routing_id: routingId, order: ordered[0].order, signer: ordered[0].name,
    });

    return NextResponse.json({ routingId, documentId, signers: data });
  } catch (err) {
    console.error('[sign/routing] POST', err);
    return NextResponse.json({ error: 'Could not create routing' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const routingId = new URL(req.url).searchParams.get('routingId');
  if (!routingId) return NextResponse.json({ error: 'routingId required' }, { status: 400 });

  try {
    const db = createServerClient() as any;
    const { data: signers, error } = await db
      .from('document_signatures')
      .select('*')
      .eq('tenant_id', user.tenantId)
      .eq('routing_id', routingId)
      .order('signing_order', { ascending: true });
    if (error) throw error;

    const documentId = signers?.[0]?.document_id;
    let auditTrail: unknown[] = [];
    if (documentId) {
      const { data: a } = await db.from('document_audit').select('action, user_name, details, created_at')
        .eq('document_id', documentId).order('created_at', { ascending: true });
      auditTrail = a || [];
    }

    const total = signers?.length || 0;
    const signed = (signers || []).filter((s: Record<string, unknown>) => s.status === 'signed' || s.status === 'completed').length;
    return NextResponse.json({ routingId, signers: signers || [], auditTrail, progress: { signed, total, complete: total > 0 && signed === total } });
  } catch (err) {
    console.error('[sign/routing] GET', err);
    return NextResponse.json({ error: 'Could not load routing' }, { status: 500 });
  }
}
