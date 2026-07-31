/**
 * Win/Loss learning — PURE deterministic math (no I/O, unit-testable like the calc suites).
 *
 * Given a tenant's won/lost priced lines, produce a per-CSI-division suggested price
 * multiplier. Guarantees:
 *   • < MIN_SAMPLES data points for a division → multiplier is EXACTLY 1.0 (no swing).
 *   • Multiplier is HARD-clamped to [FLOOR, CEIL] (±15%) — it can never blow up a price.
 *   • Confidence-scaled: thin data barely moves the number; it eases toward the signal
 *     only as sample count grows.
 *   • Same inputs → same outputs. No randomness, no dates.
 */
import type { OutcomeLine, WinFactor, WinFactorStats } from './types';

export const FLOOR = 0.85; // never suggest cutting a price more than 15%
export const CEIL  = 1.15; // never suggest raising a price more than 15%
const CONF_FULL    = 8;    // sample count at which confidence saturates to 1.0
const MIN_SAMPLES  = 3;    // below this, stay neutral (1.0)
const K_CLOSE      = 0.5;  // give back HALF the observed over-gap on losses
const WIN_LO       = 0.30; // healthy win-rate band floor (fallback steering)
const WIN_HI       = 0.50; // healthy win-rate band ceiling

export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function avg(xs: number[]): number {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
}

/** Margin as a fraction of sell: (sell - cost) / sell. Null when unknowable. */
function marginPct(sellCents?: number | null, costCents?: number | null): number | null {
  if (sellCents == null || sellCents <= 0 || costCents == null) return null;
  return (sellCents - costCents) / sellCents;
}

/**
 * The core rule. `avgOverWinnerPct` (how far our losing bids sat above the winner) is
 * the strongest signal; when we don't know the winner we fall back to steering the
 * win-rate into a healthy band. Everything is clamped and confidence-blended.
 */
export function suggestMultiplier(stats: WinFactorStats): { multiplier: number; confidence: number } {
  const n = stats.winCount + stats.lossCount;
  const confidence = clamp(n / CONF_FULL, 0, 1);

  let rawMult: number;
  if (stats.avgOverWinnerPct != null) {
    // We know how far above the winner we bid on losses — give back half that gap.
    rawMult = 1 - K_CLOSE * stats.avgOverWinnerPct;
  } else if (stats.winRate != null && stats.winRate < WIN_LO) {
    // Losing too often and no winner numbers → ease price down.
    rawMult = 1 - 0.5 * (WIN_LO - stats.winRate);
  } else if (stats.winRate != null && stats.winRate > WIN_HI) {
    // Winning almost everything → we may be leaving money on the table; ease up.
    rawMult = 1 + 0.5 * (stats.winRate - WIN_HI);
  } else {
    rawMult = 1;
  }
  rawMult = clamp(rawMult, FLOOR, CEIL);

  // Cold-start guard + confidence blend toward the neutral 1.0.
  const suggested = n < MIN_SAMPLES ? 1.0 : clamp(1 + confidence * (rawMult - 1), FLOOR, CEIL);
  return { multiplier: suggested, confidence };
}

/** Group won/lost lines by CSI division and compute a learned factor for each. */
export function learnWinFactors(lines: OutcomeLine[]): WinFactor[] {
  const byDiv = new Map<string, OutcomeLine[]>();
  for (const l of lines) {
    const div = String(l.csiDivision || '').slice(0, 2);
    if (!div) continue;
    if (!byDiv.has(div)) byDiv.set(div, []);
    byDiv.get(div)!.push(l);
  }

  const out: WinFactor[] = [];
  for (const [div, group] of byDiv) {
    const wins   = group.filter((g) => g.outcome === 'won');
    const losses = group.filter((g) => g.outcome === 'lost');
    const n = wins.length + losses.length;

    const winMargins  = wins.map((g)   => marginPct(g.ourSellCents, g.ourCostCents)).filter((x): x is number => x != null);
    const lossMargins = losses.map((g) => marginPct(g.ourSellCents, g.ourCostCents)).filter((x): x is number => x != null);

    const overs = losses
      .filter((g) => g.winningSellCents != null && g.winningSellCents > 0 && g.ourSellCents != null)
      .map((g) => (g.ourSellCents! - g.winningSellCents!) / g.winningSellCents!);

    const stats: WinFactorStats = {
      csiDivision:      div,
      trade:            group.find((g) => g.trade)?.trade ?? null,
      winCount:         wins.length,
      lossCount:        losses.length,
      winRate:          n > 0 ? wins.length / n : null,
      avgWinMarginPct:  winMargins.length  ? avg(winMargins)  : null,
      avgLossMarginPct: lossMargins.length ? avg(lossMargins) : null,
      avgOverWinnerPct: overs.length       ? avg(overs)       : null,
      sampleCount:      n,
    };

    const { multiplier, confidence } = suggestMultiplier(stats);
    out.push({ ...stats, suggestedMultiplier: multiplier, confidence });
  }
  return out;
}
