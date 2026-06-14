import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    const { error } = await db
      .from('contracts')
      .update(fields)
      .eq('id', id)
      .eq('tenant_id', user.tenantId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
