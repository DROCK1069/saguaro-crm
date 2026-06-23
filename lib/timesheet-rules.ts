/**
 * lib/timesheet-rules.ts — overtime calculation, union rate tables, and the
 * multi-level approval state machine for field timecards.
 *
 * Procore parity: daily/weekly/7th-day OT rules, prevailing-wage / union
 * classifications with base + fringe, and a foreman → PM approval chain.
 */

export interface DayEntry { date: string; hours: number }
export interface OTRuleset {
  daily_ot_after: number;     // e.g. 8  → 1.5x
  daily_dt_after: number;     // e.g. 12 → 2x  (0 disables)
  weekly_ot_after: number;    // e.g. 40 → 1.5x
  seventh_day_ot: boolean;    // CA-style: 7th consecutive worked day is OT/DT
}
export const DEFAULT_RULES: OTRuleset = { daily_ot_after: 8, daily_dt_after: 12, weekly_ot_after: 40, seventh_day_ot: false };

export interface HoursBreakdown { regular: number; overtime: number; doubletime: number; total: number }

/** Split a week of day entries into regular / OT / DT hours. */
export function splitHours(days: DayEntry[], rules: OTRuleset = DEFAULT_RULES): HoursBreakdown {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  let regular = 0, overtime = 0, doubletime = 0;
  let weekRegularSoFar = 0;
  let consecutive = 0;
  let prevDate: string | null = null;

  for (const d of sorted) {
    // consecutive-day tracking
    if (prevDate) {
      const gap = (new Date(d.date).getTime() - new Date(prevDate).getTime()) / 86400000;
      consecutive = gap === 1 ? consecutive + 1 : 0;
    }
    prevDate = d.date;

    let reg = 0, ot = 0, dt = 0;
    const h = Math.max(0, d.hours);

    if (rules.seventh_day_ot && consecutive >= 6) {
      // 7th consecutive day: first 8 OT, beyond 8 DT
      ot = Math.min(h, 8);
      dt = Math.max(0, h - 8);
    } else {
      const dtAfter = rules.daily_dt_after || Infinity;
      dt = Math.max(0, h - dtAfter);
      const afterDt = h - dt;
      ot = Math.max(0, afterDt - rules.daily_ot_after);
      reg = afterDt - ot;
    }

    // weekly OT cap: regular hours beyond weekly threshold convert to OT
    if (reg + weekRegularSoFar > rules.weekly_ot_after) {
      const over = reg + weekRegularSoFar - rules.weekly_ot_after;
      const moved = Math.min(reg, over);
      reg -= moved; ot += moved;
    }
    weekRegularSoFar += reg;

    regular += reg; overtime += ot; doubletime += dt;
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return { regular: round(regular), overtime: round(overtime), doubletime: round(doubletime), total: round(regular + overtime + doubletime) };
}

export interface RateClass { classification: string; base_rate: number; fringe_rate: number }
export interface GrossPay { straight: number; ot: number; dt: number; fringe: number; gross: number }

/** Gross pay = reg*base + OT*1.5*base + DT*2*base + fringe*total. */
export function computeGrossPay(b: HoursBreakdown, rate: RateClass): GrossPay {
  const base = rate.base_rate || 0;
  const fringeRate = rate.fringe_rate || 0;
  const straight = b.regular * base;
  const ot = b.overtime * base * 1.5;
  const dt = b.doubletime * base * 2;
  const fringe = b.total * fringeRate;
  const round = (n: number) => Math.round(n * 100) / 100;
  return { straight: round(straight), ot: round(ot), dt: round(dt), fringe: round(fringe), gross: round(straight + ot + dt + fringe) };
}

// ── Approval state machine ──────────────────────────────────────────────
export type TimesheetStatus = 'draft' | 'submitted' | 'foreman_approved' | 'approved' | 'rejected';
export type ApprovalAction = 'submit' | 'foreman_approve' | 'pm_approve' | 'reject' | 'reopen';

const TRANSITIONS: Record<TimesheetStatus, Partial<Record<ApprovalAction, TimesheetStatus>>> = {
  draft: { submit: 'submitted' },
  submitted: { foreman_approve: 'foreman_approved', reject: 'rejected', pm_approve: 'approved' },
  foreman_approved: { pm_approve: 'approved', reject: 'rejected' },
  rejected: { reopen: 'draft', submit: 'submitted' },
  approved: { reopen: 'draft' },
};

export function applyApproval(current: TimesheetStatus, action: ApprovalAction): { ok: boolean; next?: TimesheetStatus; error?: string } {
  const next = TRANSITIONS[current]?.[action];
  if (!next) return { ok: false, error: `Cannot '${action}' from '${current}'` };
  return { ok: true, next };
}
