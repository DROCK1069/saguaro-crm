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
    const { data: p, error } = await db
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('tenant_id', user.tenantId)
      .single();
    if (error) throw error;
    if (!p) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const num = (v: unknown) => Number(v) || 0;
    const original_contract = num(p.original_contract_value ?? p.original_contract ?? p.contract_value ?? p.contract_amount);
    const approved_cos = num(p.approved_change_orders ?? p.net_change_by_co);
    const revised_contract = num(p.revised_contract_value) || (original_contract + approved_cos);
    const billed_to_date = num(p.billed_to_date ?? p.total_billed);
    const retainage_held = num(p.retainage_held ?? p.total_retainage);
    const balance_to_finish = p.balance_to_finish != null ? num(p.balance_to_finish) : revised_contract - billed_to_date;
    const percent_billed = revised_contract > 0
      ? Math.round((billed_to_date / revised_contract) * 100)
      : num(p.percent_complete);

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
