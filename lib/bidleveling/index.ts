/**
 * Bid Leveling engine — deterministic, integer-cents, DOM-free. Shared AS-IS by
 * web (saguaro-deploy) + iOS (Saguaro-Field). Mirrors lib/finance / lib/takeoff.
 *
 * The problem it solves: a GC gets several sub bids for the same scope. The raw
 * numbers aren't comparable because each sub INCLUDES/EXCLUDES different scope,
 * carries different alternates, bond, tax, etc. "Leveling" normalizes every bid
 * to the same scope so the TRUE low bidder is visible, compares each against the
 * GC's own budget, and recommends an award on price + coverage + qualifications.
 */

export type ScopeStatus = 'included' | 'excluded' | 'clarify' | 'alternate';

export interface ScopeLine { id: string; csi?: string; description: string; required?: boolean; }
export interface BidderScopeItem { scopeLineId: string; status: ScopeStatus; valueCents?: number; note?: string; }
export interface Alternate { key: string; description: string; valueCents: number; kind: 'add' | 'deduct'; }
export interface BidderAdjustments { bondCents?: number; taxCents?: number; carryCents?: number; note?: string; }

export interface Bidder {
  id: string;
  name: string;
  baseBidCents: number;
  scope: BidderScopeItem[];
  alternates?: Alternate[];
  adjustments?: BidderAdjustments;
  bondIncluded?: boolean;    // did the sub carry bond in their base?
  insuranceMeets?: boolean;  // does the sub meet insurance requirements?
  note?: string;
}

export interface LevelOptions {
  gapAllowanceCents?: Record<string, number>;
  selectedAlternateKeys?: string[];
  budgetCents?: number;      // the GC's internal estimate/budget for this scope
  highOutlier?: number;      // default 1.25 (× median base)
  lowOutlier?: number;       // default 0.75
}

export interface LevelFlag { level: 'warn' | 'info'; message: string; }

export interface LeveledLine { scopeLineId: string; description: string; required: boolean; status: ScopeStatus | 'missing'; valueCents: number | null; allowanceAppliedCents: number; isGap: boolean; }

export interface LeveledBidder {
  id: string; name: string;
  baseBidCents: number;
  gapAllowanceCents: number;
  alternatesAdjCents: number;
  adjustmentsCents: number;
  leveledTotalCents: number;
  gapCount: number;
  clarifyCount: number;
  requiredCoveragePct: number;   // % of required scope the sub actually included
  vsBudgetCents: number | null;  // leveled − budget (positive = over)
  vsBudgetPct: number | null;
  riskScore: number;             // higher = riskier award
  lines: LeveledLine[];
  gaps: string[];
  isLow: boolean;
  deltaFromLowCents: number;
  flags: LevelFlag[];
}

export interface ScopeCoverage { scopeLineId: string; description: string; required: boolean; includedBy: number; excludedBy: number; noneCovered: boolean; singleBid: boolean; benchmarkCents: number | null; }

export interface Recommendation { bidderId: string | null; rationale: string; }

export interface LevelingResult {
  bidders: LeveledBidder[];
  lowBidderId: string | null;
  recommendation: Recommendation;
  spreadCents: number;
  medianBaseCents: number;
  budgetCents: number | null;
  scopeCoverage: ScopeCoverage[];
  uncoveredRequired: number;     // # required scope lines nobody bid
  flags: LevelFlag[];
}

const r = (n: number) => Math.round(n || 0);
function median(vals: number[]): number { if (!vals.length) return 0; const s = [...vals].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); }

export function levelBids(scopeLines: ScopeLine[], bidders: Bidder[], opts: LevelOptions = {}): LevelingResult {
  const highK = opts.highOutlier ?? 1.25;
  const lowK = opts.lowOutlier ?? 0.75;
  const selAlts = new Set(opts.selectedAlternateKeys || []);
  const budget = typeof opts.budgetCents === 'number' && opts.budgetCents > 0 ? r(opts.budgetCents) : null;
  const reqOf = (l: ScopeLine) => l.required !== false;
  const requiredLines = scopeLines.filter(reqOf);
  const requiredCount = requiredLines.length;

  const benchmark: Record<string, number | null> = {};
  for (const line of scopeLines) {
    const vals: number[] = [];
    for (const b of bidders) { const it = b.scope.find((s) => s.scopeLineId === line.id); if (it && typeof it.valueCents === 'number' && it.valueCents > 0 && (it.status === 'included' || it.status === 'alternate')) vals.push(r(it.valueCents)); }
    benchmark[line.id] = vals.length ? median(vals) : null;
  }
  const medianBase = median(bidders.map((b) => r(b.baseBidCents)));

  const leveled: LeveledBidder[] = bidders.map((b) => {
    const byLine = new Map(b.scope.map((s) => [s.scopeLineId, s]));
    const lines: LeveledLine[] = [];
    let gapAllowance = 0, gapCount = 0, clarifyCount = 0, coveredRequired = 0;
    const gaps: string[] = [];
    for (const line of scopeLines) {
      const required = reqOf(line);
      const it = byLine.get(line.id);
      const status: ScopeStatus | 'missing' = it ? it.status : 'missing';
      if (status === 'clarify') clarifyCount++;
      const covered = status === 'included' || status === 'alternate';
      if (required && covered) coveredRequired++;
      const isGap = required && !covered;
      let allowance = 0;
      if (isGap) { gapCount++; gaps.push(line.description); const explicit = opts.gapAllowanceCents?.[line.id]; allowance = typeof explicit === 'number' ? r(explicit) : (benchmark[line.id] ?? 0); }
      gapAllowance += allowance;
      lines.push({ scopeLineId: line.id, description: line.description, required, status, valueCents: it && typeof it.valueCents === 'number' ? r(it.valueCents) : null, allowanceAppliedCents: allowance, isGap });
    }
    let altAdj = 0;
    for (const a of b.alternates || []) { if (!selAlts.has(a.key)) continue; altAdj += (a.kind === 'deduct' ? -1 : 1) * Math.abs(r(a.valueCents)); }
    const adj = r((b.adjustments?.bondCents || 0)) + r((b.adjustments?.taxCents || 0)) + r((b.adjustments?.carryCents || 0));
    const leveledTotal = r(b.baseBidCents) + gapAllowance + altAdj + adj;
    const covPct = requiredCount ? Math.round((coveredRequired / requiredCount) * 100) : 100;
    return {
      id: b.id, name: b.name, baseBidCents: r(b.baseBidCents),
      gapAllowanceCents: gapAllowance, alternatesAdjCents: altAdj, adjustmentsCents: adj,
      leveledTotalCents: leveledTotal, gapCount, clarifyCount, requiredCoveragePct: covPct,
      vsBudgetCents: budget != null ? leveledTotal - budget : null,
      vsBudgetPct: budget != null && budget > 0 ? Math.round(((leveledTotal / budget) - 1) * 1000) / 10 : null,
      riskScore: gapCount * 2 + clarifyCount + (b.bondIncluded === false ? 2 : 0) + (b.insuranceMeets === false ? 3 : 0),
      lines, gaps, isLow: false, deltaFromLowCents: 0, flags: [],
    };
  });

  let lowId: string | null = null, lowTotal = Infinity;
  for (const lb of leveled) if (lb.leveledTotalCents < lowTotal) { lowTotal = lb.leveledTotalCents; lowId = lb.id; }
  for (const lb of leveled) {
    lb.isLow = lb.id === lowId;
    lb.deltaFromLowCents = lowId ? lb.leveledTotalCents - lowTotal : 0;
    if (medianBase > 0 && lb.baseBidCents > medianBase * highK) lb.flags.push({ level: 'warn', message: `Base bid ${Math.round(((lb.baseBidCents / medianBase) - 1) * 100)}% above median — verify scope` });
    if (medianBase > 0 && lb.baseBidCents < medianBase * lowK) lb.flags.push({ level: 'warn', message: `Base bid ${Math.round((1 - (lb.baseBidCents / medianBase)) * 100)}% below median — possible scope miss` });
    if (requiredCount > 0 && lb.gapCount >= Math.max(3, Math.ceil(requiredCount / 2))) lb.flags.push({ level: 'warn', message: `${lb.gapCount} required scope gaps — bid may be incomplete` });
    if (lb.vsBudgetPct != null && lb.vsBudgetPct > 10) lb.flags.push({ level: 'warn', message: `${lb.vsBudgetPct}% over your budget` });
  }

  const totals = leveled.map((l) => l.leveledTotalCents);
  const spread = totals.length ? Math.max(...totals) - Math.min(...totals) : 0;

  const scopeCoverage: ScopeCoverage[] = scopeLines.map((line) => {
    let inc = 0, exc = 0;
    for (const b of bidders) { const it = b.scope.find((s) => s.scopeLineId === line.id); if (it && (it.status === 'included' || it.status === 'alternate')) inc++; else exc++; }
    return { scopeLineId: line.id, description: line.description, required: reqOf(line), includedBy: inc, excludedBy: exc, noneCovered: inc === 0, singleBid: inc === 1, benchmarkCents: benchmark[line.id] };
  });
  const uncoveredRequired = scopeCoverage.filter((c) => c.required && c.noneCovered).length;

  const flags: LevelFlag[] = [];
  for (const c of scopeCoverage) if (c.required && c.noneCovered && bidders.length) flags.push({ level: 'warn', message: `No bidder covered "${c.description}" — carry it yourself or re-solicit` });
  if (bidders.length >= 2 && lowId) {
    const rawLow = [...bidders].sort((a, b) => r(a.baseBidCents) - r(b.baseBidCents))[0];
    const lowName = leveled.find((l) => l.id === lowId)!.name;
    if (rawLow.id !== lowId) flags.push({ level: 'info', message: `Apparent low bidder changed after leveling: ${rawLow.name} → ${lowName}` });
  }

  // Award recommendation — deterministic: prefer the lowest LEVELED bid, but if it
  // carries high risk (gaps/qualifications/no bond/insurance) and a cleaner bid is
  // within 3%, recommend the cleaner one. Explainable rationale.
  const recommendation = recommend(leveled, budget);

  return { bidders: leveled, lowBidderId: lowId, recommendation, spreadCents: spread, medianBaseCents: medianBase, budgetCents: budget, scopeCoverage, uncoveredRequired, flags };
}

function recommend(leveled: LeveledBidder[], budget: number | null): Recommendation {
  if (!leveled.length) return { bidderId: null, rationale: 'No bids to evaluate.' };
  const byPrice = [...leveled].sort((a, b) => a.leveledTotalCents - b.leveledTotalCents);
  const low = byPrice[0];
  const parts: string[] = [];
  let pick = low;
  const cleaner = byPrice.slice(1).find((b) => b.riskScore + 1 < low.riskScore && b.leveledTotalCents <= Math.round(low.leveledTotalCents * 1.03));
  if (low.riskScore >= 5 && cleaner) {
    pick = cleaner;
    parts.push(`${low.name} is nominally low but carries risk (${low.gapCount} gaps${low.clarifyCount ? `, ${low.clarifyCount} clarifications` : ''}${low.riskScore >= 5 && low.gapCount === 0 ? '' : ''}).`);
    parts.push(`${cleaner.name} is within 3% with cleaner coverage — recommend awarding ${cleaner.name}.`);
  } else {
    parts.push(`${low.name} is the true low leveled bid at ${usd(low.leveledTotalCents)}.`);
    if (low.gapCount) parts.push(`Confirm the ${low.gapCount} allowance-filled scope gap${low.gapCount > 1 ? 's' : ''} before award.`);
    if (low.clarifyCount) parts.push(`Resolve ${low.clarifyCount} clarification${low.clarifyCount > 1 ? 's' : ''}.`);
  }
  if (budget != null && pick.vsBudgetPct != null) parts.push(pick.vsBudgetCents! > 0 ? `${pick.vsBudgetPct}% over your budget of ${usd(budget)}.` : `${Math.abs(pick.vsBudgetPct)}% under your budget — good buy.`);
  return { bidderId: pick.id, rationale: parts.join(' ') };
}

export const usd = (cents: number) => '$' + Math.round((cents || 0) / 100).toLocaleString();

/**
 * CSI-trade scope templates — a GC picks a trade and gets the common scope
 * checklist instantly instead of typing it. Descriptions only; ids assigned by
 * the caller. Curated from typical division scopes.
 */
export const TRADE_TEMPLATES: { trade: string; csi: string; lines: string[] }[] = [
  { trade: 'Drywall & Framing', csi: '09 20 00', lines: ['Metal stud framing', 'Hang gypsum board', 'Tape & finish (Level 4)', 'Level-5 finish at designated areas', 'Corner bead & trim accessories', 'Batt/sound insulation', 'Fire-rated assemblies', 'Access panels', 'Cleanup & debris removal'] },
  { trade: 'Electrical', csi: '26 00 00', lines: ['Temporary power', 'Branch wiring & devices', 'Panelboards & distribution', 'Lighting fixtures & controls', 'Fire alarm rough-in', 'Low-voltage/data conduit', 'Site/exterior lighting', 'Gear & transformers', 'Permits & inspections', 'As-builts'] },
  { trade: 'Plumbing', csi: '22 00 00', lines: ['Underground rough-in', 'Above-ground rough-in', 'Fixtures & trim', 'Water heaters', 'Gas piping', 'Storm/sanitary', 'Backflow & testing', 'Insulation of piping', 'Permits & inspections'] },
  { trade: 'HVAC / Mechanical', csi: '23 00 00', lines: ['Equipment (RTUs/AHUs)', 'Ductwork & fittings', 'Grilles/registers/diffusers', 'Refrigerant piping', 'Controls/BAS', 'Test & balance', 'Insulation', 'Startup & commissioning', 'Permits & inspections'] },
  { trade: 'Concrete', csi: '03 30 00', lines: ['Excavation to grade (by others?)', 'Formwork', 'Reinforcing steel', 'Vapor barrier', 'Place & finish slab', 'Foundations & footings', 'Curing & sealing', 'Saw-cut control joints', 'Embeds & anchor bolts'] },
  { trade: 'Roofing', csi: '07 50 00', lines: ['Tear-off (if re-roof)', 'Decking repair', 'Insulation & cover board', 'Membrane/system install', 'Flashing & edge metal', 'Roof drains/scuppers', 'Walkway pads', 'Warranty (NDL)', 'Cleanup'] },
  { trade: 'Sitework / Earthwork', csi: '31 00 00', lines: ['Clear & grub', 'Erosion control (SWPPP)', 'Cut/fill & grading', 'Import/export soil', 'Compaction & testing', 'Utilities trenching', 'Aggregate base', 'Dewatering', 'Traffic control'] },
  { trade: 'Painting', csi: '09 90 00', lines: ['Surface prep', 'Prime coats', 'Interior finish coats', 'Exterior finish coats', 'Specialty coatings', 'Caulking', 'Touch-up', 'Cleanup & protection'] },
  { trade: 'Flooring', csi: '09 60 00', lines: ['Floor prep & leveling', 'Moisture testing/mitigation', 'Resilient/LVT', 'Carpet tile', 'Ceramic/porcelain tile', 'Base & transitions', 'Sealing', 'Attic stock'] },
];
