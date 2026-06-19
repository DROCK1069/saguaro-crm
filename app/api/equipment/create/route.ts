import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const row = {
    tenant_id: user.tenantId,
    project_id: (body.project_id || body.projectId || null) as string | null,
    equipment_name: String(body.equipment_name || body.equipmentName || ''),
    operator: String(body.operator || ''),
    hours: Number(body.hours || body.hours_used || body.hoursUsed) || 0,
    condition: String(body.condition || 'Good'),
    notes: String(body.notes || ''),
    log_date: String(
      body.log_date ||
        body.work_date ||
        body.workDate ||
        new Date().toISOString().split('T')[0]
    ),
  };

  try {
    const db = createServerClient();
    const { data, error } = await db
      .from('equipment_log')
      .insert(row)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, entry: data });
  } catch (err: unknown) {
    const msg = 'Internal server error';
    console.error('[equipment/create] error:', msg);
    return NextResponse.json(
      { error: `[equipment/create] Database error: ${msg}` },
      { status: 500 }
    );
  }
}
