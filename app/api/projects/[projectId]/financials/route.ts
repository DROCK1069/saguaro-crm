import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { rollupFinancials } from '@/lib/financials';

export const runtime = 'nodejs';

/**
 * GET /api/projects/[projectId]/financials[?sync=1]
 *
 * The connected financials view: rolls up commitments + cost entries +
 * approved change orders against each budget line, returning revised budget /
 * committed / actual / projected-final / variance per cost code and in total.
 * ?sync=1 also writes the computed values back onto budget_line_items so the
 * stored numbers stop being stale.
 */
export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sync = new URL(req.url).searchParams.get('sync') === '1';
  const pid = params.projectId;

  try {
    const db = createServerClient();
    const [bl, cm, ce, co] = await Promise.all([
      db.from('budget_line_items').select('id,cost_code,csi_division,csi_description,original_budget,approved_changes').eq('tenant_id', user.tenantId).eq('project_id', pid),
      db.from('commitments').select('budget_line_item_id,current_amount,original_amount,invoiced_to_date').eq('project_id', pid),
      db.from('cost_entries').select('budget_line_item_id,amount,approved').eq('tenant_id', user.tenantId).eq('project_id', pid),
      db.from('change_orders').select('amount,approved_at').eq('project_id', pid),
    ]);

    const result = rollupFinancials({
      budgetLines: bl.data || [],
      commitments: cm.data || [],
      costEntries: ce.data || [],
      changeOrders: co.data || [],
    });

    if (sync) {
      await Promise.allSettled(result.lines.map((l) =>
        db.from('budget_line_items').update({
          current_budget: l.revised,
          committed_cost: l.committed,
          cost_to_date: l.actual,
          uncommitted_cost: Math.max(0, l.revised - l.committed),
          estimated_final_cost: l.projected,
          variance: l.variance,
          variance_pct: l.variancePct,
          updated_at: new Date().toISOString(),
        }).eq('id', l.id),
      ));
    }

    return NextResponse.json({ ...result, synced: sync });
  } catch (err) {
    console.error('[financials] GET', err);
    return NextResponse.json({ error: 'Could not compute financials' }, { status: 500 });
  }
}
