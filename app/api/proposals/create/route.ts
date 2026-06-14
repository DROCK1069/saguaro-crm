import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: Record<string, unknown> = {};
  try {
    body = await req.json().catch(() => ({}));
    const db = createServerClient();

    // The page POSTs a rich Proposal object (client id, version, created_date, …)
    // alongside camelCase projectId. Only persist real proposals columns and
    // scope the row to the tenant. Client-generated `id`/`version`/`created_date`
    // are not columns and must be dropped (the DB assigns id/created_at).
    const insert: Record<string, unknown> = {
      tenant_id: user.tenantId,
      project_id: body.project_id ?? body.projectId ?? null,
      created_by: user.id,
      status: body.status ?? 'Draft',
    };
    if (body.title !== undefined) insert.title = body.title;
    if (body.description !== undefined) insert.description = body.description;
    if (body.amount !== undefined) insert.amount = body.amount;
    if (body.total_amount !== undefined) insert.total_amount = body.total_amount;
    if (body.client_name !== undefined) insert.client_name = body.client_name;
    if (body.client_email !== undefined) insert.client_email = body.client_email;
    if (body.client_company !== undefined) insert.client_company = body.client_company;
    if (body.proposal_number !== undefined) insert.proposal_number = body.proposal_number;
    if (body.pdf_url !== undefined && body.pdf_url !== null) insert.pdf_url = body.pdf_url;
    if (body.notes !== undefined) insert.description = insert.description ?? body.notes;

    const { data, error } = await db.from('proposals').insert(insert).select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, proposal: data });
  } catch (err: unknown) {
    const msg = 'Internal server error';
    console.error('[proposals/create] error:', msg);
    return NextResponse.json({ error: `Failed to create proposal: ${msg}` }, { status: 500 });
  }
}
