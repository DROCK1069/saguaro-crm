import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));

    if (!body.project_id || !body.vendor_name) {
      return NextResponse.json({ error: 'project_id and vendor_name are required' }, { status: 400 });
    }

    const db = createServerClient();

    const { data, error } = await db
      .from('bills')
      .insert({
        tenant_id: user.tenantId,
        created_by: user.id,
        project_id: body.project_id,
        vendor_name: body.vendor_name,
        bill_number: body.bill_number || null,
        vendor_email: body.vendor_email || null,
        description: body.description || null,
        category: body.category || null,
        cost_code: body.cost_code || null,
        amount: body.amount || null,
        tax: body.tax || null,
        total: body.total || null,
        due_date: body.due_date || null,
        status: body.status || null,
        notes: body.notes || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ bill: data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
