import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const db = createServerClient();

    const tenantId = user.tenantId;

    // Structured field-log data (was dropped before — only a scalar crew_count survived).
    const manpower = Array.isArray(body.manpowerByTrade ?? body.manpower_by_trade) ? (body.manpowerByTrade ?? body.manpower_by_trade) : null;
    const equipmentOnSite = Array.isArray(body.equipmentOnSite ?? body.equipment_on_site) ? (body.equipmentOnSite ?? body.equipment_on_site) : null;
    const deliveriesIn = Array.isArray(body.deliveries) ? body.deliveries : [];
    // Roll crew_count up from the manpower lines when present, else trust the scalar.
    const crewFromManpower = manpower ? manpower.reduce((s: number, m: any) => s + (Number(m.count ?? m.headcount ?? m.workers ?? 0) || 0), 0) : null;

    const { data: log, error } = await db.from('daily_logs').insert({
      tenant_id: tenantId,
      project_id: body.projectId,
      log_date: body.logDate || new Date().toISOString().split('T')[0],
      weather: body.weather || null,
      high_temp: body.temperatureHigh || null,
      low_temp: body.temperatureLow || null,
      crew_count: crewFromManpower ?? body.crewCount ?? 0,
      work_performed: body.workPerformed || '',
      delays: body.delays || '',
      safety_notes: body.safetyNotes || '',
      materials_delivered: body.materialsDelivered || '',
      visitors: body.visitors || '',
      notes: body.notes || '',
      // Structured columns (jsonb / text[]) — persisted when the client sends them.
      manpower_by_trade: manpower,
      equipment_on_site: equipmentOnSite,
      equipment_hours: body.equipmentHours ?? body.equipment_hours ?? null,
      materials_received: body.materialsReceived ?? body.materials_received ?? null,
      subcontractors_on_site: Array.isArray(body.subcontractorsOnSite ?? body.subcontractors_on_site) ? (body.subcontractorsOnSite ?? body.subcontractors_on_site) : null,
      created_by: user?.id,
    } as never).select().single();

    if (error) throw error;

    // Deliveries are their own child table (project-scoped). Persist any provided.
    if (deliveriesIn.length > 0) {
      await db.from('deliveries').insert(deliveriesIn.map((d: any) => ({
        tenant_id: tenantId,
        project_id: body.projectId,
        item_name: d.itemName ?? d.item_name ?? '',
        vendor: d.vendor ?? null,
        quantity: d.quantity ?? null,
        received_by: d.receivedBy ?? d.received_by ?? null,
        notes: d.notes ?? null,
        delivered_at: d.deliveredAt ?? d.delivered_at ?? new Date().toISOString(),
      })) as never).then(({ error: delErr }) => { if (delErr) console.error('[daily-logs/create] deliveries insert:', delErr.message); });
    }

    return NextResponse.json({ success: true, log });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
