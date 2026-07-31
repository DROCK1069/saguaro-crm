/** Estimate → Schedule of Values. Turns a takeoff's divisions into billable SOV lines. */
import type { SovLine } from './types';

/**
 * Allocate the marked-up sell price across the estimate's divisions so the SOV
 * sums EXACTLY to the contract sum (rounding drift lands on the last line).
 */
export function estimateToSov(divisions: { trade: string; totalCents: number; costCode?: string }[], sellCents: number, subtotalCents: number): SovLine[] {
  const factor = subtotalCents > 0 ? sellCents / subtotalCents : 1;
  let running = 0;
  const lines: SovLine[] = divisions.map((d, i) => {
    const sv = Math.round(d.totalCents * factor);
    running += sv;
    return { id: `sov-${i}`, itemNo: String(i + 1), description: d.trade, costCode: d.costCode, scheduledValueCents: sv, fromPreviousCents: 0, thisPeriodCents: 0, storedCents: 0 };
  });
  if (lines.length) lines[lines.length - 1].scheduledValueCents += sellCents - running; // exact reconciliation
  return lines;
}
