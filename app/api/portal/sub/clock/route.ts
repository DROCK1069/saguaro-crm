import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

/**
 * Saguaro sub portal — CLOCK PUNCHES.
 *
 * Before this route existed the portal's Clock In / Clock Out buttons were
 * theater: they set React state, toasted "Clocked in successfully", and stored
 * nothing. A sub who clocked in and never got around to filing a daily log left
 * no record at all.
 *
 * Subs are not `employees` rows, so their punches land in `clock_punches` — the
 * name-keyed audit trail the geofence feature and the daily-log crew count
 * already read. Payroll's `time_entries` is deliberately untouched: a portal sub
 * is not on the GC's payroll.
 *
 *   GET  ?token=  -> { onClock, lastPunch, punches } for today
 *   POST ?token=  { type: 'in'|'out', lat?, lng?, address? } -> { ok, punch, onClock }
 *
 * Server decides `onClock` from the punch trail — never the client. Clocking in
 * twice in a row is refused honestly (409) rather than writing an unpaired
 * punch, which is exactly how the pre-fix clock produced five consecutive 'out'
 * punches with no 'in' between them.
 */

async function authenticateSubPortal(req: NextRequest) {
  const token =
    req.nextUrl.searchParams.get('token') ||
    req.headers.get('x-portal-token');
  if (!token) return null;
  const db = createServerClient() as any;
  const { data: session } = await db
    .from('portal_sub_sessions')
    .select('*')
    .eq('token', token)
    .eq('status', 'active')
    .single();
  return session ? { db, session } : null;
}

/** Who the punch is attributed to — the sub's company is their identity here. */
function punchName(session: any): string {
  return String(session.sub_company || session.sub_name || 'Subcontractor').slice(0, 120);
}

/** Local-day window for "today's" punches, in the server's timezone. */
function todayWindow() {
  const now = new Date();
  const day = now.toISOString().split('T')[0];
  return { from: `${day}T00:00:00.000Z`, to: `${day}T23:59:59.999Z`, day };
}

async function punchesToday(db: any, session: any) {
  const { from, to } = todayWindow();
  const { data } = await db
    .from('clock_punches')
    .select('id, punch_type, punched_at, location_lat, location_lng, location_address')
    .eq('tenant_id', session.tenant_id)
    .eq('project_id', session.project_id)
    .eq('employee_name', punchName(session))
    .gte('punched_at', from)
    .lte('punched_at', to)
    .order('punched_at', { ascending: true });
  return (data ?? []) as any[];
}

export async function GET(req: NextRequest) {
  const a = await authenticateSubPortal(req);
  if (!a) return NextResponse.json({ error: 'Invalid or expired portal token' }, { status: 401 });
  try {
    const punches = await punchesToday(a.db, a.session);
    const last = punches.length ? punches[punches.length - 1] : null;
    return NextResponse.json({
      onClock: last?.punch_type === 'in',
      lastPunch: last,
      punches,
    });
  } catch {
    return NextResponse.json({ error: 'Could not read the clock' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const a = await authenticateSubPortal(req);
  if (!a) return NextResponse.json({ error: 'Invalid or expired portal token' }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const type = body?.type === 'out' ? 'out' : body?.type === 'in' ? 'in' : null;
  if (!type) {
    return NextResponse.json({ error: "type must be 'in' or 'out'" }, { status: 400 });
  }

  try {
    // Server-side state: the last punch of the day decides what is legal next.
    const punches = await punchesToday(a.db, a.session);
    const last = punches.length ? punches[punches.length - 1] : null;
    const onClock = last?.punch_type === 'in';

    if (type === 'in' && onClock) {
      return NextResponse.json(
        { error: 'You are already clocked in', onClock: true, lastPunch: last },
        { status: 409 },
      );
    }
    if (type === 'out' && !onClock) {
      return NextResponse.json(
        { error: 'You are not clocked in', onClock: false, lastPunch: last },
        { status: 409 },
      );
    }

    const lat = Number.isFinite(Number(body?.lat)) ? Number(body.lat) : null;
    const lng = Number.isFinite(Number(body?.lng)) ? Number(body.lng) : null;

    const { data: punch, error } = await a.db
      .from('clock_punches')
      .insert({
        tenant_id: a.session.tenant_id,
        project_id: a.session.project_id,
        employee_name: punchName(a.session),
        punch_type: type,
        location_lat: lat,
        location_lng: lng,
        location_address: body?.address ? String(body.address).slice(0, 300) : null,
        punched_at: new Date().toISOString(),
      } as never)
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ ok: true, punch, onClock: type === 'in' }, { status: 201 });
  } catch (e: any) {
    console.error('[portal/sub/clock] punch failed:', e?.message ?? e);
    return NextResponse.json({ error: "Couldn't record the punch — try again" }, { status: 500 });
  }
}
