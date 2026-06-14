import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { getPortalSession, PORTAL_PERMS } from '@/lib/portal-auth';

/** GET — financial summary for the client portal financials tab */
export async function GET(req: NextRequest) {
  try {
    const session = await getPortalSession(req, PORTAL_PERMS.VIEW_FINANCIALS);
    if (!session) {
      return NextResponse.json({ error: 'Access denied — insufficient permissions' }, { status: 403 });
    }

    const db = createServerClient();
    const projectId = session.project_id;
    const tenantId = session.tenant_id;

    // Invoices
    const { data: invoiceRows } = await db
      .from('invoices')
      .select('id, invoice_number, amount, total, due_date, status, created_at')
      .eq('project_id', projectId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    const invoices = (invoiceRows || []).map((inv: any) => ({
      id: inv.id,
      number: inv.invoice_number || '',
      amount: inv.total ?? inv.amount ?? 0,
      date: inv.created_at,
      due_date: inv.due_date,
      status: inv.status || 'pending',
    }));

    // Budget line items
    const { data: budgetRows } = await db
      .from('budget_lines')
      .select(
        'id, cost_code, description, original_budget, approved_changes, revised_budget, committed, actual, variance, sort_order'
      )
      .eq('project_id', projectId)
      .eq('tenant_id', tenantId)
      .order('sort_order', { ascending: true });

    const budget_lines = (budgetRows || []).map((line: any) => {
      const original = line.original_budget ?? 0;
      const changes = line.approved_changes ?? 0;
      const current = line.revised_budget ?? original + changes;
      const spent = line.actual ?? 0;
      const remaining = line.variance ?? current - spent;
      return {
        id: line.id,
        code: line.cost_code || '',
        description: line.description || '',
        original,
        changes,
        current,
        committed: line.committed ?? 0,
        spent,
        remaining,
      };
    });

    // Payment history (same source the payments route reads/writes)
    const { data: paymentRows } = await db
      .from('portal_payments')
      .select('id, amount, payment_type, status, paid_at, created_at')
      .eq('project_id', projectId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    const payments = (paymentRows || []).map((p: any) => ({
      id: p.id,
      amount: p.amount ?? 0,
      date: p.paid_at || p.created_at,
      method: p.payment_type || 'Portal',
      reference: p.id,
    }));

    return NextResponse.json({ invoices, budget_lines, payments });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
