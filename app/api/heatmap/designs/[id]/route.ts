import { NextRequest } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { requirePermission } from '@/lib/permissions';

export const runtime = 'nodejs';

/** GET /api/heatmap/designs/[id]  → full design (incl. plan data) to reopen */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser(req).catch(() => null);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- heatmap_designs not yet in generated DB types
  const supabase = createServerClient() as any;
  const { data, error } = await supabase.from('heatmap_designs').select('*').eq('id', params.id).eq('tenant_id', user.tenantId).single();
  if (error || !data) return Response.json({ error: 'Design not found.' }, { status: 404 });
  return Response.json({ design: data });
}

/** DELETE /api/heatmap/designs/[id] */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await requirePermission(req, 'Projects', 'Full');
  if (!g.ok) return g.res;
  const user = g.user;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- heatmap_designs not yet in generated DB types
  const supabase = createServerClient() as any;
  const { error } = await supabase.from('heatmap_designs').delete().eq('id', params.id).eq('tenant_id', user.tenantId);
  if (error) {
    console.error('[heatmap/designs] delete failed', error);
    return Response.json({ error: 'Could not delete the design. Please try again.' }, { status: 500 });
  }
  return Response.json({ deleted: true });
}
