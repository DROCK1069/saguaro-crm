import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));

    if (!body.project_id || !body.title || !body.party_name) {
      return NextResponse.json({ error: 'Missing required fields: project_id, title, party_name' }, { status: 400 });
    }

    const db = createServerClient();

    const { data, error } = await db.from('contracts').insert({
      tenant_id: user.tenantId,
      created_by: user.id,
      project_id: body.project_id,
      title: body.title,
      party_name: body.party_name,
      contract_number: body.contract_number || null,
      contract_type: body.contract_type || null,
      party_email: body.party_email || null,
      party_phone: body.party_phone || null,
      party_company: body.party_company || null,
      trade: body.trade || null,
      scope_of_work: body.scope_of_work || null,
      amount: body.amount || null,
      retainage_pct: body.retainage_pct || null,
      status: body.status || null,
      start_date: body.start_date || null,
      end_date: body.end_date || null,
      insurance_required: body.insurance_required ?? null,
      bond_required: body.bond_required ?? null,
      notes: body.notes || null,
    }).select().single();

    if (error) throw error;

    return NextResponse.json({ contract: data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
