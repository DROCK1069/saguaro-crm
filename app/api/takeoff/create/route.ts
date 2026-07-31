import { NextRequest } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { ok, badRequest, serverError, unauthorized } from '@/lib/api-response';
import { requirePermission } from '@/lib/permissions';

export async function POST(req: NextRequest) {
  try {
    const g = await requirePermission(req, 'Projects', 'Edit');
    if (!g.ok) return g.res;
    const user = g.user;
    const supabase = createServerClient();
    const { projectId } = await req.json();
    if (!projectId) return badRequest('projectId required');

    // Validate the project exists AND belongs to the caller's tenant
    const { data: project } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', projectId)
      .eq('tenant_id', user.tenantId)
      .maybeSingle();

    if (!project) return badRequest('Project not found');

    const { data, error } = await supabase
      .from('takeoffs')
      .insert({
        project_id: projectId,
        tenant_id: user.tenantId,
        created_by: user.id,
        status: 'pending',
        name: `Takeoff ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      })
      .select()
      .single();

    if (error) throw error;
    return ok({ ...data, project_name: project.name });
  } catch (err) {
    return serverError(err);
  }
}
