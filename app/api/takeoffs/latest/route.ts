import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { ok, badRequest, serverError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // AUTH + TENANT: this dedicated route (which takes precedence over the
    // catch-all) was an unauthenticated service-role read of any project's
    // takeoff/estimate costs. Require a user and scope to their tenant.
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    if (!projectId) return badRequest('projectId required');

    // Query takeoff first, then materials separately to avoid FK resolution issues
    const { data: takeoff, error } = await supabase
      .from('takeoffs')
      .select('*')
      .eq('project_id', projectId)
      .eq('tenant_id', user.tenantId)
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!takeoff) return ok(null);

    // Fetch materials separately
    const { data: materials } = await supabase
      .from('takeoff_materials')
      .select('*')
      .eq('takeoff_id', takeoff.id)
      .order('sort_order', { ascending: true });

    return ok({ ...takeoff, takeoff_materials: materials || [] });
  } catch (err) {
    return serverError(err);
  }
}
