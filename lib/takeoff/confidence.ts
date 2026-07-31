/**
 * Live estimate-confidence — deterministic, no AI. Answers "how much should I trust this
 * number yet?" from measurable signals and returns a 0–100 score + ordered reasons (the
 * first is the headline "why"). Drives the gold confidence ring on the measured takeoff.
 *
 * Levers (weights sum to 100):
 *   Scale set + calibration plausible ....... 20
 *   Every condition actually measured ....... 35   (the big live lever — climbs as you trace)
 *   Every condition prices via a real assembly 20
 *   This GC's own cost book loaded .......... 15
 *   Minus sanity warnings ................... 10   (10-pt bucket, −4 per warning, floored at 0)
 *
 * Pure + integer-clean: same inputs → identical score (Node-proven in scratch/confidence_test.ts).
 */
import type { Condition, SanityFlag } from './types';
import { ASSEMBLIES } from './assemblies';

export interface ConfidenceInput {
  /** a plan scale has been set (px/ft > 0) */
  hasScale: boolean;
  /** the set scale passed calibrationSanity (plausible sheet size) */
  scaleSane: boolean;
  /** the current conditions (only value + assemblyId are read) */
  conditions: Pick<Condition, 'name' | 'value' | 'assemblyId'>[];
  /** how many unit rates this tenant has loaded (their own cost book) */
  tenantRateCount: number;
  /** the engine's sanity flags for this estimate */
  sanityFlags: SanityFlag[];
}

export interface ConfidenceResult {
  score: number;     // 0..100
  reasons: string[]; // ordered; reasons[0] is the one-line headline
}

/** rates loaded ≥ this ⇒ full pricing-confidence credit */
const RATE_TARGET = 12;
const clampScore = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function estimateConfidence(input: ConfidenceInput): ConfidenceResult {
  const { hasScale, scaleSane, conditions, tenantRateCount, sanityFlags } = input;

  // Nothing to score yet — the ring reads empty and points the user to the first action.
  if (!conditions.length) {
    return { score: 0, reasons: ['Pick a building-type template or trace the plan to start.'] };
  }

  const reasons: string[] = [];
  const n = conditions.length;

  // 1) Scale set + plausible (20)
  let scale = 0;
  if (hasScale && scaleSane) scale = 20;
  else if (hasScale && !scaleSane) { scale = 8; reasons.push('Scale looks off — re-calibrate on the sheet.'); }
  else reasons.push('Set a scale / trace on the plan so measurements price correctly.');

  // 2) Every condition actually measured (35) — the live lever as tracing fills values in
  const measured = conditions.filter((c) => (c.value ?? 0) > 0).length;
  const measure = 35 * (measured / n);
  if (measured < n) reasons.push(`${n - measured} of ${n} conditions still need a measurement.`);

  // 3) Every condition prices through a real assembly (20)
  const real = conditions.filter((c) => !!c.assemblyId && !!ASSEMBLIES[c.assemblyId]).length;
  const assembly = 20 * (real / n);
  if (real < n) reasons.push(`${n - real} condition(s) have no priced assembly.`);

  // 4) This GC's own cost book loaded (15)
  const rateCredit = Math.min(1, Math.max(0, tenantRateCount) / RATE_TARGET);
  const rates = 15 * rateCredit;
  if (tenantRateCount <= 0) reasons.push('Using catalog pricing — load your cost rates to sharpen the number.');

  // 5) Minus sanity warnings (10-pt bucket eroding 4 per warning)
  const warns = sanityFlags.filter((f) => f.level === 'warn').length;
  const sanity = Math.max(0, 10 - warns * 4);
  if (warns > 0) reasons.push(`${warns} sanity warning${warns > 1 ? 's' : ''} to resolve.`);

  const score = clampScore(scale + measure + assembly + rates + sanity);
  if (!reasons.length) reasons.push('Scale set, every condition measured & priced, your rates loaded — ready to send.');
  return { score, reasons };
}
