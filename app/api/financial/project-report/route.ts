import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET /api/financial/project-report?projectId= -> { summary: FinancialSummary }
// Reads the stored financial roll-up columns on the project row.
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId') || searchParams.get('project_id');
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

  try {
    const db = createServerClient();
    const [projectRes, payAppsRes, changeOrdersRes] = await Promise.all([
      db
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .eq('tenant_id', user.tenantId)
        .single(),
      db
        .from('pay_applications')
        .select('current_payment_due, total_retainage')
        .eq('project_id', projectId)
        .eq('tenant_id', user.tenantId),
      db
        .from('change_orders')
        .select('amount')
        .eq('project_id', projectId)
        .eq('tenant_id', user.tenantId)
        .eq('status', 'approved'),
    ]);
    const { data: p, error } = projectRes;
    if (error) throw error;
    if (!p) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const num = (v: unknown) => Number(v) || 0;

    // Recompute money from child tables; fall back to the projects roll-up
    // columns only when a child aggregate is null (no child rows at all).
    const sumOrNull = (rows: Record<string, unknown>[] | null, key: string): number | null => {
      if (!rows || rows.length === 0) return null;
      return rows.reduce((acc, r) => acc + num(r[key]), 0);
    };

    const payApps = payAppsRes.error ? null : payAppsRes.data;
    const changeOrders = changeOrdersRes.error ? null : changeOrdersRes.data;

    const billedFromChildren = sumOrNull(payApps, 'current_payment_due');
    const retainageFromChildren = sumOrNull(payApps, 'total_retainage');
    const cosFromChildren = sumOrNull(changeOrders, 'amount');

    const original_contract = num(p.original_contract_value ?? p.contract_value ?? p.original_contract ?? p.contract_amount);
    const approved_cos = cosFromChildren != null ? cosFromChildren : num(p.approved_change_orders ?? p.net_change_by_co);
    const billed_to_date = billedFromChildren != null ? billedFromChildren : num(p.billed_to_date ?? p.total_billed);
    const retainage_held = retainageFromChildren != null ? retainageFromChildren : num(p.retainage_held ?? p.total_retainage);
    const revised_contract = original_contract + approved_cos;
    const balance_to_finish = revised_contract - billed_to_date;
    const percent_billed = revised_contract > 0
      ? Math.round((billed_to_date / revised_contract) * 100)
      : 0;

    return NextResponse.json({
      summary: {
        original_contract,
        approved_cos,
        revised_contract,
        billed_to_date,
        retainage_held,
        balance_to_finish,
        percent_billed,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg, summary: {} }, { status: 500 });
  }
}
