import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import type { Database } from '@/lib/database.types';

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const entityType = String(body.entity_type || body.entityType || '').toLowerCase();
  const entityId = (body.entity_id || body.entityId) ? String(body.entity_id || body.entityId) : '';

  const row = {
    tenant_id: user.tenantId,
    project_id: body.project_id || body.projectId || null,
    drawing_id: body.drawing_id || body.drawingId || null,
    x_pct: Number(body.x_pct) || 0,
    y_pct: Number(body.y_pct) || 0,
    // x/y are NOT NULL legacy columns — set them from the normalized coords
    // (this also fixes pins silently failing to persist server-side).
    x: Number(body.x_pct) || 0,
    y: Number(body.y_pct) || 0,
    title: body.title || '',
    notes: body.note || body.notes || '',
    pin_type: body.category || 'Other',
    // Link the pin to a real record (RFI / punch / observation / daily log).
    entity_type: entityType || null,
    entity_id: entityId || null,
    rfi_id: entityType === 'rfi' && entityId ? entityId : null,
    punch_item_id: entityType === 'punch' && entityId ? entityId : null,
    daily_log_id: entityType === 'daily_log' && entityId ? entityId : null,
  };

  try {
    const db = createServerClient();
    const { data, error } = await db
      .from('drawing_pins')
      .insert(row as Database['public']['Tables']['drawing_pins']['Insert'])
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
