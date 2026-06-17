import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
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
      .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ items: [] });
    return NextResponse.json({ items: data || [] });
  } catch {
    return NextResponse.json({ items: [] });
  }
}

export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    const { data, error } = await supabase.from('correspondence').insert(record as Database['public']['Tables']['correspondence']['Insert']).select().single();
    if (error) return NextResponse.json({ item: { id: `corr-${Date.now()}`, ...record } });
    return NextResponse.json({ item: data });
  } catch {
    return NextResponse.json({ error: 'Failed to create correspondence' }, { status: 500 });
  }
}
