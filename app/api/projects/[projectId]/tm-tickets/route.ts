import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('tm_tickets')
      .select('*')
      .eq('project_id', params.projectId)
      .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ tickets: [] });
    return NextResponse.json({ tickets: data || [] });
  } catch {
    return NextResponse.json({ tickets: [] });
  }
}

export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const supabase = createServerClient();
    // created_by is a uuid column → store the auth user id, not the email.
    // tenant_id must be set explicitly (service-role client; the auto_set_tenant_id
    // trigger can't resolve it without an authenticated user, and the column is NOT NULL).
    const record = {
      ...body,
      project_id: params.projectId,
      tenant_id: user.tenantId,
      created_by: user.id,
      status: body.status || 'draft',
      created_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('tm_tickets').insert(record).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ticket: data });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create T&M ticket' }, { status: 500 });
  }
}
