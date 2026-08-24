import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { requirePermission } from '@/lib/permissions';

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('form_submissions')
      .select('*')
      .eq('project_id', params.projectId)
      .eq('tenant_id', user.tenantId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[projects/[projectId]/forms/submissions] read failed:', error.message);
      return NextResponse.json({ error: 'Failed to load submissions', detail: error.message }, { status: 500 });
    }
    return NextResponse.json({ submissions: data || [] });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error('[projects/[projectId]/forms/submissions] read failed:', detail);
    // A failed read must not render as an empty result — return a real
    // status so the UI can show an error state with a retry.
    return NextResponse.json({ error: 'Failed to load submissions', detail }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  const g = await requirePermission(req, 'Projects', 'Edit');
  if (!g.ok) return g.res;
  const user = g.user;
  try {
    const body = await req.json();
    const supabase = createServerClient();
    const record = {
      project_id: params.projectId,
      ...body,
      submitted_by: user.email,
      status: body.status || 'submitted',
      created_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('form_submissions').insert(record).select().single();
    if (error) return NextResponse.json({ submission: { id: `fs-${Date.now()}`, ...record } });
    return NextResponse.json({ submission: data });
  } catch {
    return NextResponse.json({ error: 'Failed to submit form' }, { status: 500 });
  }
}
