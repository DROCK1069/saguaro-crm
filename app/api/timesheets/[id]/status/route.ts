import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

/**
 * Timesheet / time-clock status transition.
 *
 * Updates the SAME `time_entries` row that /timesheets/create inserted (the
 * mobile field clock-in/out flow). On a clock-out transition the app PATCHes
 * { status: 'submitted' }; we stamp clock_out then. Accepts camelCase or
 * snake_case. The `approved` branch (web approval) is preserved.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({} as Record<string, any>));
    const status = body.status ?? body.Status;
    if (!status) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 });
    }

    const db = createServerClient();
    const updatePayload: Record<string, any> = { status };

    // A submitted/completed transition is the clock-out punch — stamp the
    // out time (and gps) onto the running entry unless the caller supplied one.
    if (status === 'submitted' || status === 'completed' || status === 'clocked_out') {
      updatePayload.clock_out = body.clock_out ?? body.clockOut ?? new Date().toISOString();
      const gpsOut = body.gps_clock_out ?? body.gpsClockOut;
      if (gpsOut != null) updatePayload.gps_clock_out = gpsOut;
    }
    if (status === 'approved') {
      updatePayload.approved_by = user.id;
      updatePayload.approved_at = new Date().toISOString();
    }

    const { error } = await db
      .from('time_entries')
      .update(updatePayload)
      .eq('id', id)
      .eq('tenant_id', user.tenantId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
