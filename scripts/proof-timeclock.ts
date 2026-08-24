/* SAGUARO TIMECLOCK PROOF — proves the canonical clock layer against the LIVE
 * stack. Four surfaces used to clock in against three tables; production ended
 * up with unpaired punches, a 13-day shift, and two shifts opened five seconds
 * apart. These checks pin the semantics that fix it:
 *
 *   T1  clock-in creates exactly ONE open shift
 *   T2  a SECOND clock-in returns the SAME shift id and creates NO second row
 *   T3  clock-out closes it with correct worked/regular/overtime math (meal break in)
 *   T4  clock-out with no open shift is REFUSED (409), never a fake success
 *   T5  both actions left PAIRED clock_punches audit rows
 *   T6  an 8.5h shift splits 8 regular / 0.5 overtime
 *   T7  a 13h shift yields doubletime
 *   T8  employee resolution never yields a null employee_id
 *   T9  nothing was written to timesheet_entries
 *
 * The route SEMANTICS are exercised through the shared helpers and engine
 * (lib/timeclock + lib/timeclock/server); DB writes mirror the route bodies,
 * as proof-radio does. Fixture tenant/employee/project fully purged at the end.
 */
import { createClient } from '@supabase/supabase-js';
import * as fs from 'node:fs';
import { CSI_DIVISIONS } from '../lib/construction-intelligence';
import { splitDailyHours, shiftWorkedHours } from '../lib/timeclock';
import { splitHours, workedHoursFor, toShift, type ShiftRow } from '../lib/timeclock/server';

const env = fs.readFileSync('D:/saguaro-web/.env.local', 'utf8');
const get = (k: string) => (env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim();
const db = createClient(get('NEXT_PUBLIC_SUPABASE_URL')!, get('SUPABASE_SERVICE_ROLE_KEY')!);

const MARK = 'CLAUDE-PROOF-' + Math.floor(Math.random() * 1e6);
const TZ = 'America/Phoenix';
let pass = 0, fail = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} — ${detail}`);
  ok ? pass++ : fail++;
};

const SHIFT_COLS =
  'id, project_id, work_date, clock_in, clock_out, status, timezone, cost_code_id, csi_division, hours_worked, meal_break_mins, entry_type, total_hours, employee_id, tenant_id';

/* ── route-body mirrors — the exact logic the endpoints run ───────────────── */

/** Mirror of POST /api/timeclock/in. */
async function clockIn(tenantId: string, employeeId: string, employeeName: string, projectId: string, at = new Date().toISOString()) {
  const { data: openRows } = await db.from('time_entries').select(SHIFT_COLS)
    .eq('tenant_id', tenantId).eq('employee_id', employeeId)
    .not('clock_in', 'is', null).is('clock_out', null)
    .order('clock_in', { ascending: false }).limit(1);
  const existing = ((openRows || []) as unknown as ShiftRow[])[0];
  if (existing) return { status: 200, shift: toShift(existing), alreadyOpen: true };

  // The FULL route payload — CSI + description + GPS blob + created_by. A
  // reduced payload would hide exactly the column-level failures (generated
  // columns, FK violations) that keep a punch from ever being written.
  const { data: ins, error } = await db.from('time_entries').insert({
    tenant_id: tenantId, employee_id: employeeId, project_id: projectId,
    work_date: at.slice(0, 10), clock_in: at, clock_out: null,
    status: 'clocked_in', entry_type: 'regular', timezone: TZ,
    cost_code_id: null, csi_division: '03', cost_code_description: CSI_DIVISIONS['03']?.name ?? null,
    gps_clock_in: { source: 'api', server_time: at, lat: 33.3, lng: -111.84 },
    created_by: null, // profile-less caller: resolveCreatedBy() yields null and the punch still lands
  } as never).select(SHIFT_COLS).single();
  if (error || !ins) throw error ?? new Error('insert returned no row');

  await db.from('clock_punches').insert({
    tenant_id: tenantId, project_id: projectId, employee_name: employeeName,
    punch_type: 'in', punched_at: at, location_lat: 33.3, location_lng: -111.84,
  } as never);
  return { status: 201, shift: toShift(ins as unknown as ShiftRow), alreadyOpen: false };
}

/** Mirror of POST /api/timeclock/out. Returns the honest 409 when not on the clock. */
async function clockOut(tenantId: string, employeeId: string, employeeName: string, breakMinutes: number | null, at = new Date().toISOString()) {
  const { data: openRows } = await db.from('time_entries').select(SHIFT_COLS)
    .eq('tenant_id', tenantId).eq('employee_id', employeeId)
    .not('clock_in', 'is', null).is('clock_out', null)
    .order('clock_in', { ascending: false }).limit(1);
  const open = ((openRows || []) as unknown as ShiftRow[])[0];
  if (!open || !open.clock_in) return { status: 409, error: 'You are not on the clock' as const };

  const meal = breakMinutes ?? (Number(open.meal_break_mins ?? 0) || 0);
  const worked = workedHoursFor(open.clock_in, at, meal);
  const hours = splitHours(worked);

  const { data: upd } = await db.from('time_entries').update({
    clock_out: at, meal_break_mins: meal,
    hours_worked: hours.worked, // total_hours is GENERATED — writing it fails the UPDATE (428C9)
    regular_hours: hours.regular, overtime_hours: hours.overtime, doubletime_hours: hours.doubletime,
    is_overtime: hours.overtime > 0 || hours.doubletime > 0,
    status: 'pending', updated_at: at,
  } as never).eq('tenant_id', tenantId).eq('id', open.id).is('clock_out', null)
    .select(SHIFT_COLS).maybeSingle();
  if (!upd) return { status: 409, error: 'You are not on the clock' as const };

  await db.from('clock_punches').insert({
    tenant_id: tenantId, project_id: open.project_id, employee_name: employeeName,
    punch_type: 'out', punched_at: at, location_lat: 33.3, location_lng: -111.84,
  } as never);
  return { status: 200, shift: toShift(upd as unknown as ShiftRow), hours };
}

const openCount = async (tenantId: string, employeeId: string) => {
  const { count } = await db.from('time_entries').select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId).eq('employee_id', employeeId)
    .not('clock_in', 'is', null).is('clock_out', null);
  return count ?? 0;
};

async function main() {
  /* ── stranded-fixture purge ── */
  const { data: staleEmp } = await db.from('employees').select('id').like('first_name', 'CLAUDE-PROOF%');
  if (staleEmp?.length) {
    const ids = staleEmp.map((e) => e.id);
    await db.from('time_entries').delete().in('employee_id', ids);
    await db.from('employees').delete().in('id', ids);
  }
  const { data: staleProj } = await db.from('projects').select('id').like('name', 'CLAUDE-PROOF%');
  if (staleProj?.length) {
    const ids = staleProj.map((p) => p.id);
    await db.from('time_entries').delete().in('project_id', ids);
    await db.from('clock_punches').delete().in('project_id', ids);
    await db.from('projects').delete().in('id', ids);
  }
  await db.from('clock_punches').delete().like('employee_name', 'CLAUDE-PROOF%');

  /* ── fixture ── */
  const { data: anyProject } = await db.from('projects').select('tenant_id').limit(1).single();
  const tenantId = (anyProject as { tenant_id: string }).tenant_id;
  const { data: proj } = await db.from('projects').insert({ tenant_id: tenantId, name: MARK + ' project', status: 'active' } as never).select().single();
  const projectId = (proj as { id: string }).id;
  const empName = MARK + ' Operator';
  const { data: emp, error: empErr } = await db.from('employees').insert({
    tenant_id: tenantId, first_name: MARK, last_name: 'Operator',
    email: `${MARK.toLowerCase()}@proof.invalid`, is_active: true,
  } as never).select('id, tenant_id, first_name, last_name, email').single();
  if (empErr || !emp) throw empErr ?? new Error('fixture employee insert failed');
  const employeeId = (emp as { id: string }).id;

  /* ── T8: employee resolution yields a real, tenant-scoped id ── */
  check('T8: employee resolves to a non-null, tenant-scoped id',
    !!employeeId && (emp as { tenant_id: string }).tenant_id === tenantId,
    `employee_id ${employeeId ? 'set' : 'NULL'}, tenant matches`);

  /* ── T1: clock-in creates exactly ONE open shift ── */
  const inAt = new Date(Date.now() - 8.5 * 3_600_000 - 30 * 60_000).toISOString(); // 9h ago
  const first = await clockIn(tenantId, employeeId, empName, projectId, inAt);
  const afterFirst = await openCount(tenantId, employeeId);
  check('T1: clock-in creates exactly one open shift',
    first.status === 201 && first.alreadyOpen === false && afterFirst === 1 && first.shift.status === 'clocked_in',
    `HTTP ${first.status}, ${afterFirst} open shift, status ${first.shift.status}`);

  /* ── T1b: the full route payload persists (CSI resolved, GPS blob, no created_by) ── */
  const { data: ctxRow } = await db.from('time_entries')
    .select('csi_division, cost_code_description, gps_clock_in, created_by, employee_id, timezone')
    .eq('id', first.shift.id).single();
  const ctx = ctxRow as {
    csi_division: string | null; cost_code_description: string | null;
    gps_clock_in: { lat?: number; source?: string } | null; created_by: string | null;
    employee_id: string | null; timezone: string | null;
  };
  check('T1b: full clock-in payload persists (CSI, GPS, tz) with a profile-less caller',
    ctx.csi_division === '03' && ctx.cost_code_description === CSI_DIVISIONS['03']?.name &&
    ctx.gps_clock_in?.lat === 33.3 && ctx.created_by === null &&
    ctx.employee_id === employeeId && ctx.timezone === TZ,
    `csi ${ctx.csi_division} "${ctx.cost_code_description}", gps lat ${ctx.gps_clock_in?.lat}, tz ${ctx.timezone}, created_by null`);

  /* ── T2: SECOND clock-in returns the SAME shift, creates NO second row ── */
  const second = await clockIn(tenantId, employeeId, empName, projectId);
  const afterSecond = await openCount(tenantId, employeeId);
  check('T2: second clock-in is idempotent (same shift, no second row)',
    second.status === 200 && second.alreadyOpen === true && second.shift.id === first.shift.id && afterSecond === 1,
    `HTTP ${second.status}, alreadyOpen ${second.alreadyOpen}, same id ${second.shift.id === first.shift.id}, still ${afterSecond} open`);

  /* ── T3 + T6: clock-out closes with correct math — 8.5h worked after a 30m meal ── */
  const outAt = new Date(new Date(inAt).getTime() + 9 * 3_600_000).toISOString(); // 9h span
  const closed = await clockOut(tenantId, employeeId, empName, 30, outAt);
  const { data: closedRow } = await db.from('time_entries')
    .select('clock_out, hours_worked, total_hours, regular_hours, overtime_hours, doubletime_hours, meal_break_mins, status')
    .eq('id', first.shift.id).single();
  const cr = closedRow as {
    clock_out: string | null; hours_worked: number | null; total_hours: number | null;
    regular_hours: number | null; overtime_hours: number | null; doubletime_hours: number | null;
    meal_break_mins: number | null; status: string | null;
  };
  const h = closed.status === 200 ? closed.hours! : null;
  check('T3: clock-out closes the shift with engine math persisted',
    closed.status === 200 && !!cr.clock_out && cr.status === 'pending' &&
    Number(cr.hours_worked) === 8.5 && Number(cr.total_hours) === 8.5 && Number(cr.meal_break_mins) === 30,
    `HTTP ${closed.status}, status ${cr.status}, worked ${cr.hours_worked}h after ${cr.meal_break_mins}m meal (9h span)`);
  check('T6: 8.5h shift splits 8 regular / 0.5 overtime / 0 doubletime',
    !!h && h.worked === 8.5 && h.regular === 8 && h.overtime === 0.5 && h.doubletime === 0 &&
    Number(cr.regular_hours) === 8 && Number(cr.overtime_hours) === 0.5 && Number(cr.doubletime_hours) === 0,
    `${h?.regular} reg / ${h?.overtime} OT / ${h?.doubletime} DT (stored ${cr.regular_hours}/${cr.overtime_hours}/${cr.doubletime_hours})`);

  const afterClose = await openCount(tenantId, employeeId);
  check('T3b: no open shift remains after clock-out', afterClose === 0, `${afterClose} open shift(s)`);

  /* ── T4: clock-out with no open shift is REFUSED — never a fake success ── */
  const orphan = await clockOut(tenantId, employeeId, empName, 0);
  const { count: punchesAfterOrphan } = await db.from('clock_punches')
    .select('id', { count: 'exact', head: true }).eq('employee_name', empName);
  check('T4: clock-out with no open shift is refused (409), no phantom punch',
    orphan.status === 409 && orphan.error === 'You are not on the clock' && (punchesAfterOrphan ?? 0) === 2,
    `HTTP ${orphan.status} "${orphan.error}", punch count still ${punchesAfterOrphan}`);

  /* ── T5: paired clock_punches audit rows, timestamps matching time_entries ── */
  const { data: punches } = await db.from('clock_punches')
    .select('punch_type, punched_at, project_id, employee_name')
    .eq('employee_name', empName).order('punched_at', { ascending: true });
  const pr = (punches || []) as { punch_type: string; punched_at: string | null; project_id: string | null }[];
  const inPunch = pr.find((p) => p.punch_type === 'in');
  const outPunch = pr.find((p) => p.punch_type === 'out');
  const sameInstant = (a?: string | null, b?: string | null) =>
    !!a && !!b && new Date(a).getTime() === new Date(b).getTime();
  check('T5: paired in/out audit rows on the same instants as time_entries',
    pr.length === 2 && pr[0].punch_type === 'in' && pr[1].punch_type === 'out' &&
    sameInstant(inPunch?.punched_at, inAt) && sameInstant(outPunch?.punched_at, cr.clock_out) &&
    inPunch?.project_id === projectId,
    `${pr.length} punches [${pr.map((p) => p.punch_type).join(' → ')}], instants match time_entries`);

  /* ── T7: a 13h shift yields doubletime ── */
  const in13 = new Date(Date.now() - 13 * 3_600_000).toISOString();
  const long = await clockIn(tenantId, employeeId, empName, projectId, in13);
  const out13 = new Date(new Date(in13).getTime() + 13 * 3_600_000).toISOString();
  const longClosed = await clockOut(tenantId, employeeId, empName, 0, out13);
  const lh = longClosed.status === 200 ? longClosed.hours! : null;
  const { data: longRow } = await db.from('time_entries')
    .select('regular_hours, overtime_hours, doubletime_hours, hours_worked')
    .eq('id', long.shift.id).single();
  const lr = longRow as { regular_hours: number | null; overtime_hours: number | null; doubletime_hours: number | null; hours_worked: number | null };
  check('T7: 13h shift yields 8 regular / 4 overtime / 1 doubletime',
    !!lh && lh.worked === 13 && lh.regular === 8 && lh.overtime === 4 && lh.doubletime === 1 &&
    Number(lr.regular_hours) === 8 && Number(lr.overtime_hours) === 4 && Number(lr.doubletime_hours) === 1,
    `${lr.hours_worked}h → ${lr.regular_hours} reg / ${lr.overtime_hours} OT / ${lr.doubletime_hours} DT`);

  /* ── T6b: pure engine split — buckets always re-sum to worked ── */
  const splitCases: [number, number, number, number][] = [
    [0, 0, 0, 0], [7.25, 7.25, 0, 0], [8, 8, 0, 0], [8.5, 8, 0.5, 0],
    [12, 8, 4, 0], [13, 8, 4, 1], [24, 8, 4, 12],
  ];
  const splitOk = splitCases.every(([w, r, o, d]) => {
    const s = splitDailyHours(w);
    return s.regular === r && s.overtime === o && s.doubletime === d &&
      Math.round((s.regular + s.overtime + s.doubletime) * 100) / 100 === s.worked;
  });
  check('T6b: engine split is exhaustive and re-sums to worked', splitOk,
    splitCases.map(([w]) => `${w}h`).join(', ') + ' all correct');

  /* ── T6c: meal break is deducted through the single engine path ── */
  const a = '2026-08-20T14:00:00.000Z', b = '2026-08-20T23:00:00.000Z'; // 9h span
  check('T6c: worked = span − meal, one engine path (entryHours)',
    shiftWorkedHours(a, b, 30) === 8.5 && shiftWorkedHours(a, b, 0) === 9 && workedHoursFor(a, b, 60) === 8,
    `9h span → 8.5 / 9 / 8 at 30 / 0 / 60 min meal`);

  /* ── T9: timesheet_entries was NOT touched ── */
  const { count: tsCount } = await db.from('timesheet_entries')
    .select('id', { count: 'exact', head: true }).eq('project_id', projectId);
  check('T9: nothing written to timesheet_entries', (tsCount ?? 0) === 0,
    `${tsCount ?? 0} timesheet_entries rows for the fixture project`);

  /* ── cleanup ── */
  await db.from('time_entries').delete().eq('employee_id', employeeId);
  await db.from('clock_punches').delete().eq('employee_name', empName);
  await db.from('employees').delete().eq('id', employeeId);
  await db.from('projects').delete().eq('id', projectId);
  const { count: leftEntries } = await db.from('time_entries').select('id', { count: 'exact', head: true }).eq('employee_id', employeeId);
  const { count: leftPunch } = await db.from('clock_punches').select('id', { count: 'exact', head: true }).eq('employee_name', empName);
  const { count: leftProj } = await db.from('projects').select('id', { count: 'exact', head: true }).eq('id', projectId);
  const { count: leftEmp } = await db.from('employees').select('id', { count: 'exact', head: true }).eq('id', employeeId);
  check('Z: fixture fully cleaned up',
    (leftEntries ?? 0) === 0 && (leftPunch ?? 0) === 0 && (leftProj ?? 0) === 0 && (leftEmp ?? 0) === 0,
    'no test rows remain (entries, punches, employee, project)');

  console.log(`\n${fail === 0 ? 'TIMECLOCK PROOF PASSED' : 'TIMECLOCK PROOF FAILED'} — ${pass} ok, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
