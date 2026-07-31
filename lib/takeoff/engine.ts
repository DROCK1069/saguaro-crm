/**
 * Takeoff engine — turns measured conditions into a full, priced, rolled-up
 * estimate. Deterministic + integer-cents. This is the shared brain (web + iOS).
 *
 * v3: per-trade crew wages + regional cost index (via explodeCondition), a base-bid vs
 * add/deduct ALTERNATE split, and a Location Breakdown rollup — all additive: a takeoff
 * with no alternates and no location tags rolls up exactly as before.
 */
import type { AlternateRoll, Condition, ComputeOpts, DivisionRoll, LineItem, LocationRoll, TakeoffResult } from './types';
import { explodeCondition } from './assemblies';
import { runSanity } from './sanity';

const pctCents = (cents: number, pct: number) => Math.round((cents * pct) / 100);

/** Direct-cost buckets (integer cents) fed to the shared markup stack. */
export interface DirectBuckets { materialCents: number; laborCents: number; equipmentCents?: number; subCents?: number }
export interface MarkupBreakdown {
  materialTaxCents: number; burdenedLaborCents: number; directCents: number; generalConditionsCents: number;
  overheadCents: number; contingencyCents: number; profitCents: number; bondCents: number; sellCents: number;
}

/**
 * THE single markup stack — the one place direct cost becomes a sell price. Both the measured
 * engine AND the AI-blueprint / Excel-export paths call this, so one job can never produce two
 * different sell numbers. Defensible AGC/CSI order: tax rides material, burden rides labor, GC on
 * direct, OH on cost-of-work, contingency on that, fee pre-bond, bond on final contract value.
 */
export function applyMarkupStack(d: DirectBuckets, opts: ComputeOpts): MarkupBreakdown {
  const taxP = opts.salesTaxPct ?? 0, burP = opts.laborBurdenPct ?? 0, gcP = opts.generalConditionsPct ?? 0;
  const oh = opts.overheadPct ?? 0, cont = opts.contingencyPct ?? 0, pr = opts.profitPct ?? 0, bnP = opts.bondPct ?? 0;
  const material = d.materialCents, labor = d.laborCents, equip = d.equipmentCents ?? 0, sub = d.subCents ?? 0;
  const materialTaxCents = pctCents(material, taxP);
  const burdenedLaborCents = labor + pctCents(labor, burP);
  const directCents = material + materialTaxCents + burdenedLaborCents + equip + sub;
  const generalConditionsCents = pctCents(directCents, gcP);
  const costOfWork = directCents + generalConditionsCents;
  const overheadCents = pctCents(costOfWork, oh);
  const contingencyCents = pctCents(costOfWork + overheadCents, cont);
  const preFee = costOfWork + overheadCents + contingencyCents;
  const profitCents = pctCents(preFee, pr);
  const bondCents = pctCents(preFee + profitCents, bnP);
  const sellCents = preFee + profitCents + bondCents;
  return { materialTaxCents, burdenedLaborCents, directCents, generalConditionsCents, overheadCents, contingencyCents, profitCents, bondCents, sellCents };
}

/** A priced set of conditions BEFORE markup — the output of the expensive explode stage. */
export interface ExplodedSet {
  lines: LineItem[];
  materialCents: number; laborCents: number; equipmentCents: number; subCents: number; laborHrs: number;
  byDivision: DivisionRoll[];
}
/** A whole takeoff exploded (base + alternates) but NOT yet marked up. */
export interface ExplodedTakeoff {
  baseConds: Condition[];
  base: ExplodedSet;
  alternates: { label: string; type: 'add' | 'deduct'; set: ExplodedSet }[];
}

const isBaseCond = (c: Condition) => !c.alternate || (c.alternateType ?? 'base') === 'base';

/**
 * Explode + accumulate ONE set of conditions into direct-cost buckets + lines + division roll.
 * This is the EXPENSIVE stage (runs explodeCondition over every condition). It depends only on
 * geometry + rate inputs (rates / crew wages / region / win-factors) — NOT on markup percentages,
 * so a UI can memoize it on [conditions, rateOpts] and skip it entirely while the user types
 * overhead/profit/etc.
 */
function explodeSet(conditions: Condition[], opts: ComputeOpts): ExplodedSet {
  const crewRate = opts.crewRateCents ?? 6500; // fallback for trades without a per-trade rate

  const lines: LineItem[] = conditions.flatMap((c) =>
    explodeCondition(c, crewRate, opts.rates, { crewRatesCents: opts.crewRatesCents, regionMultiplier: opts.regionMultiplier, applyWinFactors: opts.applyWinFactors, winFactorByDivision: opts.winFactorByDivision }),
  );

  let materialCents = 0, laborCents = 0, equipmentCents = 0, subCents = 0, laborHrs = 0;
  const divMap = new Map<string, DivisionRoll>();
  for (const l of lines) {
    materialCents += l.materialCents;
    laborCents += l.laborCents;
    equipmentCents += l.equipmentCents ?? 0;
    subCents += l.subCents ?? 0;
    laborHrs += l.laborHrs;
    const d = divMap.get(l.trade) || { trade: l.trade, materialCents: 0, laborCents: 0, totalCents: 0, lines: 0 };
    d.materialCents += l.materialCents; d.laborCents += l.laborCents; d.totalCents += l.totalCents; d.lines += 1;
    divMap.set(l.trade, d);
  }
  laborHrs = Math.round(laborHrs * 100) / 100;
  const byDivision = [...divMap.values()].sort((a, b) => b.totalCents - a.totalCents);
  return { lines, materialCents, laborCents, equipmentCents, subCents, laborHrs, byDivision };
}

/**
 * STAGE 1 — explode base + each alternate group. Geometry/rate-dependent; markup-independent.
 * Split out so estimator UIs can memoize the heavy work on [conditions, rateOpts] and re-run only
 * the cheap markup stage below on every OH/profit/tax keystroke.
 */
export function explodeTakeoff(conditions: Condition[], opts: ComputeOpts = {}): ExplodedTakeoff {
  const baseConds = conditions.filter(isBaseCond);
  const base = explodeSet(baseConds, opts);
  const groups = new Map<string, { type: 'add' | 'deduct'; conds: Condition[] }>();
  for (const c of conditions) {
    if (!isBaseCond(c) && c.alternate) {
      const type = c.alternateType === 'deduct' ? 'deduct' : 'add';
      const g = groups.get(c.alternate) || { type, conds: [] };
      g.conds.push(c);
      groups.set(c.alternate, g);
    }
  }
  const alternates = [...groups.entries()].map(([label, g]) => ({ label, type: g.type, set: explodeSet(g.conds, opts) }));
  return { baseConds, base, alternates };
}

/**
 * STAGE 2 — apply THE shared markup stack + sanity + location roll to an already-exploded takeoff.
 * Cheap (O(lines) sanity + a few percentage ops); safe to re-run on every markup keystroke.
 */
export function rollupTakeoff(exp: ExplodedTakeoff, opts: ComputeOpts = {}): TakeoffResult {
  const b = exp.base;
  const mk = applyMarkupStack({ materialCents: b.materialCents, laborCents: b.laborCents, equipmentCents: b.equipmentCents, subCents: b.subCents }, opts);
  const { materialTaxCents, burdenedLaborCents, generalConditionsCents, overheadCents, contingencyCents, profitCents, bondCents, sellCents } = mk;
  const subtotalCents = mk.directCents; // == old material+labor when tax/burden/GC/equip/sub = 0

  const costPerSf = opts.buildingSf && opts.buildingSf > 0 ? Math.round((sellCents / 100 / opts.buildingSf) * 100) / 100 : null;
  const sanity = runSanity(b.lines, subtotalCents, opts, exp.baseConds);

  const alternates: AlternateRoll[] = exp.alternates.map(({ label, type, set }) => {
    const amk = applyMarkupStack({ materialCents: set.materialCents, laborCents: set.laborCents, equipmentCents: set.equipmentCents, subCents: set.subCents }, opts);
    return {
      label, type,
      materialCents: set.materialCents, laborCents: set.laborCents, sellCents: amk.sellCents,
      deltaCents: type === 'deduct' ? -amk.sellCents : amk.sellCents,
      lines: set.lines.length,
    };
  });

  return {
    lines: b.lines, byDivision: b.byDivision, byLocation: rollupLocations(b.lines), alternates,
    materialCents: b.materialCents, laborCents: b.laborCents, equipmentCents: b.equipmentCents, subCents: b.subCents,
    materialTaxCents, burdenedLaborCents, generalConditionsCents,
    subtotalCents, overheadCents, contingencyCents, profitCents, bondCents,
    sellCents, laborHrs: b.laborHrs, costPerSf, sanity,
  };
}

/** Group base-bid lines by building/level/zone. Returns [] when no condition carries a location. */
function rollupLocations(lines: LineItem[]): LocationRoll[] {
  const map = new Map<string, LocationRoll>();
  let anyTagged = false;
  for (const l of lines) {
    const b = l.building || '', lv = l.level || '', z = l.zone || '';
    if (b || lv || z) anyTagged = true;
    const key = `${b}|${lv}|${z}`;
    const r = map.get(key) || { key, building: b || undefined, level: lv || undefined, zone: z || undefined, materialCents: 0, laborCents: 0, totalCents: 0, lines: 0 };
    r.materialCents += l.materialCents; r.laborCents += l.laborCents; r.totalCents += l.totalCents; r.lines += 1;
    map.set(key, r);
  }
  if (!anyTagged) return [];
  return [...map.values()].sort((a, b) => b.totalCents - a.totalCents);
}

/**
 * Explode every condition, price it, and roll it all up with markups + sanity.
 * Base bid = conditions with no alternate (or alternateType 'base'); named add/deduct
 * alternates are each priced separately (full markup) and returned as a schedule.
 */
export function computeTakeoff(conditions: Condition[], opts: ComputeOpts = {}): TakeoffResult {
  return rollupTakeoff(explodeTakeoff(conditions, opts), opts);
}

/** Convenience: dollars string from cents. */
export const usd = (cents: number) => '$' + (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
