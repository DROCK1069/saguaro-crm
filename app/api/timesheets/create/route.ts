import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

/**
 * Timesheet / time-clock create.
 *
 * The mobile field app punches a clock-in here with { project_id, clock_in,
 * gps_clock_in } (snake_case) — see saguaro-mobile app/(tabs)/field.tsx. The
 * row must live in `time_entries`, which is the only table that has real
 * `clock_in` / `clock_out` / `gps_clock_in` / `gps_clock_out` columns and a
 * `status` lifecycle. The companion /timesheets/[id]/status route updates this
 * SAME table on clock-out. Accepts camelCase or snake_case for every field.
 */
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, any> = {};
  try { body = await req.json(); } catch { /* empty body */ }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Accept both casings; honor whatever the caller chose.
    const projectId   = body.project_id   ?? body.projectId   ?? null;
    const clockIn     = body.clock_in     ?? body.clockIn     ?? new Date().toISOString();
    const clockOut    = body.clock_out    ?? body.clockOut    ?? null;
    const gpsClockIn  = body.gps_clock_in ?? body.gpsClockIn  ?? null;
    const gpsClockOut = body.gps_clock_out?? body.gpsClockOut ?? null;
    const workDate    = body.work_date    ?? body.workDate    ?? new Date().toISOString().split('T')[0];
    const status      = body.status       ?? 'active';
    const notes       = body.notes        ?? body.work_description ?? body.workDescription ?? null;
    const costCodeId  = body.cost_code_id ?? body.costCodeId  ?? null;

    // Real `time_entries` columns only (see _schema.txt).
    const row: Record<string, any> = {
      tenant_id:   user.tenantId,
      project_id:  projectId,
      employee_id: user.id,
      created_by:  user.id,
      work_date:   workDate,
      clock_in:    clockIn,
      clock_out:   clockOut,
      gps_clock_in:  gpsClockIn,
      gps_clock_out: gpsClockOut,
      status,
    };
    if (notes != null)      row.work_description = notes;
    if (costCodeId != null) row.cost_code_id = costCodeId;

    const { data, error } = await supabase
      .from('time_entries')
      .insert(row)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, entry: data });
  } catch (err: unknown) {
    const msg = 'Internal server error';
    console.error('[timesheets/create] error:', msg);
    return NextResponse.json(
      { error: `[timesheets/create] Database error: ${msg}` },
      { status: 500 }
    );
  }
}
