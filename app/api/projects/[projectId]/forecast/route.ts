import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { computeEVM } from '@/lib/earned-value';

export const dynamic = 'force-dynamic';
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * GET /api/projects/[projectId]/forecast
 * Predictive analytics: pulls budget + actual cost + schedule % complete and
 * runs Earned Value Management → CPI/SPI, EAC/ETC/VAC, projected completion,
 * and a composite risk score. (Procore's "forecasting" / project-risk view.)
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createServerClient() as any;
  const [{ data: budget }, { data: costs }, { data: sched }] = await Promise.all([
    db.from('budget_line_items').select('current_budget, cost_to_date, estimated_final_cost').eq('project_id', projectId).eq('tenant_id', user.tenantId),
    db.from('cost_entries').select('amount').eq('project_id', projectId).eq('tenant_id', user.tenantId),
    db.from('schedule_tasks').select('pct_complete, duration').eq('project_id', projectId).eq('tenant_id', user.tenantId),
  ]);

  const bac = (budget || []).reduce((s: number, b: any) => s + (Number(b.current_budget) || 0), 0);
  const ac = (costs || []).reduce((s: number, c: any) => s + (Number(c.amount) || 0), 0)
    || (budget || []).reduce((s: number, b: any) => s + (Number(b.cost_to_date) || 0), 0);

  // % complete weighted by task duration; EV = %complete * BAC.
  const totalDur = (sched || []).reduce((s: number, t: any) => s + (Number(t.duration) || 0), 0);
  const weightedPct = totalDur > 0
    ? (sched || []).reduce((s: number, t: any) => s + (Number(t.duration) || 0) * (Number(t.pct_complete) || 0), 0) / totalDur / 100
    : (bac > 0 ? ac / bac : 0);
  const ev = bac * weightedPct;
  // Planned value ≈ elapsed schedule fraction (fallback to spend-based when no schedule).
  const pv = bac * Math.min(1, weightedPct + 0.05) || ac;

  const evm = computeEVM({ bac, pv, ev, ac });

  return NextResponse.json({
    inputs: { bac, pv: Math.round(pv), ev: Math.round(ev), ac, percent_complete_weighted: Math.round(weightedPct * 1000) / 10 },
    forecast: evm,
    cost_to_complete: evm.etc,
    estimate_at_completion: evm.eac_cpi,
    projected_overrun: evm.vac < 0 ? Math.abs(evm.vac) : 0,
  });
}
