import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { parseInboundEmail, type InboundEmail } from '@/lib/email-ingest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * POST /api/correspondence/inbound  — inbound-email webhook (SendGrid/Mailgun/
 * Postmark "inbound parse"). Parses the message, resolves the project, and
 * files it into the correspondence log as an inbound Email Record.
 *
 * Optional shared-secret guard via INBOUND_EMAIL_SECRET (?secret= or header).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.INBOUND_EMAIL_SECRET;
  if (secret) {
    const got = new URL(req.url).searchParams.get('secret') || req.headers.get('x-inbound-secret');
    if (got !== secret) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let email: InboundEmail;
  const ct = req.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    email = await req.json();
  } else {
    const form = await req.formData();
    email = {
      from: String(form.get('from') || ''),
      to: String(form.get('to') || ''),
      cc: String(form.get('cc') || ''),
      subject: String(form.get('subject') || ''),
      text: String(form.get('text') || ''),
      html: String(form.get('html') || ''),
    };
  }

  const parsed = parseInboundEmail(email);
  const db = createServerClient() as any;

  // Resolve project: plus-addressed UUID first, else reference_number lookup.
  let projectId: string | null = null;
  let tenantId: string | null = null;
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (parsed.project_id && uuidRe.test(parsed.project_id)) {
    const { data } = await db.from('projects').select('id, tenant_id').eq('id', parsed.project_id).maybeSingle();
    if (data) { projectId = data.id; tenantId = data.tenant_id; }
  }
  if (!projectId && parsed.reference_number) {
    const { data } = await db.from('correspondence').select('project_id, tenant_id').eq('reference_number', parsed.reference_number).limit(1).maybeSingle();
    if (data) { projectId = data.project_id; tenantId = data.tenant_id; }
  }
  if (!projectId || !tenantId) {
    return NextResponse.json({ error: 'Could not resolve project from email', parsed: { ref: parsed.reference_number, plus: parsed.project_id } }, { status: 422 });
  }

  const { data, error } = await db.from('correspondence').insert({
    tenant_id: tenantId,
    project_id: projectId,
    subject: parsed.subject,
    body: parsed.body,
    correspondence_type: parsed.correspondence_type,
    direction: parsed.direction,
    status: parsed.status,
    priority: 'Normal',
    from_email: parsed.from_email,
    from_name: parsed.from_name,
    to_names: parsed.to_names,
    cc_names: parsed.cc_names,
    reference_number: parsed.reference_number,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ filed: true, correspondence_id: data.id, project_id: projectId });
}
