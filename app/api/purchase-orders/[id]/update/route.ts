import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { requirePermission } from '@/lib/permissions';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await requirePermission(req, 'Budget', 'Edit');
  if (!g.ok) return g.res;
  const user = g.user;
  const body = await req.json().catch(() => ({}));
  try {
    const db = createServerClient();
    const ALLOWED_PO_COLUMNS = [
      'project_id', 'po_number', 'vendor_name', 'vendor_email', 'vendor_phone', 'vendor_address',
      'description', 'line_items', 'subtotal', 'tax', 'shipping', 'total', 'status', 'delivery_date',
      'delivered_at', 'cost_code', 'approved_by', 'approved_at', 'pdf_url', 'notes', 'created_by',
      'updated_at',
    ];
    const updates: Record<string, any> = {};
    for (const k of ALLOWED_PO_COLUMNS) {
      if (body[k] !== undefined) updates[k] = body[k];
    }
    const { data, error } = await db.from('purchase_orders').update(updates).eq('id', params.id).eq('tenant_id', user.tenantId).select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, purchase_order: data });
  } catch (err) {
    console.error('[purchase-orders/update]', err);
    return NextResponse.json({ error: 'Failed to update purchase order' }, { status: 500 });
  }
}
