import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { ok, notFound, serverError } from '@/lib/api-response';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const supabase = createServerClient();
    const { id } = await params;

    // Query takeoff without FK join to avoid PGRST200 errors. Scope to tenant.
    const { data: takeoff, error: takeoffErr } = await supabase
      .from('takeoffs')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', user.tenantId)
      .single();

    if (takeoffErr || !takeoff) {
      return notFound('Takeoff not found');
    }

    // Look up project name separately
    let projectName: string | null = null;
    if (takeoff.project_id) {
      const { data: project } = await supabase
        .from('projects')
        .select('name')
        .eq('id', takeoff.project_id)
        .maybeSingle();
      projectName = project?.name || null;
    }

    const { data: materials, error: materialsErr } = await supabase
      .from('takeoff_materials')
      .select('*')
      .eq('takeoff_id', id)
      .order('sort_order', { ascending: true });

    if (materialsErr) throw materialsErr;

    const result = {
      ...takeoff,
      project_name: projectName,
      materials: materials || [],
    };

    return ok(result);
  } catch (err) {
    return serverError(err);
  }
}
