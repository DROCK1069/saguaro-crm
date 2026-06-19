import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

async function authenticateSubPortal(req: NextRequest) {
  const token =
    req.nextUrl.searchParams.get('token') ||
    req.headers.get('x-portal-token');
  if (!token) return null;

  const db = createServerClient();
  const { data: session } = await db
    .from('portal_sub_sessions')
    .select('*')
    .eq('token', token)
    .eq('status', 'active')
    .single();

  return session;
}

/** GET — List sub's pay applications with GC notes and status */
export async function GET(req: NextRequest) {
  try {
    const session = await authenticateSubPortal(req);
    if (!session || !session.sub_id || !session.project_id) {
      return NextResponse.json(
        { error: 'Invalid or expired portal token' },
        { status: 401 }
      );
    }

    const db = createServerClient();

    const { data: payApps, error } = await db
      .from('portal_sub_pay_apps')
      .select(
        `*,
         line_items:portal_sub_pay_app_line_items(*)`
      )
      .eq('sub_id', session.sub_id)
      .eq('project_id', session.project_id)
      .eq('tenant_id', session.tenant_id)
      .order('period_to', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ pay_apps: payApps || [] });
  } catch (err) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/** POST — Submit new pay application with line items tied to SOV */
export async function POST(req: NextRequest) {
  try {
    const session = await authenticateSubPortal(req);
    if (!session) {
      return NextResponse.json(
        { error: 'Invalid or expired portal token' },
        { status: 401 }
      );
    }

    const db = createServerClient();
    const body = await req.json();
    const {
      period_start,
      period_end,
      application_number,
      line_items,
      notes,
      total_requested,
      retainage_percent,
    } = body;

    if (!period_end || !line_items || !Array.isArray(line_items)) {
      return NextResponse.json(
        { error: 'period_end and line_items array are required' },
        { status: 400 }
      );
    }

    // Calculate totals from line items
    const calcTotal = line_items.reduce(
      (sum: number, item: any) => sum + (item.amount_requested || 0),
      0
    );
    const retPct = retainage_percent || 10;
    const retainageAmount = calcTotal * (retPct / 100);
    const netAmount = calcTotal - retainageAmount;

    // Create the pay app.
    // Live portal_sub_pay_apps columns: period_from, period_to, amount, retainage,
    // net_amount, status, pdf_url, submitted_at. application_number, retainage_percent
    // and notes have no column (and no jsonb to fold into) so they are dropped.
    // period_start -> period_from, period_end -> period_to, total_requested -> amount,
    // retainage_amount -> retainage.
    const { data: payApp, error: payAppError } = await db
      .from('portal_sub_pay_apps')
      .insert({
        sub_id: session.sub_id,
        project_id: session.project_id,
        tenant_id: session.tenant_id,
        period_from: period_start || null,
        period_to: period_end,
        amount: total_requested || calcTotal,
        retainage: retainageAmount,
        net_amount: netAmount,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (payAppError) throw payAppError;

    // Insert line items tied to SOV.
    // Live portal_sub_pay_app_line_items columns: pay_app_id, description,
    // scheduled_value, prev_completed, this_period, total_completed,
    // percent_complete, balance. There is no tenant_id / sov_item_id / amount_requested
    // / gc_* column. previous_completed -> prev_completed; total_completed and balance
    // are derived.
    const lineItemRows = line_items.map((item: any) => {
      const scheduledValue = item.scheduled_value || 0;
      const prevCompleted = item.previous_completed || 0;
      const thisPeriod = item.this_period || item.amount_requested || 0;
      const totalCompleted = prevCompleted + thisPeriod;
      return {
        pay_app_id: payApp.id,
        description: item.description,
        scheduled_value: scheduledValue,
        prev_completed: prevCompleted,
        this_period: thisPeriod,
        total_completed: totalCompleted,
        percent_complete: item.percent_complete || 0,
        balance: scheduledValue - totalCompleted,
      };
    });

    const { error: lineError } = await db
      .from('portal_sub_pay_app_line_items')
      .insert(lineItemRows);

    if (lineError) throw lineError;

    return NextResponse.json(
      { pay_app: payApp, message: 'Pay application submitted successfully' },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
