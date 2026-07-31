import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { requirePermission } from '@/lib/permissions';
import type { Database } from '@/lib/database.types';

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('correspondence')
      .select('*')
      .eq('project_id', params.projectId)
      .eq('tenant_id', user.tenantId)
      .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ items: [] });
    return NextResponse.json({ items: data || [] });
  } catch {
    return NextResponse.json({ items: [] });
  }
}

export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  const g = await requirePermission(req, 'Projects', 'Edit');
  if (!g.ok) return g.res;
  const user = g.user;
  try {
    const body = await req.json();
    const supabase = createServerClient();
    // correspondence real columns map: type->correspondence_type, to->to_names(jsonb),
    // cc->cc_names(jsonb). The field page also sends priority/request_read_receipt/
    // reference_links/direction which have no column and no appropriate jsonb bucket
    // (to_names/cc_names/attachments are typed), so they are dropped to avoid a 500.
    const record: Record<string, unknown> = {
      project_id: params.projectId,
      tenant_id: user.tenantId,
      subject: body.subject ?? null,
      body: body.body ?? null,
      correspondence_type: body.correspondence_type ?? body.type ?? null,
      to_names: body.to_names ?? body.to ?? [],
      cc_names: body.cc_names ?? body.cc ?? [],
      from_email: user.email,
      from_name: body.from_name ?? null,
      ...(body.sent_at ? { sent_at: body.sent_at } : {}),
      created_by: user.id,
      status: body.status || 'draft',
      created_at: new Date().toISOString(),
    };
    if (!record.subject) return NextResponse.json({ error: 'subject is required' }, { status: 400 });
    const { data, error } = await supabase.from('correspondence').insert(record as Database['public']['Tables']['correspondence']['Insert']).select().single();
    // Never fabricate a fake `corr-…` id on failure — that reports a save that
    // never happened. Surface the real DB error instead.
    if (error) { console.error('[correspondence/POST]', error); return NextResponse.json({ error: error.message || 'Failed to create correspondence' }, { status: 500 }); }
    return NextResponse.json({ item: data });
  } catch {
    return NextResponse.json({ error: 'Failed to create correspondence' }, { status: 500 });
  }
}
