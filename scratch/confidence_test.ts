/**
 * Proof of lib/takeoff/confidence.ts — hand-checked deterministic cases. Run:
 *   node_modules/.bin/ts-node --transpile-only --compiler-options \
 *     '{"module":"commonjs","moduleResolution":"node","esModuleInterop":true,"skipLibCheck":true,"allowImportingTsExtensions":false}' \
 *     scratch/confidence_test.ts
 */
import { estimateConfidence } from '../lib/takeoff/confidence';
import type { SanityFlag } from '../lib/takeoff/types';

let pass = 0, fail = 0;
const eq = (n: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log('  PASS', n, '→', JSON.stringify(got)); }
  else { fail++; console.log('  FAIL', n, '→ got', JSON.stringify(got), 'want', JSON.stringify(want)); }
};
const warn = (code: string): SanityFlag => ({ level: 'warn', code, message: code });

// ── Case 0 — nothing measured yet → empty ring, guidance headline ──
{
  const r = estimateConfidence({ hasScale: false, scaleSane: false, conditions: [], tenantRateCount: 0, sanityFlags: [] });
  eq('empty score', r.score, 0);
  eq('empty headline', r.reasons[0], 'Pick a building-type template or trace the plan to start.');
}

// ── Case A — perfect traced estimate → 100 ──
// scale 20 + measure 35(2/2) + assembly 20(2/2) + rates 15(12/12) + sanity 10(0 warn) = 100
{
  const r = estimateConfidence({
    hasScale: true, scaleSane: true,
    conditions: [
      { name: 'Slab', value: 4200, assemblyId: 'slab_on_grade' },
      { name: 'Partitions', value: 380, assemblyId: 'interior_partition' },
    ],
    tenantRateCount: 12, sanityFlags: [],
  });
  eq('A score', r.score, 100);
  eq('A ready headline', r.reasons[0], 'Scale set, every condition measured & priced, your rates loaded — ready to send.');
}

// ── Case B — fresh template just dropped: no scale, nothing measured, catalog rates, 2 warns ──
// scale 0 + measure 0(0/3) + assembly 20(3/3) + rates 0 + sanity max(0,10-8)=2 = 22
{
  const r = estimateConfidence({
    hasScale: false, scaleSane: false,
    conditions: [
      { name: 'ACT ceiling', value: 0, assemblyId: 'acoustic_ceiling' },
      { name: 'Carpet', value: 0, assemblyId: 'flooring_carpet' },
      { name: 'Doors', value: 0, assemblyId: 'wood_door' },
    ],
    tenantRateCount: 0, sanityFlags: [warn('zero_measure'), warn('zero_measure')],
  });
  eq('B score', r.score, 22);
}

// ── Case C — traced, 3 of 4 measured, 6 rates, 1 warn ──
// scale 20 + measure 35(3/4)=26.25 + assembly 20 + rates 15(6/12)=7.5 + sanity max(0,10-4)=6 = 79.75 → 80
{
  const r = estimateConfidence({
    hasScale: true, scaleSane: true,
    conditions: [
      { name: 'Slab', value: 4200, assemblyId: 'slab_on_grade' },
      { name: 'Partitions', value: 380, assemblyId: 'interior_partition' },
      { name: 'Paint', value: 5200, assemblyId: 'paint_walls' },
      { name: 'Doors', value: 0, assemblyId: 'wood_door' },
    ],
    tenantRateCount: 6, sanityFlags: [warn('slab_no_vapor')],
  });
  eq('C score', r.score, 80);
}

// ── Case D — one condition carries a bogus (non-real) assembly id ──
// scale 20 + measure 35(2/2) + assembly 20(1/2)=10 + rates 15 + sanity 10 = 90
{
  const r = estimateConfidence({
    hasScale: true, scaleSane: true,
    conditions: [
      { name: 'Slab', value: 4200, assemblyId: 'slab_on_grade' },
      { name: 'Mystery', value: 100, assemblyId: 'not_a_real_assembly' },
    ],
    tenantRateCount: 12, sanityFlags: [],
  });
  eq('D score', r.score, 90);
  eq('D no-assembly reason', r.reasons.includes('1 condition(s) have no priced assembly.'), true);
}

// ── Case E — scale set but implausible (fat-fingered) → 8 pts, warns about it ──
// scale 8 + measure 35 + assembly 20 + rates 15 + sanity 10 = 88
{
  const r = estimateConfidence({
    hasScale: true, scaleSane: false,
    conditions: [{ name: 'Slab', value: 4200, assemblyId: 'slab_on_grade' }],
    tenantRateCount: 12, sanityFlags: [],
  });
  eq('E score', r.score, 88);
  eq('E recalibrate reason', r.reasons.includes('Scale looks off — re-calibrate on the sheet.'), true);
}

console.log(`\n${pass}/${pass + fail} passed`);
if (fail) process.exit(1);
