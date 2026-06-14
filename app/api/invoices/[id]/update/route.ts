import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  try {
    const db = createServerClient();
    const ALLOWED_INVOICE_COLUMNS = [
      'project_id', 'invoice_number', 'vendor_name', 'vendor_email', 'description', 'category',
      'cost_code', 'amount', 'tax', 'total', 'due_date', 'status', 'paid_at', 'paid_amount',
      'payment_method', 'check_number', 'pdf_url', 'notes', 'created_by', 'approved_by',
      'approved_at', 'updated_at', 'qbo_id',
    ];
    const updates: Record<string, any> = {};
    for (const k of ALLOWED_INVOICE_COLUMNS) {
      if (body[k] !== undefined) updates[k] = body[k];
    }
    const { data, error } = await db.from('invoices').update(updates).eq('id', params.id).eq('tenant_id', user.tenantId).select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, invoice: data });
  } catch (err) {
    console.error('[invoices/update]', err);
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
  }
}
