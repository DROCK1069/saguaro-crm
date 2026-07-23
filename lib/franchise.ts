/**
 * lib/franchise.ts — Franchise Rollout scoring engines.
 * Pure, deterministic. Turns raw procurement/risk rows into the red/yellow/green
 * triage a remote multi-site operator needs. Mirrors lib/portfolio-health.ts so
 * the whole Command Center suite reads as one system.
 */

export type Severity = 'green' | 'yellow' | 'red';

const DAY = 86400000;
const today = (nowMs?: number) => nowMs ?? Date.parse(new Date().toISOString().slice(0, 10));
const parse = (v: any): number | null => {
  if (!v) return null;
  const t = Date.parse(String(v));
  return isNaN(t) ? null : t;
};
const daysFromNow = (v: any, nowMs?: number): number | null => {
  const t = parse(v);
  return t === null ? null : Math.round((t - today(nowMs)) / DAY);
};
export const num = (v: any): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[$,]/g, ''));
  return isNaN(n) ? null : n;
};

/* ── Long-Lead procurement ─────────────────────────────────────────── */

export interface LongLeadHealth {
  severity: Severity;
  state: 'delivered' | 'late' | 'order-now' | 'at-risk' | 'on-track' | 'unknown';
  label: string;
  orderByDate: string | null;   // needed_by − lead_time: the drop-dead order date
  daysToOrderBy: number | null;
  daysToNeeded: number | null;
  eta: string | null;           // best available delivery estimate
}

const DELIVERED = /deliver|receiv|complete|closed|installed|on.?site/i;
const ORDERED = /order|ship|transit|production|manufactur|progress|confirm|po.?issued/i;

export function computeLongLead(it: Record<string, any>, nowMs?: number): LongLeadHealth {
  const status = String(it.status || '');
  const isDelivered = DELIVERED.test(status) || !!it.received_date || (num(it.received_qty) ?? 0) > 0;
  const isOrdered = isDelivered || ORDERED.test(status);

  const needed = it.needed_by_date || null;
  const lead = num(it.lead_time_days);
  let orderByDate: string | null = null;
  if (needed && lead !== null) {
    orderByDate = new Date(parse(needed)! - lead * DAY).toISOString().slice(0, 10);
  }
  const daysToNeeded = daysFromNow(needed, nowMs);
  const daysToOrderBy = daysFromNow(orderByDate, nowMs);
  const eta = it.expected_delivery_date || it.delivery_appointment || it.expected_ship_date || null;
  const etaDays = daysFromNow(eta, nowMs);

  if (isDelivered) {
    return { severity: 'green', state: 'delivered', label: 'Delivered', orderByDate, daysToOrderBy, daysToNeeded, eta };
  }
  // ETA lands after it's needed on site → will slip the schedule.
  if (needed && etaDays !== null && daysToNeeded !== null && etaDays > daysToNeeded) {
    return { severity: 'red', state: 'late', label: 'ETA after need-by', orderByDate, daysToOrderBy, daysToNeeded, eta };
  }
  // Not ordered and the order-by date is here/past → order right now or it's already blown.
  if (!isOrdered && daysToOrderBy !== null && daysToOrderBy <= 0) {
    return { severity: 'red', state: 'order-now', label: daysToOrderBy < 0 ? `Order overdue ${Math.abs(daysToOrderBy)}d` : 'Order today', orderByDate, daysToOrderBy, daysToNeeded, eta };
  }
  // Need-by already passed and nothing received.
  if (daysToNeeded !== null && daysToNeeded < 0) {
    return { severity: 'red', state: 'late', label: `${Math.abs(daysToNeeded)}d past need-by`, orderByDate, daysToOrderBy, daysToNeeded, eta };
  }
  // Order window closing (<=14d) while un-ordered, or tight ETA vs need.
  if (!isOrdered && daysToOrderBy !== null && daysToOrderBy <= 14) {
    return { severity: 'yellow', state: 'at-risk', label: `Order within ${daysToOrderBy}d`, orderByDate, daysToOrderBy, daysToNeeded, eta };
  }
  if (needed && etaDays !== null && daysToNeeded !== null && etaDays > daysToNeeded - 7) {
    return { severity: 'yellow', state: 'at-risk', label: 'Tight vs need-by', orderByDate, daysToOrderBy, daysToNeeded, eta };
  }
  if (daysToOrderBy === null && daysToNeeded === null) {
    return { severity: 'yellow', state: 'unknown', label: 'Missing dates', orderByDate, daysToOrderBy, daysToNeeded, eta };
  }
  return { severity: 'green', state: 'on-track', label: 'On track', orderByDate, daysToOrderBy, daysToNeeded, eta };
}

/* ── Risk register ─────────────────────────────────────────────────── */

// Text likelihood/impact → 1..5 scale. Accepts words or numeric strings.
export function toScale(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = num(v);
  if (n !== null && n >= 1 && n <= 5) return Math.round(n);
  const s = String(v).trim().toLowerCase();
  if (/very\s*low|rare|remote|1/.test(s)) return 1;
  if (/^(low|unlikely|2)$/.test(s) || /low/.test(s)) return 2;
  if (/med|moderate|possible|3/.test(s)) return 3;
  if (/^(high|likely|4)$/.test(s) || /high/.test(s)) return 4;
  if (/very\s*high|almost|certain|severe|critical|5/.test(s)) return 5;
  return null;
}

export interface RiskHealth {
  severity: Severity;
  score: number | null;   // 1..25
  likelihood: number | null;
  impact: number | null;
  band: 'Low' | 'Medium' | 'High' | 'Critical' | '—';
  isOpen: boolean;
}

const RISK_CLOSED = /closed|resolved|retired|mitigated|accepted|realiz/i;

export function computeRisk(r: Record<string, any>, nowMs?: number): RiskHealth {
  const likelihood = toScale(r.likelihood);
  const impact = toScale(r.impact);
  let score = num(r.risk_score);
  if ((score === null || score < 1) && likelihood !== null && impact !== null) score = likelihood * impact;
  const isOpen = !RISK_CLOSED.test(String(r.status || ''));

  let severity: Severity = 'green';
  let band: RiskHealth['band'] = '—';
  if (score !== null) {
    if (score >= 15) { severity = 'red'; band = 'Critical'; }
    else if (score >= 8) { severity = 'red'; band = 'High'; }
    else if (score >= 4) { severity = 'yellow'; band = 'Medium'; }
    else { severity = 'green'; band = 'Low'; }
  }
  // A resolved risk never shows red — it's history.
  if (!isOpen && severity === 'red') severity = 'yellow';
  const overdue = daysFromNow(r.due_date, nowMs);
  if (isOpen && overdue !== null && overdue < 0 && severity === 'green') severity = 'yellow';

  return { severity, score: score === null ? null : Math.round(score), likelihood, impact, band, isOpen };
}

/* ── Shared ────────────────────────────────────────────────────────── */

export const SEVERITY_ORDER: Record<Severity, number> = { red: 0, yellow: 1, green: 2 };

// Escalation days-overdue → severity.
export function escalationSeverity(daysOverdue: any): Severity {
  const d = num(daysOverdue) ?? 0;
  if (d >= 7) return 'red';
  if (d >= 1) return 'yellow';
  return 'green';
}

// 4-level escalation matrix (SCS spec): Superintendent → PM → Director → Executive.
export interface EscalationLevel { level: 1 | 2 | 3 | 4; owner: string; short: string; color: string; }
export function escalationLevel(daysOverdue: any): EscalationLevel {
  const d = num(daysOverdue) ?? 0;
  if (d >= 14) return { level: 4, owner: 'Executive Leadership', short: 'Exec', color: '#FF3B30' };
  if (d >= 7)  return { level: 3, owner: 'Director of Construction', short: 'Director', color: '#FF9500' };
  if (d >= 3)  return { level: 2, owner: 'Project Manager', short: 'PM', color: '#FFCC00' };
  return { level: 1, owner: 'Superintendent', short: 'Super', color: '#34C759' };
}

// Long-lead procurement 6-stage lifecycle: Ordered → Released → Manufactured → Shipped → Delivered → Installed.
export const LONGLEAD_LIFECYCLE = ['Ordered', 'Released', 'Manufactured', 'Shipped', 'Delivered', 'Installed'];
export function lifecycleStage(status: any): { index: number; label: string } {
  const s = String(status || '').toLowerCase();
  if (/install|on.?site|commission/.test(s)) return { index: 5, label: 'Installed' };
  if (/deliver|receiv/.test(s))              return { index: 4, label: 'Delivered' };
  if (/ship|transit|freight/.test(s))        return { index: 3, label: 'Shipped' };
  if (/manufactur|production|fabricat|in.?build/.test(s)) return { index: 2, label: 'Manufactured' };
  if (/releas|confirm|po.?issued/.test(s))   return { index: 1, label: 'Released' };
  return { index: 0, label: 'Ordered' }; // pending / quoted / ordered / approved
}
// Advance a status string to the next lifecycle stage's canonical status.
export function nextLifecycleStatus(status: any): string {
  const cur = lifecycleStage(status).index;
  return LONGLEAD_LIFECYCLE[Math.min(cur + 1, LONGLEAD_LIFECYCLE.length - 1)].toLowerCase();
}

// Schedule milestone slip (baseline vs current/forecast, in days late) → severity.
export function milestoneSlip(baseline: any, current: any, actual: any, floatDays?: any): { slip: number | null; severity: Severity } {
  const b = parse(baseline);
  const c = parse(actual) ?? parse(current);
  if (b === null || c === null) return { slip: null, severity: 'green' };
  const slip = Math.round((c - b) / DAY); // + = later than baseline
  const fl = num(floatDays) ?? 0;
  const net = slip - Math.max(0, fl); // slip beyond available float
  if (net >= 7) return { slip, severity: 'red' };
  if (net >= 1) return { slip, severity: 'yellow' };
  return { slip, severity: 'green' };
}
