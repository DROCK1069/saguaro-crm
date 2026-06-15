import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { onPayAppCreated } from '@/lib/triggers';

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const db = createServerClient();

    const projectId = body.projectId ?? body.project_id;
    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

    const { data: project } = await db.from('projects').select('*').eq('id', projectId).single();
    const p = project as any;

    // Get next application number
    const { data: lastApp } = await db
      .from('pay_applications')
      .select('app_number')
      .eq('project_id', projectId)
      .order('app_number', { ascending: false })
      .limit(1)
      .single();
    const appNumber = ((lastApp as any)?.app_number || 0) + 1;

    // Accept both camelCase and snake_case for the keys the mobile form sends.
    const periodTo = body.periodTo ?? body.period_to ?? null;
    const periodFrom = body.periodFrom ?? body.period_from ?? null;
    // Work completed this period — the mobile detail sheet reads `work_completed`.
    const workCompleted = Number(body.workCompleted ?? body.work_completed ?? body.thisPeriod ?? 0) || 0;
    const retainagePercent = Number(body.retainagePercent ?? body.retainage_percent ?? 10) || 0;
    // Derive retainage held if not explicitly supplied; detail sheet reads `retainage`.
    const retainageAmount = Number(
      body.retainageAmount ?? body.retainage_amount ?? body.retainage ?? (workCompleted * retainagePercent) / 100
    ) || 0;
    const currentPaymentDue = Number(
      body.currentPaymentDue ?? body.current_payment_due ?? (workCompleted - retainageAmount)
    ) || 0;

    const { data: payApp, error } = await db.from('pay_applications').insert({
      tenant_id: user.tenantId,
      project_id: projectId,
      app_number: appNumber,
      period_from: periodFrom,
      period_to: periodTo,
      status: body.status || 'draft',
      contract_sum: body.contractSum || p?.contract_amount || 0,
      change_orders_total: body.changeOrdersTotal || 0,
      contract_sum_to_date: body.contractSumToDate || p?.contract_amount || 0,
      prev_completed: body.prevCompleted || 0,
      this_period: workCompleted,
      // Mobile detail sheet reads `work_completed` directly — persist it.
      work_completed: workCompleted,
      stored_materials: body.materialsStored || 0,
      total_completed_stored: body.totalCompleted || workCompleted,
      total_completed: body.totalCompleted || workCompleted,
      percent_complete: body.percentComplete || 0,
      retainage_percent: retainagePercent,
      // Mobile detail sheet reads `retainage` directly — persist it alongside total_retainage.
      retainage: retainageAmount,
      total_retainage: retainageAmount,
      retainage_amount: retainageAmount,
      total_earned_less_retainage: body.totalEarnedLessRetainage || (workCompleted - retainageAmount),
      less_previous_certificates: body.prevPayments || 0,
      current_payment_due: currentPaymentDue,
      net_payment_due: currentPaymentDue,
      owner_name: p?.owner_entity?.name || body.ownerName,
      owner_address: p?.owner_entity?.address || body.ownerAddress,
      architect_name: p?.architect_entity?.name || body.architectName,
      notes: body.notes,
    }).select().single();

    if (error) throw error;

    // Insert SOV line items if provided
    if (body.lineItems && body.lineItems.length > 0) {
      await db.from('schedule_of_values').insert(
        body.lineItems.map((item: any, i: number) => ({
          tenant_id: user.tenantId,
          project_id: projectId,
          pay_app_id: (payApp as any).id,
          line_number: i + 1,
          description: item.description,
          scheduled_value: item.scheduledValue || 0,
          prev_completed: item.workFromPrev || 0,
          this_period: item.workThisPeriod || 0,
          stored_materials: item.materialsStored || 0,
          total_completed: item.totalCompleted || 0,
          percent_complete: item.percentComplete || 0,
          balance_to_finish: item.balanceToFinish || 0,
          retainage: item.retainage || 0,
          cost_code: item.csiCode,
        }))
      );
    }

    // Non-blocking trigger
    onPayAppCreated((payApp as any).id).catch(console.error);

    return NextResponse.json({ payApp, success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
