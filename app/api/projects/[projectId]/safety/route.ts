import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

/**
 * GET /api/projects/[projectId]/safety
 * Safety incidents + inspections for one project, scoped to the caller's tenant.
 *
 * Reads deliberately go through the service-role client (supplied by
 * requirePermission). Every RLS policy on safety_incidents / safety_inspections
 * is granted to `authenticated` or `service_role` only — a bare anon client
 * matches no policy, so the SELECT returns ZERO ROWS WITH NO ERROR. That made
 * this route report a spotless safety record for projects that actually had
 * open incidents. Tenant isolation is enforced explicitly by the tenant_id
 * filters below.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const g = await requirePermission(req, 'Safety', 'View', { projectId });
  if (!g.ok) return g.res;

  const { db, user } = g;

  const [incidents, inspections] = await Promise.all([
    db
      .from('safety_incidents')
      .select('*')
      .eq('project_id', projectId)
      .eq('tenant_id', user.tenantId)
      .order('incident_date', { ascending: false }),
    db
      .from('safety_inspections')
      .select('*')
      .eq('project_id', projectId)
      .eq('tenant_id', user.tenantId)
      .order('inspection_date', { ascending: false }),
  ]);

  // EITHER query failing is fatal. The previous `incidents.error && inspections.error`
  // required BOTH to fail before erroring, so a single failed read was returned as
  // an empty array — rendering as "no incidents" instead of "we could not check".
  const failures = [
    incidents.error ? `incidents: ${incidents.error.message}` : null,
    inspections.error ? `inspections: ${inspections.error.message}` : null,
  ].filter((m): m is string => m !== null);

  if (failures.length > 0) {
    console.error('[projects/safety] read failed:', failures.join('; '));
    return NextResponse.json(
      { error: 'Failed to load safety data', detail: failures.join('; ') },
      { status: 500 },
    );
  }

  return NextResponse.json({
    incidents: incidents.data ?? [],
    inspections: inspections.data ?? [],
  });
}
