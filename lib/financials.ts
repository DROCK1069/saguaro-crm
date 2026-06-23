/**
 * lib/financials.ts — the connected-financials rollup.
 *
 * Ties the four financial sources together the way Procore does:
 *   original budget → approved change orders → REVISED budget
 *   commitments (subcontracts/POs)          → COMMITTED
 *   cost entries (invoices/direct costs)     → ACTUAL (cost-to-date)
 *   forecast (projected final)               → max(revised, committed, actual)
 *   variance = revised − projected           (+ under budget, − over)
 *
 * Pure functions, no I/O — unit-testable offline.
 */

export interface BudgetLine {
  id: string;
  cost_code?: string | null;
  csi_division?: string | null;
  csi_description?: string | null;
  original_budget?: number | null;
  approved_changes?: number | null;
}
export interface Commitment { budget_line_item_id?: string | null; current_amount?: number | null; original_amount?: number | null; invoiced_to_date?: number | null; }
export interface CostEntry { budget_line_item_id?: string | null; amount?: number | null; approved?: boolean | null; }
export interface ChangeOrder { amount?: number | null; status?: string | null; approved_at?: string | null; }

export interface FinLine {
  id: string; code: string; description: string;
  original: number; approvedChanges: number; revised: number;
  committed: number; actual: number; projected: number;
  variance: number; variancePct: number; pctSpent: number;
}

const num = (v: unknown): number => (typeof v === 'number' ? v : parseFloat(String(v ?? '')) || 0);
const round = (v: number): number => Math.round(v * 100) / 100;

export function rollupFinancials(input: {
  budgetLines: BudgetLine[];
  commitments: Commitment[];
  costEntries: CostEntry[];
  changeOrders?: ChangeOrder[];
}): { lines: FinLine[]; totals: Record<string, number> } {
  const commByLine = new Map<string, number>();
  for (const c of input.commitments || []) {
    const id = c.budget_line_item_id || '';
    if (!id) continue;
    commByLine.set(id, (commByLine.get(id) || 0) + num(c.current_amount ?? c.original_amount));
  }

  const actByLine = new Map<string, number>();
  for (const e of input.costEntries || []) {
    const id = e.budget_line_item_id || '';
    if (!id || e.approved === false) continue; // exclude unapproved
    actByLine.set(id, (actByLine.get(id) || 0) + num(e.amount));
  }

  const lines: FinLine[] = (input.budgetLines || []).map((b) => {
    const original = num(b.original_budget);
    const approvedChanges = num(b.approved_changes);
    const revised = original + approvedChanges;
    const committed = commByLine.get(b.id) || 0;
    const actual = actByLine.get(b.id) || 0;
    const projected = Math.max(revised, committed, actual);
    const variance = revised - projected;
    return {
      id: b.id,
      code: b.cost_code || b.csi_division || '—',
      description: b.csi_description || '',
      original: round(original),
      approvedChanges: round(approvedChanges),
      revised: round(revised),
      committed: round(committed),
      actual: round(actual),
      projected: round(projected),
      variance: round(variance),
      variancePct: revised > 0 ? round((variance / revised) * 100) : 0,
      pctSpent: revised > 0 ? round((actual / revised) * 100) : 0,
    };
  });

  const sum = (f: (l: FinLine) => number) => round(lines.reduce((s, l) => s + f(l), 0));
  const coApproved = (input.changeOrders || [])
    .filter((c) => (c.status || '').toLowerCase() === 'approved' || !!c.approved_at)
    .reduce((s, c) => s + num(c.amount), 0);

  return {
    lines,
    totals: {
      original: sum((l) => l.original),
      approvedChanges: sum((l) => l.approvedChanges),
      revised: sum((l) => l.revised),
      committed: sum((l) => l.committed),
      actual: sum((l) => l.actual),
      projected: sum((l) => l.projected),
      variance: sum((l) => l.variance),
      changeOrdersApproved: round(coApproved),
    },
  };
}
