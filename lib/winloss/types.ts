/**
 * Win/Loss bid learning — shared types.
 *
 * The learning key is the 2-digit CSI division ('09', '03', …) because that's the
 * only key BOTH pricing seams can compute (measured engine has `c.csi`; the AI
 * blueprint path has `csiCode.slice(0,2)`). A human-readable `trade` rides along
 * for display only.
 */

/** One priced line of a won/lost bid, per CSI division. Cents are integers. */
export interface OutcomeLine {
  csiDivision: string;              // '09'
  trade?: string | null;           // 'Finishes' (display)
  ourCostCents?: number | null;    // our internal cost
  ourSellCents?: number | null;    // what we bid
  winningSellCents?: number | null;// the competitor who won — frequently unknown (null)
  outcome: 'won' | 'lost';
}

/** Aggregate stats for one CSI division — every field is persisted so the UI can
 *  EXPLAIN the suggested multiplier rather than showing a bare number. */
export interface WinFactorStats {
  csiDivision: string;
  trade: string | null;
  winCount: number;
  lossCount: number;
  winRate: number | null;          // won / (won + lost)
  avgWinMarginPct: number | null;  // mean (sell-cost)/sell on wins
  avgLossMarginPct: number | null; // mean (sell-cost)/sell on losses
  avgOverWinnerPct: number | null; // mean (our_sell - winning)/winning on lost lines w/ a known winner
  sampleCount: number;             // winCount + lossCount
}

/** A learned factor: the stats plus the bounded, confidence-blended multiplier. */
export interface WinFactor extends WinFactorStats {
  suggestedMultiplier: number;     // HARD-clamped to [FLOOR, CEIL]
  confidence: number;              // 0–1
}
