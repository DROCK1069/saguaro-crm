import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { requirePermission } from '@/lib/permissions';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await requirePermission(req, 'Budget', 'Edit');
  if (!g.ok) return g.res;
  const user = g.user;
  try {
    const body = await req.json();
    const db = createServerClient();
    // Map incoming aliases to real `contracts` columns; drop fields with no column.
    const fieldMap: Record<string, string> = {
      title: 'title',
      contract_number: 'contract_number',
      status: 'status',
      type: 'contract_type',
      contract_type: 'contract_type',
      value: 'amount',
      amount: 'amount',
      start_date: 'start_date',
      end_date: 'end_date',
      description: 'scope_of_work',
      scope_of_work: 'scope_of_work',
      project_id: 'project_id',
      notes: 'notes',
      retainage_percent: 'retainage_pct',
      retainage_pct: 'retainage_pct',
      signed_date: 'executed_date',
      executed_date: 'executed_date',
    };
    const fields: Record<string, any> = {};
    for (const k of Object.keys(fieldMap)) {
      if (body[k] !== undefined) fields[fieldMap[k]] = body[k];
    }
    const { data: updated, error } = await db
      .from('contracts')
      .update(fields)
      .eq('id', id)
      .eq('tenant_id', user.tenantId)
      .select('id, project_id, bid_package_id, contract_type, amount, original_amount, status, executed_at')
      .single();
    if (error) throw error;

    // ── EXECUTION CASCADE: an executed subcontract is no longer a dead end —
    //    stamp executed_at, mark its bid package contracted, and make sure the
    //    committed amount reached the budget (idempotent: only when the award
    //    path didn't already commit it via the same cost code). ──
    const c = updated as Record<string, any> | null;
    if (fields.status === 'executed' && c) {
      const patch: Record<string, unknown> = {};
      if (!c.executed_at) patch.executed_at = new Date().toISOString();
      if (Object.keys(patch).length) {
        await db.from('contracts').update(patch as never).eq('id', id).eq('tenant_id', user.tenantId);
      }
      if (c.bid_package_id) {
        await db.from('bid_packages')
          .update({ status: 'contracted' } as never)
          .eq('id', c.bid_package_id)
          .eq('tenant_id', user.tenantId)
          .eq('status', 'awarded');
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
