import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));

    if (!body.project_id || !body.vendor_name) {
      return NextResponse.json({ error: 'Missing required fields: project_id, vendor_name' }, { status: 400 });
    }

    const db = createServerClient();

    const { data, error } = await db.from('purchase_orders').insert({
      tenant_id: user.tenantId,
      created_by: user.id,
      project_id: body.project_id,
      vendor_name: body.vendor_name,
      po_number: body.po_number || null,
      vendor_email: body.vendor_email || null,
      vendor_phone: body.vendor_phone || null,
      vendor_address: body.vendor_address || null,
      description: body.description || null,
      line_items: body.line_items || null,
      subtotal: body.subtotal || null,
      tax: body.tax || null,
      shipping: body.shipping || null,
      total: body.total || null,
      status: body.status || null,
      delivery_date: body.delivery_date || null,
      cost_code: body.cost_code || null,
      notes: body.notes || null,
    }).select().single();

    if (error) throw error;

    return NextResponse.json({ purchaseOrder: data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
