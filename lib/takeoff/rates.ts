/**
 * Learning cost rates — turn a GC's own history into their rates. Deterministic:
 * given past priced line items (each carrying its costKey + actual unit cost +
 * quantity), compute a QUANTITY-WEIGHTED average unit cost per costKey. Future
 * takeoffs then price with the GC's real numbers, not the book. Integer-cents.
 */
import type { LearnedRate, RateOverrides } from './types';

export interface HistoricalLine { costKey: string; unitMaterialCents: number; quantity: number }

/**
 * Weighted-average unit cost per costKey. Weighting by quantity means a 4,000 SF
 * drywall job counts more than a 200 SF patch — the blend reflects real volume.
 */
export function learnRates(history: HistoricalLine[]): LearnedRate[] {
  const acc = new Map<string, { wsum: number; qsum: number; n: number }>();
  for (const h of history) {
    if (!h.costKey || !(h.quantity > 0) || !(h.unitMaterialCents >= 0)) continue;
    const a = acc.get(h.costKey) || { wsum: 0, qsum: 0, n: 0 };
    a.wsum += h.unitMaterialCents * h.quantity;
    a.qsum += h.quantity;
    a.n += 1;
    acc.set(h.costKey, a);
  }
  const out: LearnedRate[] = [];
  for (const [costKey, a] of acc) {
    if (a.qsum <= 0) continue;
    out.push({ costKey, materialCents: Math.round(a.wsum / a.qsum), samples: a.n });
  }
  return out.sort((x, y) => y.samples - x.samples);
}

/** Learned rates → the overrides map the engine consumes. */
export function ratesToOverrides(learned: LearnedRate[]): RateOverrides {
  const r: RateOverrides = {};
  for (const l of learned) r[l.costKey] = l.materialCents;
  return r;
}
