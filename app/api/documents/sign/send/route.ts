import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { requirePermission } from '@/lib/permissions';
import crypto from 'crypto';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const g = await requirePermission(req, 'Documents', 'Edit');
  if (!g.ok) return g.res;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const db = createServerClient();

  // ─── Resend flow ───────────────────────────────────────────────────
  if (body.resend_signature_id) {
    // Tenant-scope the lookup — service-role bypasses RLS, so matching by
    // signature_id alone would let one tenant mint a fresh signing token for
    // ANOTHER tenant's document (cross-tenant IDOR + token forgery).
    const { data: existing } = await db
      .from('document_signature_requests')
      .select('id, signature_id')
      .eq('signature_id', body.resend_signature_id)
      .eq('tenant_id', user.tenantId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Signature request not found' }, { status: 404 });
    }

    const newToken = crypto.randomUUID();
    await db
      .from('document_signature_requests')
      .update({
        token: newToken,
        status: 'pending',
        sent_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .eq('tenant_id', user.tenantId);

    await db
      .from('document_signatures')
      .update({ status: 'pending' })
      .eq('id', body.resend_signature_id)
      .eq('tenant_id', user.tenantId);

    return NextResponse.json({ success: true, resent: true });
  }

  // ─── Normal send flow ──────────────────────────────────────────────
  const {
    project_id,
    doc_type,
    doc_title,
    pdf_url,
    signers,
    message,
  } = body as {
    project_id: string;
    doc_type: string;
    doc_title: string;
    pdf_url: string;
    signers: { name: string; email: string; company: string; role: string }[];
    message?: string;
  };

  if (!project_id || !doc_type || !doc_title || !pdf_url || !signers?.length) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const created: any[] = [];

  for (const signer of signers) {
    // 1. Insert document_signatures
    const { data: sig, error: sigErr } = await db
      .from('document_signatures')
      .insert({
        project_id,
        tenant_id: user.tenantId,
        doc_type,
        doc_title,
        pdf_url,
        signer_name: signer.name,
        signer_email: signer.email,
        signer_company: signer.company || null,
        signer_role: signer.role || null,
        status: 'pending',
        sent_at: new Date().toISOString(),
        sent_by: user.id,
      })
      .select()
      .single();

    if (sigErr) {
      return NextResponse.json({ error: sigErr.message }, { status: 500 });
    }

    // 2. Insert document_signature_requests
    const token = crypto.randomUUID();
    const { error: reqErr } = await db
      .from('document_signature_requests')
      .insert({
        tenant_id: user.tenantId,
        signature_id: sig.id,
        token,
        status: 'pending',
        message: message || null,
        field_placements: [],
        sent_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      });

    if (reqErr) {
      return NextResponse.json({ error: reqErr.message }, { status: 500 });
    }

    created.push({ ...sig, token });
  }

  return NextResponse.json({ success: true, signatures: created });
}
