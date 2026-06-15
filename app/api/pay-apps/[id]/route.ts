import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db = createServerClient();
    const [{ data: payApp }, { data: lineItems }] = await Promise.all([
      db.from('pay_applications').select('*, projects(*)').eq('id', id).eq('tenant_id', user.tenantId).single(),
      db.from('schedule_of_values').select('*').eq('pay_app_id', id).order('line_number'),
    ]);
    if (!payApp) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ payApp, lineItems: lineItems || [] });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const db = createServerClient();

    // Update pay app header fields.
    // Map incoming body keys onto real pay_applications columns. Several legacy
    // body keys diverge from the live schema (e.g. materials_stored ->
    // stored_materials), so we translate rather than write them verbatim.
    const headerFields: Record<string, any> = {};
    const columnMap: Record<string, string> = {
      period_from: 'period_from',
      period_to: 'period_to',
      contract_sum: 'contract_sum',
      change_orders_total: 'change_orders_total',
      contract_sum_to_date: 'contract_sum_to_date',
      prev_completed: 'prev_completed',
      this_period: 'this_period',
      materials_stored: 'stored_materials',
      total_completed: 'total_completed_stored',
      percent_complete: 'percent_complete',
      retainage_percent: 'retainage_percent',
      retainage_amount: 'total_retainage',
      total_earned_less_retainage: 'total_earned_less_retainage',
      prev_payments: 'less_previous_certificates',
      current_payment_due: 'current_payment_due',
      net_amount_due: 'net_payment_due',
      notes: 'notes',
      owner_name: 'owner_name',
      owner_address: 'owner_address',
      architect_name: 'architect_name',
    };
    for (const k of Object.keys(columnMap)) {
      if (body[k] !== undefined) headerFields[columnMap[k]] = body[k];
    }

    // The mobile edit form sends `work_completed`/`workCompleted` (the dollar
    // amount completed this period), which the columnMap above does not cover —
    // without this, editing the amount silently no-ops. Map it to `this_period`
    // and recompute the derived money fields the same way create does, so the
    // detail sheet's retainage / payment-due stay consistent after an edit.
    const workEdited = body.work_completed ?? body.workCompleted ?? body.thisPeriod;
    if (workEdited !== undefined) {
      const workCompleted = Number(workEdited) || 0;
      // Need retainage_percent to recompute; use the provided value or read the row.
      let retainagePercent = Number(body.retainage_percent ?? body.retainagePercent);
      if (!Number.isFinite(retainagePercent)) {
        const { data: existing } = await db
          .from('pay_applications')
          .select('retainage_percent')
          .eq('id', id)
          .eq('tenant_id', user.tenantId)
          .maybeSingle();
        retainagePercent = Number((existing as any)?.retainage_percent ?? 10) || 0;
      }
      const retainageAmount = (workCompleted * retainagePercent) / 100;
      const netDue = workCompleted - retainageAmount;
      headerFields.this_period = workCompleted;
      headerFields.total_completed_stored = workCompleted;
      headerFields.total_completed = workCompleted;
      headerFields.total_retainage = retainageAmount;
      headerFields.retainage_amount = retainageAmount;
      headerFields.total_earned_less_retainage = netDue;
      headerFields.current_payment_due = netDue;
      headerFields.net_payment_due = netDue;
    }

    if (Object.keys(headerFields).length > 0) {
      const { error } = await db
        .from('pay_applications')
        .update(headerFields)
        .eq('id', id)
        .eq('tenant_id', user.tenantId);
      if (error) throw error;
    }

    // Replace SOV line items if provided
    if (Array.isArray(body.lineItems)) {
      await db.from('schedule_of_values').delete().eq('pay_app_id', id);
      if (body.lineItems.length > 0) {
        const { error: liErr } = await db.from('schedule_of_values').insert(
          body.lineItems.map((item: any, i: number) => ({
            tenant_id: user.tenantId,
            project_id: body.projectId,
            pay_app_id: id,
            line_number: i + 1,
            description: item.description,
            scheduled_value: item.scheduled_value ?? item.scheduledValue ?? 0,
            prev_completed: item.work_from_prev ?? item.workFromPrev ?? 0,
            this_period: item.work_this_period ?? item.workThisPeriod ?? 0,
            stored_materials: item.materials_stored ?? item.materialsStored ?? 0,
            total_completed: item.total_completed ?? item.totalCompleted ?? 0,
            percent_complete: item.percent_complete ?? item.percentComplete ?? 0,
            balance_to_finish: item.balance_to_finish ?? item.balanceToFinish ?? 0,
            retainage: item.retainage ?? 0,
            cost_code: item.csi_code ?? item.csiCode,
          }))
        );
        if (liErr) throw liErr;
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Partial update of pay app header fields. Whitelists real pay_applications
// columns (legacy keys are mapped to their live column names) and writes only
// the provided fields. Tenant-scoped.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const db = createServerClient();

    const columnMap: Record<string, string> = {
      period_from: 'period_from',
      period_to: 'period_to',
      contract_sum: 'contract_sum',
      change_orders_total: 'change_orders_total',
      contract_sum_to_date: 'contract_sum_to_date',
      prev_completed: 'prev_completed',
      this_period: 'this_period',
      materials_stored: 'stored_materials',
      stored_materials: 'stored_materials',
      total_completed: 'total_completed_stored',
      percent_complete: 'percent_complete',
      retainage_percent: 'retainage_percent',
      retainage_amount: 'total_retainage',
      total_earned_less_retainage: 'total_earned_less_retainage',
      prev_payments: 'less_previous_certificates',
      current_payment_due: 'current_payment_due',
      net_amount_due: 'net_payment_due',
      net_payment_due: 'net_payment_due',
      status: 'status',
      notes: 'notes',
      internal_notes: 'internal_notes',
      owner_name: 'owner_name',
      owner_address: 'owner_address',
      architect_name: 'architect_name',
    };

    const updates: Record<string, unknown> = {};
    for (const k of Object.keys(columnMap)) {
      if (body[k] !== undefined) updates[columnMap[k]] = body[k];
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: true });
    }

    const { data, error } = await db
      .from('pay_applications')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', user.tenantId)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ payApp: data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db = createServerClient();
    const { error } = await db
      .from('pay_applications')
      .delete()
      .eq('id', id)
      .eq('tenant_id', user.tenantId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
