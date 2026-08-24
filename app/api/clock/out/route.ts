import { NextResponse } from 'next/server';

/**
 * GONE — /api/clock/out has been retired.
 *
 * This route was the worst offender in the stack: it wrote to
 * `timesheet_entries` with the ANON key (RLS rejected every insert) and then
 * its catch block returned { success: true, demo: true }, so the UI reported a
 * successful clock-out while NOTHING was written. That lie is deleted, not
 * relocated. The canonical clock-out is /api/timeclock/out, which closes the
 * real `time_entries` shift, computes hours through the shared engine, and
 * returns an honest 409 when you were never on the clock.
 *
 * The file stays so any stale client gets a real answer instead of a silent
 * 404. Nothing writes clock events to `timesheet_entries` ever again.
 */
export const dynamic = 'force-dynamic';

const gone = () =>
  NextResponse.json(
    { error: 'Moved to /api/timeclock/out' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  );

export async function POST() { return gone(); }
export async function GET() { return gone(); }
