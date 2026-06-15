import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const db = createServerClient();
    // Map every alias the app may send (camelCase or snake_case) onto the real
    // schedule_tasks columns. Only assign a column when a value was actually
    // provided so a partial PUT doesn't null out untouched fields.
    const fields: Record<string, any> = {};
    const name = body.name ?? body.title;
    if (name !== undefined) fields.name = name;
    if (body.phase !== undefined) fields.phase = body.phase;
    if (body.trade !== undefined) fields.trade = body.trade;
    const startDate = body.start_date ?? body.startDate;
    if (startDate !== undefined) fields.start_date = startDate;
    const endDate = body.end_date ?? body.endDate;
    if (endDate !== undefined) fields.end_date = endDate;
    const pctComplete = body.pct_complete ?? body.pctComplete ?? body.percent_complete ?? body.percentComplete;
    if (pctComplete !== undefined) fields.pct_complete = pctComplete;
    if (body.status !== undefined) fields.status = body.status;
    const { error } = await db
      .from('schedule_tasks')
      .update(fields)
      .eq('id', id)
      .eq('tenant_id', user.tenantId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db = createServerClient();
    const { error } = await db
      .from('schedule_tasks')
      .delete()
      .eq('id', id)
      .eq('tenant_id', user.tenantId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
