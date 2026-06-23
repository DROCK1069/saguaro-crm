import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export const runtime = 'nodejs';
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * POST /api/documents/sign/routing/advance
 * Body: { signatureId, signatureUrl?, signedPdfUrl? }
 *
 * Records a signer's signature (with IP / user-agent for the audit trail),
 * then activates the next queued signer in the routing — or marks the routing
 * complete when everyone has signed. Every step is logged to document_audit.
 */
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let b: { signatureId?: string; signatureUrl?: string; signedPdfUrl?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  if (!b.signatureId) return NextResponse.json({ error: 'signatureId required' }, { status: 400 });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  const ua = req.headers.get('user-agent') || null;

  try {
    const db = createServerClient() as any;

    const { data: sig, error: sigErr } = await db.from('document_signatures')
      .select('*').eq('id', b.signatureId).eq('tenant_id', user.tenantId).single();
    if (sigErr || !sig) return NextResponse.json({ error: 'Signature not found' }, { status: 404 });

    const s = sig as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

    // 1) record this signer's signature
    await db.from('document_signatures').update({
      status: 'signed', signed_at: new Date().toISOString(),
      signature_url: b.signatureUrl || s.signature_url, signed_pdf_url: b.signedPdfUrl || s.signed_pdf_url,
      ip_address: ip, signer_ip: ip, user_agent: ua, updated_at: new Date().toISOString(),
    }).eq('id', s.id);

    await db.from('document_audit').insert({
      document_id: s.document_id, tenant_id: String(user.tenantId), user_id: String(user.id),
      user_name: s.signer_name || user.email || 'signer', action: 'signed',
      details: { routing_id: s.routing_id, order: s.signing_order, ip },
    });

    // 2) activate the next queued signer
    const { data: next } = await db.from('document_signatures')
      .select('*').eq('tenant_id', user.tenantId).eq('routing_id', s.routing_id)
      .eq('status', 'queued').gt('signing_order', s.signing_order)
      .order('signing_order', { ascending: true }).limit(1);
    const nextSigner = next?.[0] as Record<string, any> | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any

    if (nextSigner) {
      await db.from('document_signatures').update({ status: 'pending', sent_at: new Date().toISOString() }).eq('id', nextSigner.id);
      await db.from('document_audit').insert({
        document_id: s.document_id, tenant_id: String(user.tenantId), user_id: String(user.id),
        user_name: nextSigner.signer_name || 'signer', action: 'sent_to_signer',
        details: { routing_id: s.routing_id, order: nextSigner.signing_order, signer: nextSigner.signer_name },
      });
      return NextResponse.json({ advanced: true, complete: false, nextSigner: { id: nextSigner.id, name: nextSigner.signer_name, order: nextSigner.signing_order } });
    }

    // 3) no next signer — routing complete
    await db.from('document_audit').insert({
      document_id: s.document_id, tenant_id: String(user.tenantId), user_id: String(user.id),
      user_name: user.email || 'user', action: 'completed', details: { routing_id: s.routing_id },
    });
    return NextResponse.json({ advanced: true, complete: true, nextSigner: null });
  } catch (err) {
    console.error('[sign/routing/advance]', err);
    return NextResponse.json({ error: 'Advance failed' }, { status: 500 });
  }
}
