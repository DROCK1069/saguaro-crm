import { NextResponse } from 'next/server';

/**
 * GONE — /api/clock/in has been retired.
 *
 * It wrote clock events into `timesheet_entries` (a third clock table nobody
 * else read) using the ANON key with no user session, so RLS rejected every
 * insert and the server never learned anyone was on the clock. The canonical
 * clock is /api/timeclock/in, which writes `time_entries` and mirrors an audit
 * row into `clock_punches`.
 *
 * The file stays so any stale client gets a real answer instead of a silent
 * 404. Nothing writes clock events to `timesheet_entries` ever again.
 */
export const dynamic = 'force-dynamic';

const gone = () =>
  NextResponse.json(
    { error: 'Moved to /api/timeclock/in' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  );

export async function POST() { return gone(); }
export async function GET() { return gone(); }
