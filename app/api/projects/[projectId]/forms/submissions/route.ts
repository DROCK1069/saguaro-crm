import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('form_submissions')
      .select('*')
      .eq('project_id', params.projectId)
      .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ submissions: [] });
    return NextResponse.json({ submissions: data || [] });
  } catch {
    return NextResponse.json({ submissions: [] });
  }
}

export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const supabase = createServerClient();
    // tenant_id is required (NOT NULL) and the service-role client can't auto-resolve it
    // (the auto_set_tenant_id trigger needs an authenticated user). submitted_by is text.
    const record = {
      ...body,
      project_id: params.projectId,
      tenant_id: user.tenantId,
      submitted_by: user.email,
      status: body.status || 'submitted',
      created_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('form_submissions').insert(record).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ submission: data });
  } catch {
    return NextResponse.json({ error: 'Failed to submit form' }, { status: 500 });
  }
}
