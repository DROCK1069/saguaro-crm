import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import type { TablesInsert } from '@/lib/database.types';

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const x = Number(body.x_pct) || 0;
  const y = Number(body.y_pct) || 0;

  const row: TablesInsert<'drawing_pins'> = {
    tenant_id: user.tenantId,
    project_id: String(body.project_id || body.projectId || ''),
    drawing_id: (body.drawing_id || body.drawingId || null) as string | null,
    // x/y are legacy NOT NULL columns — mirror the normalized percentage values
    x,
    y,
    x_pct: x,
    y_pct: y,
    title: String(body.title || ''),
    notes: String(body.note || body.notes || ''),
    pin_type: String(body.category || 'Other'),
  };

  try {
    const db = createServerClient();
    const { data, error } = await db
      .from('drawing_pins')
      .insert(row)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, pin: data });
  } catch (err: unknown) {
    const msg = 'Internal server error';
    console.error('[drawings/pin] error:', msg);
    return NextResponse.json(
      { error: `[drawings/pin] Database error: ${msg}` },
      { status: 500 }
    );
  }
}
