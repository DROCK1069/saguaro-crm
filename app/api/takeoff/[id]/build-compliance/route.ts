/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * POST /api/takeoff/[id]/build-compliance
 *
 * Re-file the compliance documents (lien waivers, W-9 requests, COI requests +
 * a filed COI request PDF, and the downstream package hook) for the bid packages
 * already created from this takeoff. Idempotent — safe to call repeatedly; it
 * cleans up its own prior un-acted-upon auto-filed rows before recreating.
 *
 * Tenant-scoped: the tenant is derived from the authenticated user, the takeoff
 * is ownership-checked, and every write lands in the caller's tenant. No tenant
 * value is ever taken from the client or a project row.
 *
 * This is the same routine the Sage auto-docs stream invokes inline; this route
 * exists so a PM can re-run compliance after subs are awarded without re-running
 * the whole takeoff → jacket flow.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { buildComplianceForBidPackages, type AutoFilePackage } from '@/lib/compliance-autofile';
import { humanError } from '@/lib/errors';

export const runtime = 'nodejs';
export const maxDuration = 120;

function parseMoney(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = Number(String(v).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser(req).catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: takeoffId } = await params;
  const db = createServerClient();

  try {
    // Ownership gate — takeoff must belong to the caller's tenant.
    const { data: takeoff } = await db
      .from('takeoffs')
      .select('id, project_id, tenant_id')
      .eq('id', takeoffId)
      .eq('tenant_id', user.tenantId)
      .single();
    if (!takeoff || !(takeoff as any).project_id) {
      return NextResponse.json({ error: 'Takeoff not found' }, { status: 404 });
    }
    const projectId = (takeoff as any).project_id as string;

    const { data: project } = await db
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('tenant_id', user.tenantId)
      .single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // Load the packages already created for this project (tenant scoped).
    const { data: pkgRows } = await db
      .from('bid_packages')
      .select('id, name, trade, csi_division, csi_codes, estimated_value, budget_estimate, awarded_amount, requires_bond, general_liability, auto_liability, workers_compensation')
      .eq('tenant_id', user.tenantId)
      .eq('project_id', projectId)
      .is('deleted_at', null);

    const packages: AutoFilePackage[] = ((pkgRows || []) as any[]).map((p) => {
      const div = String(p.csi_division || (Array.isArray(p.csi_codes) && p.csi_codes[0] ? String(p.csi_codes[0]).slice(0, 2) : '') || '').replace(/\s/g, '');
      return {
        id: p.id,
        name: String(p.name || p.trade || 'Bid Package'),
        trade: String(p.trade || p.name || ''),
        div,
        total: Number(p.estimated_value ?? p.budget_estimate ?? p.awarded_amount ?? 0),
        requiresBond: !!p.requires_bond,
        insGl: parseMoney(p.general_liability),
        insAuto: parseMoney(p.auto_liability),
        insWork: parseMoney(p.workers_compensation),
      };
    });

    if (packages.length === 0) {
      return NextResponse.json({ error: 'No bid packages found for this takeoff/project. Run Sage auto-docs first.' }, { status: 400 });
    }

    const compliance = await buildComplianceForBidPackages({
      db,
      tenantId: user.tenantId,
      projectId,
      project: project as Record<string, any>,
      packages,
    });

    return NextResponse.json({ success: true, projectId, packages: packages.length, compliance });
  } catch (e: unknown) {
    console.error('[takeoff/build-compliance]', e);
    return NextResponse.json({ error: humanError(e, 'Failed to build compliance documents.') }, { status: 500 });
  }
}
