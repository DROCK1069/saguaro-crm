import { NextRequest } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { requirePermission } from '@/lib/permissions';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** GET /api/heatmap/designs?projectId=  → list (metadata only, no heavy plan data) */
export async function GET(req: NextRequest) {
  const user = await getUser(req).catch(() => null);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- heatmap_designs not yet in generated DB types
  const supabase = createServerClient() as any;
  const projectId = new URL(req.url).searchParams.get('projectId');
  let q = supabase
    .from('heatmap_designs')
    .select('id,name,project_id,coverage_percent,device_count,active_type,updated_at,created_at')
    .eq('tenant_id', user.tenantId)
    .order('updated_at', { ascending: false })
    .limit(100);
  if (projectId) q = q.eq('project_id', projectId);
  const { data, error } = await q;
  if (error) {
    console.error('[heatmap/designs] list failed', error);
    return Response.json({ error: 'Could not load saved designs. Please try again.' }, { status: 500 });
  }
  return Response.json({ designs: data || [] });
}

/** POST /api/heatmap/designs  → create (or update if id) a design attached to a project */
export async function POST(req: NextRequest) {
  const g = await requirePermission(req, 'Projects', 'Edit');
  if (!g.ok) return g.res;
  const user = g.user;
  const body = await req.json().catch(() => null);
  if (!body?.data) return Response.json({ error: 'Missing design data' }, { status: 400 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- heatmap_designs not yet in generated DB types
  const supabase = createServerClient() as any;
  const row = {
    tenant_id: user.tenantId,
    project_id: body.projectId || null,
    name: body.name || 'Coverage design',
    data: body.data,
    coverage_percent: typeof body.coveragePercent === 'number' ? body.coveragePercent : null,
    device_count: body.deviceCount ?? 0,
    active_type: body.activeType || null,
    created_by: user.id,
    updated_at: new Date().toISOString(),
  };
  if (body.id) {
    const { data, error } = await supabase.from('heatmap_designs').update(row).eq('id', body.id).eq('tenant_id', user.tenantId).select('id').single();
    if (error) {
      console.error('[heatmap/designs] update failed', error);
      return Response.json({ error: 'Could not save your changes. Please try again.' }, { status: 500 });
    }
    return Response.json({ id: data?.id, saved: true });
  }
  const { data, error } = await supabase.from('heatmap_designs').insert(row).select('id').single();
  if (error) {
    console.error('[heatmap/designs] insert failed', error);
    return Response.json({ error: 'Could not save the design. Please try again.' }, { status: 500 });
  }
  return Response.json({ id: data?.id, saved: true });
}
