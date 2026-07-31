import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { requirePermission } from '@/lib/permissions';

export async function PATCH(req: NextRequest, { params }: { params: { projectId: string; id: string } }) {
  const g = await requirePermission(req, 'Projects', 'Edit');
  if (!g.ok) return g.res;
  const user = g.user;
  try {
    const supabase = createServerClient();
    const body = await req.json();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const allowed = ['employee_name','hours_regular','hours_overtime','hours_double','cost_code','location','description','status','notes','submitted_at','approved_by','approved_at','rejection_reason'];
    for (const k of allowed) if (body[k] !== undefined) updates[k] = body[k];
    const { data, error } = await supabase.from('timesheets').update(updates).eq('id', params.id).eq('project_id', params.projectId).eq('tenant_id', user.tenantId).select().single();
    if (error) throw error;
    return NextResponse.json({ timesheet: data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed';
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { projectId: string; id: string } }) {
  const g = await requirePermission(req, 'Projects', 'Full');
  if (!g.ok) return g.res;
  const user = g.user;
  try {
    const supabase = createServerClient();
    const { error } = await supabase.from('timesheets').delete().eq('id', params.id).eq('project_id', params.projectId).eq('tenant_id', user.tenantId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
