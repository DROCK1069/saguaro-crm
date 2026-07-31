/**
 * Cost control — the CM cost report. Budget → buyout (committed) → actual →
 * projected final → variance, per cost code. Deterministic, integer-cents.
 * This is how a GC sees whether a job is making or losing money in real time.
 */

export interface CostLine {
  id: string;
  costCode: string;
  description: string;
  originalBudgetCents: number;   // from the estimate/budget
  approvedChangesCents: number;  // approved change orders on this code
  committedCents: number;        // subcontracts + POs bought out
  actualCents: number;           // invoices + direct costs spent to date
}

export interface CostRow extends CostLine {
  revisedBudgetCents: number;    // original + approved changes
  projectedFinalCents: number;   // worst of revised / committed / actual — the honest forecast
  costToCompleteCents: number;   // projected − actual
  varianceCents: number;         // revised − projected (positive = under budget)
  uncommittedCents: number;      // revised − committed (still to buy out)
  pctSpent: number;              // actual / revised (0–100)
}

export interface CostReport {
  rows: CostRow[];
  originalBudgetCents: number;
  approvedChangesCents: number;
  revisedBudgetCents: number;
  committedCents: number;
  actualCents: number;
  projectedFinalCents: number;
  costToCompleteCents: number;
  varianceCents: number;
  pctSpent: number;
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

export function costControl(lines: CostLine[]): CostReport {
  const rows: CostRow[] = lines.map((l) => {
    const revised = l.originalBudgetCents + l.approvedChangesCents;
    // honest projection: you'll spend at least what you've committed and at least
    // what you've already paid; if both are under budget you still project the budget.
    const projected = Math.max(revised, l.committedCents, l.actualCents);
    return {
      ...l,
      revisedBudgetCents: revised,
      projectedFinalCents: projected,
      costToCompleteCents: projected - l.actualCents,
      varianceCents: revised - projected,
      uncommittedCents: revised - l.committedCents,
      pctSpent: pct(l.actualCents, revised),
    };
  });
  const sum = (f: (r: CostRow) => number) => rows.reduce((s, r) => s + f(r), 0);
  const originalBudgetCents = sum((r) => r.originalBudgetCents);
  const approvedChangesCents = sum((r) => r.approvedChangesCents);
  const revisedBudgetCents = sum((r) => r.revisedBudgetCents);
  const committedCents = sum((r) => r.committedCents);
  const actualCents = sum((r) => r.actualCents);
  const projectedFinalCents = sum((r) => r.projectedFinalCents);
  return {
    rows,
    originalBudgetCents, approvedChangesCents, revisedBudgetCents, committedCents, actualCents, projectedFinalCents,
    costToCompleteCents: projectedFinalCents - actualCents,
    varianceCents: revisedBudgetCents - projectedFinalCents,
    pctSpent: pct(actualCents, revisedBudgetCents),
  };
}
