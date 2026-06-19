import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import type { TablesInsert } from '@/lib/database.types';

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: Record<string, unknown> = {};
  try {
    body = await req.json().catch(() => ({}));
    const db = createServerClient();

    // The page POSTs { projectId, status, inspector, permit_type, number,
    // authority, fee, applied_date, issued_date, expiry_date }. Map the page's
    // field names onto real permits columns, scope to tenant, and drop fields
    // with no column (inspector). `number`->permit_number, `authority`->issuing_authority.
    const insert: Record<string, unknown> = {
      tenant_id: user.tenantId,
      project_id: body.project_id ?? body.projectId ?? null,
      created_by: user.id,
      status: body.status ?? 'applied',
    };
    if (body.permit_type !== undefined) insert.permit_type = body.permit_type;
    if (body.permit_number !== undefined) insert.permit_number = body.permit_number;
    else if (body.number !== undefined) insert.permit_number = body.number;
    if (body.issuing_authority !== undefined) insert.issuing_authority = body.issuing_authority;
    else if (body.authority !== undefined) insert.issuing_authority = body.authority;
    if (body.fee !== undefined) insert.fee = body.fee;
    if (body.applied_date !== undefined && body.applied_date !== '') insert.applied_date = body.applied_date;
    if (body.issued_date !== undefined && body.issued_date !== '') insert.issued_date = body.issued_date;
    if (body.expiry_date !== undefined && body.expiry_date !== '') insert.expiry_date = body.expiry_date;
    if (body.notes !== undefined) insert.notes = body.notes;

    const { data, error } = await db.from('permits').insert(insert as TablesInsert<'permits'>).select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, permit: data });
  } catch (err: unknown) {
    const msg = 'Internal server error';
    console.error('[permits/create] error:', msg);
    return NextResponse.json({ error: `Failed to create permit: ${msg}` }, { status: 500 });
  }
}
