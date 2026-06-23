/**
 * lib/bid-leveling.ts — Bid leveling engine for construction preconstruction.
 *
 * Takes an array of bids for a bid package and produces a normalized
 * comparison matrix: per-bidder base amount, alternates, inclusions,
 * exclusions, bond status, and a composite score + recommendation.
 *
 * The score weights: price (40%), scope completeness (25%),
 * qualifications (20%), responsiveness (15%).
 */

export interface Bid {
  id: string;
  bidder_name: string;
  bidder_company: string;
  amount: number;
  alternate_amounts?: Record<string, number> | null;
  inclusions?: string | string[] | null;
  exclusions?: string | string[] | null;
  bond_included?: boolean;
  score?: number | null;
  submitted_at?: string | null;
  status?: string;
}

export interface LeveledBid extends Bid {
  rank: number;
  price_score: number;
  scope_score: number;
  qual_score: number;
  responsiveness_score: number;
  composite_score: number;
  variance_from_low: number;
  variance_pct: number;
}

export interface LevelingResult {
  bids: LeveledBid[];
  low_bid: string;
  recommended: string;
  spread: number;
  spread_pct: number;
  avg_amount: number;
  median_amount: number;
}

export function levelBids(raw: Bid[]): LevelingResult {
  const bids = raw.filter(b => b.amount > 0 && b.status !== 'withdrawn');
  if (bids.length === 0) {
    return { bids: [], low_bid: '', recommended: '', spread: 0, spread_pct: 0, avg_amount: 0, median_amount: 0 };
  }

  const amounts = bids.map(b => b.amount).sort((a, b) => a - b);
  const low = amounts[0];
  const high = amounts[amounts.length - 1];
  const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
  const median = amounts.length % 2 === 0
    ? (amounts[amounts.length / 2 - 1] + amounts[amounts.length / 2]) / 2
    : amounts[Math.floor(amounts.length / 2)];

  const leveled: LeveledBid[] = bids.map(b => {
    // Price score: 100 for lowest, linearly down to 0 at 2x the low bid
    const priceScore = low > 0 ? Math.max(0, 100 * (1 - (b.amount - low) / low)) : 50;

    // Scope: penalize missing inclusions or having exclusions.
    // Coerce defensively — callers may pass arrays or null.
    const inclusionsStr = Array.isArray(b.inclusions) ? b.inclusions.join('; ') : String(b.inclusions ?? '');
    const exclusionsStr = Array.isArray(b.exclusions) ? b.exclusions.join('; ') : String(b.exclusions ?? '');
    const hasInclusions = inclusionsStr.trim().length > 10;
    const hasExclusions = exclusionsStr.trim().length > 5;
    const scopeScore = (hasInclusions ? 60 : 30) + (hasExclusions ? 0 : 40);

    // Qualifications: bond and pre-existing score
    const qualScore = (b.bond_included ? 50 : 0) + Math.min(50, (b.score || 0));

    // Responsiveness: submitted on time (has submitted_at)
    const responsiveness = b.submitted_at ? 100 : 30;

    const composite = Math.round(
      priceScore * 0.40 + scopeScore * 0.25 + qualScore * 0.20 + responsiveness * 0.15
    );

    return {
      ...b,
      rank: 0,
      price_score: Math.round(priceScore),
      scope_score: scopeScore,
      qual_score: qualScore,
      responsiveness_score: responsiveness,
      composite_score: composite,
      variance_from_low: b.amount - low,
      variance_pct: low > 0 ? Math.round(((b.amount - low) / low) * 10000) / 100 : 0,
    };
  });

  leveled.sort((a, b) => b.composite_score - a.composite_score);
  leveled.forEach((b, i) => { b.rank = i + 1; });

  return {
    bids: leveled,
    low_bid: leveled.reduce((prev, cur) => cur.amount < prev.amount ? cur : prev, leveled[0]).bidder_company,
    recommended: leveled[0].bidder_company,
    spread: high - low,
    spread_pct: low > 0 ? Math.round(((high - low) / low) * 10000) / 100 : 0,
    avg_amount: Math.round(avg),
    median_amount: Math.round(median),
  };
}
