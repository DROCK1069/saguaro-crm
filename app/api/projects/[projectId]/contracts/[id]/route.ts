import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { summarizeContract, toCents, toDollars, type ChangeOrder } from '@/lib/calc';

export async function PATCH(req: NextRequest, { params }: { params: { projectId: string; id: string } }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const supabase = createServerClient();
    const body = await req.json();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const allowed = ['title','contract_type','vendor_name','vendor_email','description','original_amount','approved_changes','retainage_pct','start_date','end_date','signed_date','status','scope_of_work','insurance_required','insurance_verified','bonding_required','bonding_verified','notes','invoiced_amount','paid_amount'];
    for (const k of allowed) if (body[k] !== undefined) updates[k] = body[k];

    // Revised/adjusted contract money is computed by the exact-cents engine.
    // Only APPROVED change orders move the contract; pending/rejected are excluded.
    // DB stores dollars, so convert to cents for math and back to dollars to store.
    if (body.original_amount !== undefined || Array.isArray(body.change_orders)) {
      const originalCents = toCents((body.original_amount ?? 0) as number | string);
      const changeOrders: ChangeOrder[] = Array.isArray(body.change_orders)
        ? body.change_orders.map((c: { id?: string; description?: string; amount: number | string; status: ChangeOrder['status'] }) => ({
            id: String(c.id ?? ''),
            description: String(c.description ?? ''),
            amount: toCents(c.amount),
            status: c.status,
          }))
        : [];
      const summary = summarizeContract(originalCents, changeOrders);
      updates.original_amount = toDollars(summary.originalContract);
      updates.approved_changes = toDollars(summary.approvedChangeOrders);
    } else if (body.approved_changes !== undefined) {
      // Normalize a directly-supplied approved-changes value through the cents engine.
      updates.approved_changes = toDollars(toCents(body.approved_changes as number | string));
    }

    const { data, error } = await supabase.from('contracts').update(updates).eq('id', params.id).eq('project_id', params.projectId).select().single();
    if (error) throw error;
    return NextResponse.json({ contract: data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed';
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
