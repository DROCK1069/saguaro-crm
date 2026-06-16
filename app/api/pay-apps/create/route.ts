import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { onPayAppCreated } from '@/lib/triggers';
import { toCents, toDollars, percentOf, subCents, computePayApp } from '@/lib/calc';

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
    const retainagePercent = Number(body.retainagePercent ?? body.retainage_percent ?? 10) || 0;
    const prevPaymentsDollars = Number(body.prevPayments ?? body.prev_payments ?? 0) || 0;

    // ── Derive every money field with the exact-cents calc engine. The server is
    // the source of truth — client-sent totals are never trusted. When a schedule
    // of values is provided, the full G702/G703 cross-footed calculator runs.
    const rawLines: any[] = Array.isArray(body.lineItems) ? body.lineItems : [];
    let sovRows: any[] = [];
    let m: {
      contractSumToDate: number; thisPeriod: number; totalCompletedStored: number;
      percentComplete: number; totalRetainage: number; totalEarnedLessRetainage: number; currentPaymentDue: number;
    };

    if (rawLines.length > 0) {
      const lines = rawLines.map((it, i) => ({
        id: String(i + 1),
        description: String(it.description || ''),
        scheduledValue:  toCents(Number(it.scheduledValue ?? it.scheduled_value ?? 0) || 0),
        fromPrevious:    toCents(Number(it.workFromPrev ?? it.prev_completed ?? 0) || 0),
        thisPeriod:      toCents(Number(it.workThisPeriod ?? it.this_period ?? 0) || 0),
        storedMaterials: toCents(Number(it.materialsStored ?? it.stored_materials ?? 0) || 0),
      }));
      const r = computePayApp({ lines, retainagePercent, previousPaymentsLessRetainage: toCents(prevPaymentsDollars) });
      m = {
        contractSumToDate: toDollars(r.scheduledTotal),
        thisPeriod: toDollars(r.completedAndStoredTotal),
        totalCompletedStored: toDollars(r.completedAndStoredTotal),
        percentComplete: r.percentComplete,
        totalRetainage: toDollars(r.retainageTotal),
        totalEarnedLessRetainage: toDollars(r.totalEarnedLessRetainage),
        currentPaymentDue: toDollars(r.currentPaymentDue),
      };
      sovRows = r.lines.map((pl, i) => ({
        line_number: i + 1,
        description: lines[i].description,
        scheduled_value: toDollars(lines[i].scheduledValue),
        prev_completed: toDollars(lines[i].fromPrevious),
        this_period: toDollars(lines[i].thisPeriod),
        stored_materials: toDollars(lines[i].storedMaterials),
        total_completed: toDollars(pl.completedAndStored),
        percent_complete: pl.percentComplete,
        balance_to_finish: toDollars(pl.balanceToFinish),
        retainage: toDollars(pl.retainage),
        cost_code: rawLines[i].csiCode ?? rawLines[i].csi_code,
      }));
    } else {
      const workCents = toCents(Number(body.workCompleted ?? body.work_completed ?? body.thisPeriod ?? 0) || 0);
      const retCents = percentOf(workCents, retainagePercent);
      const earnedCents = subCents(workCents, retCents);
      const dueCents = subCents(earnedCents, toCents(prevPaymentsDollars));
      m = {
        contractSumToDate: Number(body.contractSumToDate) || p?.contract_amount || 0,
        thisPeriod: toDollars(workCents),
        totalCompletedStored: toDollars(workCents),
        percentComplete: Number(body.percentComplete) || 0,
        totalRetainage: toDollars(retCents),
        totalEarnedLessRetainage: toDollars(earnedCents),
        currentPaymentDue: toDollars(dueCents),
      };
    }

    const { data: payApp, error } = await db.from('pay_applications').insert({
      tenant_id: user.tenantId,
      project_id: projectId,
      app_number: appNumber,
      period_from: periodFrom,
      period_to: periodTo,
      status: body.status || 'draft',
      contract_sum: body.contractSum || p?.contract_amount || 0,
      change_orders_total: body.changeOrdersTotal || 0,
      contract_sum_to_date: m.contractSumToDate,
      prev_completed: body.prevCompleted || 0,
      this_period: m.thisPeriod,
      stored_materials: body.materialsStored || 0,
      total_completed_stored: m.totalCompletedStored,
      total_completed: m.totalCompletedStored,
      percent_complete: m.percentComplete,
      retainage_percent: retainagePercent,
      total_retainage: m.totalRetainage,
      retainage_amount: m.totalRetainage,
      total_earned_less_retainage: m.totalEarnedLessRetainage,
      less_previous_certificates: prevPaymentsDollars,
      current_payment_due: m.currentPaymentDue,
      net_payment_due: m.currentPaymentDue,
      owner_name: p?.owner_entity?.name || body.ownerName,
      owner_address: p?.owner_entity?.address || body.ownerAddress,
      architect_name: p?.architect_entity?.name || body.architectName,
      notes: body.notes,
    }).select().single();

    if (error) throw error;

    // Insert SOV line items (computed by the engine when provided)
    if (sovRows.length > 0) {
      await db.from('schedule_of_values').insert(
        sovRows.map((row) => ({ tenant_id: user.tenantId, project_id: projectId, pay_app_id: (payApp as any).id, ...row }))
      );
    }

    // Non-blocking trigger
    onPayAppCreated((payApp as any).id).catch(console.error);

    return NextResponse.json({ payApp, success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
