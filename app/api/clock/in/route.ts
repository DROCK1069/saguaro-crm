import { NextRequest, NextResponse } from 'next/server';
import { getUser, createServerClient } from '@/lib/supabase-server';

/**
 * Clock In — creates a timesheet_entries row with clock_in timestamp.
 * Uses service-role client so the insert passes RLS.
 */
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const db = createServerClient();
    const now = new Date();

    const { data, error } = await db
      .from('timesheet_entries')
      .insert({
        tenant_id:     user.tenantId,
        project_id:    body.projectId || null,
        employee_name: (body.employeeName as string) || user.email || 'Unknown',
        work_date:     now.toISOString().split('T')[0],
        clock_in:      now.toISOString(),
        total_hours:   0,
        status:        'clocked_in',
        cost_code:     'General Conditions',
        notes: JSON.stringify({
          type:      'clock_in',
          latitude:  body.latitude  || null,
          longitude: body.longitude || null,
        }),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      entry: data,
      clockInTime: now.toISOString(),
    });
  } catch (err: unknown) {
    console.error('[clock/in] error:', err);
    return NextResponse.json({ error: 'Clock in failed' }, { status: 500 });
  }
}
