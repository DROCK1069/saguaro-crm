/**
 * Sanity layer — flags implausible numbers AFTER the deterministic calc.
 * It FLAGS for human review and never mutates values. This is the "catches what
 * a plain calculator can't" differentiator: an absurd unit cost, a duplicated
 * line, a pay app that doesn't reconcile.
 */
import { extend } from './money';
import type { TakeoffItem } from './takeoff';
import type { PayAppResult } from './payapp';

export interface Flag {
  severity: 'warn' | 'error';
  code: string;
  message: string;
  ref?: string;
}

// Broad per-unit unit-cost sanity bands, in cents. Outside the band → flag.
// Intentionally generous — only catches clearly-wrong magnitudes (10–100× off).
const UNIT_COST_BAND_CENTS: Record<string, [number, number]> = {
  EA:  [1, 10_000_000_00],
  LF:  [1, 5_000_00],
  SF:  [1, 2_000_00],
  SY:  [1, 5_000_00],
  CY:  [50_00, 5_000_00],
  CF:  [1, 1_000_00],
  LB:  [1, 100_00],
  TON: [10_00, 50_000_00],
  GAL: [1, 1_000_00],
  HR:  [10_00, 500_00],
  LS:  [1, 100_000_000_00],
};

export function checkTakeoffSanity(items: TakeoffItem[]): Flag[] {
  const flags: Flag[] = [];
  for (const it of items) {
    if (it.quantity <= 0) flags.push({ severity: 'error', code: 'QTY_ZERO', message: 'Zero/negative quantity', ref: it.description });
    if (it.unitCostCents <= 0) flags.push({ severity: 'error', code: 'RATE_ZERO', message: 'Zero/negative unit cost', ref: it.description });
    if (extend(it.quantity, it.unitCostCents) !== it.totalCents) {
      flags.push({ severity: 'error', code: 'TOTAL_MISMATCH', message: 'Line total ≠ quantity × unit cost', ref: it.description });
    }
    const band = UNIT_COST_BAND_CENTS[it.unit];
    if (band && it.unitCostCents > 0 && (it.unitCostCents < band[0] || it.unitCostCents > band[1])) {
      flags.push({ severity: 'warn', code: 'RATE_OUT_OF_BAND', message: `Unit cost looks off for ${it.unit} — verify`, ref: it.description });
    }
  }
  const seen = new Map<string, number>();
  for (const it of items) {
    const k = it.description.toLowerCase().trim();
    seen.set(k, (seen.get(k) || 0) + 1);
  }
  for (const [desc, n] of seen) {
    if (n > 1) flags.push({ severity: 'warn', code: 'DUPLICATE_LINE', message: `Duplicate line item appears ${n}×`, ref: desc });
  }
  return flags;
}

export function checkPayAppSanity(result: PayAppResult, retainagePercent: number): Flag[] {
  const flags: Flag[] = [];
  if (!result.reconciles) {
    for (const e of result.errors) flags.push({ severity: 'error', code: 'NO_RECONCILE', message: e });
  }
  if (result.currentPaymentDue < 0) flags.push({ severity: 'error', code: 'NEGATIVE_DUE', message: 'Current payment due is negative' });
  if (result.completedAndStoredTotal > result.scheduledTotal) flags.push({ severity: 'error', code: 'OVERBILL', message: 'Completed + stored exceeds scheduled total' });
  if (retainagePercent > 20) flags.push({ severity: 'warn', code: 'RETAINAGE_HIGH', message: `Retainage ${retainagePercent}% is unusually high — verify` });
  return flags;
}
