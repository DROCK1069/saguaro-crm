import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { getPortalSession, PORTAL_PERMS } from '@/lib/portal-auth';

/** GET — return project dashboard data */
export async function GET(req: NextRequest) {
  try {
    const session = await getPortalSession(req, PORTAL_PERMS.VIEW_PROJECT);
    if (!session) {
      return NextResponse.json({ error: 'Access denied — insufficient permissions' }, { status: 403 });
    }

    const db = createServerClient();
    const projectId = session.project_id;
    const tenantId = session.tenant_id;

    // Budget summary from projects table
    const { data: project } = await db
      .from('projects')
      .select('id, name, status, contract_amount, budget, spent, start_date, end_date, percent_complete')
      .eq('id', projectId)
      .eq('tenant_id', tenantId)
      .single();

    // Schedule phases
    const { data: phases } = await db
      .from('schedule_phases')
      .select('*')
      .eq('project_id', projectId)
      .eq('tenant_id', tenantId)
      .order('sort_order', { ascending: true });

    // Recent photos
    const { data: photos } = await db
      .from('photos')
      .select('id, url, caption, category, taken_at, created_at')
      .eq('project_id', projectId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(12);

    // Change order statuses
    const { data: changeOrders } = await db
      .from('change_orders')
      .select('id, title, status, amount, created_at')
      .eq('project_id', projectId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Weather placeholder
    const weather = {
      current: {
        temp: null,
        condition: 'N/A',
        icon: 'cloud',
      },
      forecast: [],
      note: 'Weather integration pending — connect a weather API for live data.',
    };

    const budgetSummary = project
      ? {
          contract_amount: project.contract_amount || 0,
          budget: project.budget || 0,
          spent: project.spent || 0,
          remaining: (project.budget || 0) - (project.spent || 0),
          percent_complete: project.percent_complete || 0,
        }
      : null;

    return NextResponse.json({
      project: project
        ? {
            id: project.id,
            name: project.name,
            status: project.status,
            start_date: project.start_date,
            end_date: project.end_date,
          }
        : null,
      budget: budgetSummary,
      phases: phases || [],
      recentPhotos: photos || [],
      changeOrders: changeOrders || [],
      weather,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
