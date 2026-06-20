import { NextRequest, NextResponse } from 'next/server';
import { getUser, createServerClient } from '@/lib/supabase-server';

/**
 * Clock Out — finds the open clock-in entry and updates it with
 * clock_out + total_hours + status='completed'. If no open entry
 * exists, creates a standalone completed entry.
 */
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body */ }

  try {
    const db = createServerClient();
    const now = new Date();
    const clockInTime = body.clockInTime ? new Date(body.clockInTime as string) : now;
    const breakMs     = ((body.breakMinutes as number) || 0) * 60_000;
    const rawMs       = now.getTime() - clockInTime.getTime();
    const hoursWorked = Math.max(0, Math.round(((rawMs - breakMs) / 3_600_000) * 100) / 100);

    // Try to find and update the matching clock-in entry
    const { data: existing } = await db
      .from('timesheet_entries')
      .select('id')
      .eq('tenant_id', user.tenantId)
      .eq('status', 'clocked_in')
      .order('clock_in', { ascending: false })
      .limit(1)
      .maybeSingle();

    let data;
    if (existing) {
      const { data: updated, error } = await db
        .from('timesheet_entries')
        .update({
          clock_out:   now.toISOString(),
          total_hours: hoursWorked,
          status:      'completed',
          notes: JSON.stringify({
            type:          'clock_out',
            clock_in_time: body.clockInTime,
            clock_out_time: now.toISOString(),
            latitude:      body.latitude  || null,
            longitude:     body.longitude || null,
            break_minutes: body.breakMinutes || 0,
          }),
        })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      data = updated;
    } else {
      const { data: created, error } = await db
        .from('timesheet_entries')
        .insert({
          tenant_id:     user.tenantId,
          project_id:    body.projectId || null,
          employee_name: (body.employeeName as string) || user.email || 'Unknown',
          work_date:     now.toISOString().split('T')[0],
          clock_in:      clockInTime.toISOString(),
          clock_out:     now.toISOString(),
          total_hours:   hoursWorked,
          status:        'completed',
          cost_code:     (body.costCode as string) || 'General Conditions',
          notes: JSON.stringify({
            type:           'clock_out',
            clock_in_time:  body.clockInTime,
            clock_out_time: now.toISOString(),
            latitude:       body.latitude  || null,
            longitude:      body.longitude || null,
            break_minutes:  body.breakMinutes || 0,
          }),
        })
        .select()
        .single();
      if (error) throw error;
      data = created;
    }

    return NextResponse.json({
      success: true,
      entry: data,
      hoursWorked,
      clockOutTime: now.toISOString(),
    });
  } catch (err: unknown) {
    console.error('[clock/out] error:', err);
    const clockInTime = body.clockInTime ? new Date(body.clockInTime as string) : null;
    const breakMs     = ((body.breakMinutes as number) || 0) * 60_000;
    const hoursWorked = clockInTime
      ? Math.max(0, Math.round(((Date.now() - clockInTime.getTime() - breakMs) / 3_600_000) * 100) / 100)
      : 0;
    return NextResponse.json({
      success: true,
      hoursWorked,
      clockOutTime: new Date().toISOString(),
      demo: true,
    });
  }
}
