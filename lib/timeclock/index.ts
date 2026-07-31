/**
 * Time Clock engine — deterministic, timezone-correct hours/overtime/timesheet math.
 * Shared AS-IS by web + iOS. Mirrors lib/finance / lib/takeoff / lib/bidleveling.
 *
 * Every entry stores its own IANA timezone (captured at clock-in), so days and weeks
 * bucket correctly no matter where the crew clocked in. Regular hours are computed
 * from clock_in/clock_out minus breaks; PTO/sick/holiday carry explicit hours.
 */

export type EntryType = 'regular' | 'overtime' | 'pto' | 'sick' | 'holiday' | 'vacation' | 'bereavement' | 'unpaid';

export interface TimeEntry {
  id: string;
  employeeId: string;
  projectId?: string;
  projectName?: string;
  costCode?: string;
  type: EntryType;
  clockIn?: string;   // ISO 8601 (with offset) — for 'regular'
  clockOut?: string;  // ISO 8601; absent = still open
  breakMinutes?: number;
  hours?: number;     // explicit hours for non-clock types (pto/sick/holiday…)
  timezone: string;   // IANA, e.g. 'America/Phoenix'
  notes?: string;
}

export interface TimeclockOptions {
  weeklyOtThreshold?: number;   // default 40
  dailyOtThreshold?: number;    // default 0 = off (set 8 for CA-style daily OT)
  roundMinutes?: number;        // round each entry to nearest N minutes (default 0 = off)
  weekStartsOn?: number;        // 0=Sun (default), 1=Mon
}

const PAID = new Set<EntryType>(['regular', 'overtime', 'pto', 'sick', 'holiday', 'vacation', 'bereavement']);
const isWorked = (t: EntryType) => t === 'regular' || t === 'overtime';

/** YYYY-MM-DD for an instant, in the given IANA timezone (deterministic). */
export function dayKey(iso: string, tz: string): string {
  const d = new Date(iso);
  try {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
    const y = p.find((x) => x.type === 'year')!.value, m = p.find((x) => x.type === 'month')!.value, day = p.find((x) => x.type === 'day')!.value;
    return `${y}-${m}-${day}`;
  } catch { return iso.slice(0, 10); }
}

/** Raw worked/paid hours for one entry (before OT split). Open entries → 0. */
export function entryHours(e: TimeEntry, roundMinutes = 0): number {
  let mins: number;
  if (isWorked(e.type)) {
    if (!e.clockIn || !e.clockOut) return 0;
    mins = (new Date(e.clockOut).getTime() - new Date(e.clockIn).getTime()) / 60000 - (e.breakMinutes || 0);
    if (!(mins > 0)) return 0;
  } else {
    mins = (typeof e.hours === 'number' ? e.hours : 8) * 60;
  }
  if (roundMinutes > 0) mins = Math.round(mins / roundMinutes) * roundMinutes;
  return Math.round((mins / 60) * 100) / 100;
}

/** ISO week-start date key for grouping (in the entry's tz), honoring weekStartsOn. */
export function weekKey(iso: string, tz: string, weekStartsOn = 0): string {
  const dk = dayKey(iso, tz);            // YYYY-MM-DD in tz
  const [y, m, d] = dk.split('-').map(Number);
  const noon = new Date(Date.UTC(y, m - 1, d, 12)); // noon UTC avoids DST edge flips
  const dow = noon.getUTCDay();
  const back = (dow - weekStartsOn + 7) % 7;
  noon.setUTCDate(noon.getUTCDate() - back);
  return `${noon.getUTCFullYear()}-${String(noon.getUTCMonth() + 1).padStart(2, '0')}-${String(noon.getUTCDate()).padStart(2, '0')}`;
}

export interface DayRow { date: string; hours: number; worked: number; entryIds: string[] }
export interface WeekRow { weekStart: string; workedHours: number; regularHours: number; overtimeHours: number; paidHours: number; byType: Record<string, number>; byProject: Record<string, number>; days: DayRow[] }
export interface Timesheet {
  weeks: WeekRow[];
  totals: { workedHours: number; regularHours: number; overtimeHours: number; paidHours: number; byType: Record<string, number>; byProject: Record<string, number> };
  openEntries: number;
}

const r2 = (n: number) => Math.round((n || 0) * 100) / 100;

export function computeTimesheet(entries: TimeEntry[], opts: TimeclockOptions = {}): Timesheet {
  const wk = opts.weeklyOtThreshold ?? 40;
  const dailyOt = opts.dailyOtThreshold ?? 0;
  const round = opts.roundMinutes ?? 0;
  const wStart = opts.weekStartsOn ?? 0;

  // bucket entries → week → day
  const weeks = new Map<string, Map<string, { hours: number; worked: number; ids: string[]; byType: Record<string, number>; byProject: Record<string, number> }>>();
  let openEntries = 0;
  for (const e of entries) {
    const anchor = e.clockIn || e.clockOut;
    if (isWorked(e.type) && (!e.clockIn || !e.clockOut)) { if (e.clockIn && !e.clockOut) openEntries++; if (!e.clockIn) continue; }
    if (!anchor) continue;
    const h = entryHours(e, round);
    const w = weekKey(anchor, e.timezone, wStart);
    const d = dayKey(anchor, e.timezone);
    if (!weeks.has(w)) weeks.set(w, new Map());
    const days = weeks.get(w)!;
    if (!days.has(d)) days.set(d, { hours: 0, worked: 0, ids: [], byType: {}, byProject: {} });
    const day = days.get(d)!;
    day.ids.push(e.id);
    if (PAID.has(e.type)) day.hours += h;
    if (isWorked(e.type)) day.worked += h;
    day.byType[e.type] = r2((day.byType[e.type] || 0) + h);
    const pk = e.projectName || e.projectId || 'Unassigned';
    if (isWorked(e.type)) day.byProject[pk] = r2((day.byProject[pk] || 0) + h);
  }

  const weekRows: WeekRow[] = [];
  const totals = { workedHours: 0, regularHours: 0, overtimeHours: 0, paidHours: 0, byType: {} as Record<string, number>, byProject: {} as Record<string, number> };

  for (const [weekStart, days] of [...weeks.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const dayRows: DayRow[] = [];
    let workedWeek = 0, paidWeek = 0, dailyOtWeek = 0;
    const byType: Record<string, number> = {}, byProject: Record<string, number> = {};
    for (const [date, d] of [...days.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      dayRows.push({ date, hours: r2(d.hours), worked: r2(d.worked), entryIds: d.ids });
      workedWeek += d.worked; paidWeek += d.hours;
      if (dailyOt > 0 && d.worked > dailyOt) dailyOtWeek += d.worked - dailyOt;
      for (const [k, v] of Object.entries(d.byType)) byType[k] = r2((byType[k] || 0) + v);
      for (const [k, v] of Object.entries(d.byProject)) byProject[k] = r2((byProject[k] || 0) + v);
    }
    // OT = daily OT already counted, plus weekly excess of the remaining (non-daily-OT) worked hours over the weekly threshold.
    const weeklyExcess = Math.max(0, (workedWeek - dailyOtWeek) - wk);
    const ot = r2(dailyOtWeek + weeklyExcess);
    const reg = r2(workedWeek - ot);
    weekRows.push({ weekStart, workedHours: r2(workedWeek), regularHours: reg, overtimeHours: ot, paidHours: r2(paidWeek), byType, byProject, days: dayRows });
    totals.workedHours = r2(totals.workedHours + workedWeek);
    totals.regularHours = r2(totals.regularHours + reg);
    totals.overtimeHours = r2(totals.overtimeHours + ot);
    totals.paidHours = r2(totals.paidHours + paidWeek);
    for (const [k, v] of Object.entries(byType)) totals.byType[k] = r2((totals.byType[k] || 0) + v);
    for (const [k, v] of Object.entries(byProject)) totals.byProject[k] = r2((totals.byProject[k] || 0) + v);
  }

  return { weeks: weekRows, totals, openEntries };
}

/** Elapsed hours for an OPEN entry, as of `nowIso` — for a live clock readout. */
export function liveElapsed(clockIn: string, nowIso: string, breakMinutes = 0): number {
  const mins = (new Date(nowIso).getTime() - new Date(clockIn).getTime()) / 60000 - breakMinutes;
  return mins > 0 ? Math.round((mins / 60) * 100) / 100 : 0;
}

export const fmtHours = (h: number) => `${Math.floor(h)}h ${Math.round((h - Math.floor(h)) * 60)}m`;
