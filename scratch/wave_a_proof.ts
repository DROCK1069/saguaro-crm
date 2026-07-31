// Wave A engine-spine proof. Run:
//   npx esbuild scratch/wave_a_proof.ts --bundle --platform=node --format=cjs | node
import { computeTakeoff } from '../lib/takeoff/engine';
import { explodeCondition, crewRateForTrade, ASSEMBLIES } from '../lib/takeoff/assemblies';
import { unitCostCents } from '../lib/takeoff/cost';
import { unbandedCatalogKeys } from '../lib/takeoff/sanity';
import type { Condition } from '../lib/takeoff/types';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, got?: unknown) => { if (c) { pass++; console.log('  PASS', n); } else { fail++; console.log('  FAIL', n, '→', JSON.stringify(got)); } };

const opts = { overheadPct: 10, profitPct: 8, contingencyPct: 5, laborBurdenPct: 30, salesTaxPct: 8 };

// ---- 1. per-trade crew rates: steel ≠ drywall ----
ok('steel crew rate > drywall crew rate', crewRateForTrade('Structural Steel', '05 12 00') > crewRateForTrade('Drywall', '09 29 00'),
  [crewRateForTrade('Structural Steel', '05 12 00'), crewRateForTrade('Drywall', '09 29 00')]);
ok('unknown trade falls back to blended crewRateCents', crewRateForTrade('Nonsense Trade', '99 99 00', { crewRateCents: 7000 }) === 7000);
ok('tenant per-trade override wins (by trade)', crewRateForTrade('Drywall', '09 29 00', { crewRatesCents: { Drywall: 5000 } }) === 5000);
ok('tenant per-division override wins (by CSI div)', crewRateForTrade('Concrete', '03 30 00', { crewRatesCents: { '03': 9900 } }) === 9900);

// ---- 2. region multiplier: catalog scales, tenant override does not ----
ok('region scales catalog rate', unitCostCents('rebar_lb', undefined, 1.2) === Math.round(95 * 1.2), unitCostCents('rebar_lb', undefined, 1.2));
ok('region leaves tenant override untouched', unitCostCents('rebar_lb', { rebar_lb: 120 }, 1.2) === 120);
ok('region 1 == base', unitCostCents('concrete_cy', undefined, 1) === 16500);

// ---- 3. instanceCount: qty + labor scale by N, baseQty reflects it ----
const one: Condition = { id: 'p', name: 'Partition', kind: 'linear', value: 100, heightFt: 9, assemblyId: 'interior_partition' };
const five: Condition = { ...one, id: 'p5', instanceCount: 5 };
const l1 = explodeCondition(one, 6500);
const l5 = explodeCondition(five, 6500);
const dw1 = l1.find((l) => l.key === 'drywall')!, dw5 = l5.find((l) => l.key === 'drywall')!;
ok('instanceCount x5 → 5x drywall qty', Math.abs(dw5.qty - dw1.qty * 5) < 0.02, [dw1.qty, dw5.qty]);
ok('instanceCount x5 → 5x labor hrs', Math.abs(dw5.laborHrs - dw1.laborHrs * 5) < 0.02, [dw1.laborHrs, dw5.laborHrs]);
ok('instanceCount stamped on line', dw5.instanceCount === 5);
ok('baseQty is pre-waste (Net < Order when waste>0)', dw1.baseQty < dw1.qty && dw1.wastePct > 0, [dw1.baseQty, dw1.qty, dw1.wastePct]);
ok('qty ≈ baseQty × (1+waste)', Math.abs(dw1.qty - dw1.baseQty * (1 + dw1.wastePct / 100)) < 0.05, [dw1.qty, dw1.baseQty]);

// ---- 4. rebar fix: default slab now genuinely reinforced ----
const rebarPer = ASSEMBLIES['slab_on_grade'].components.find((c) => c.key === 'rebar')!.per;
ok('default slab rebar bumped from 0.15 to reinforced (>=0.4)', rebarPer >= 0.4, rebarPer);
ok('fiber-mesh slab exists + has no rebar', !!ASSEMBLIES['slab_on_grade_fibermesh'] && !ASSEMBLIES['slab_on_grade_fibermesh'].components.some((c) => c.key === 'rebar'));

// ---- 5. alternates: base excludes alternates; schedule signs correct ----
const conds: Condition[] = [
  { id: 'b1', name: 'Base slab', kind: 'area', value: 2000, thicknessIn: 6, assemblyId: 'slab_on_grade' },
  { id: 'a1', name: 'ALT flooring upgrade', kind: 'area', value: 2000, assemblyId: 'lvt_flooring', alternate: 'ALT-1 Upgrade flooring', alternateType: 'add' },
  { id: 'd1', name: 'ALT delete storefront', kind: 'area', value: 300, assemblyId: 'aluminum_storefront', alternate: 'ALT-2 Delete storefront', alternateType: 'deduct' },
];
// use an assembly that exists for flooring; fall back if lvt_flooring absent
const floorAsm = ASSEMBLIES['lvt_flooring'] ? 'lvt_flooring' : Object.keys(ASSEMBLIES).find((k) => /floor|lvt|vct/i.test(k))!;
conds[1].assemblyId = floorAsm;
const r = computeTakeoff(conds, opts);
const baseOnly = computeTakeoff([conds[0]], opts);
ok('base sell excludes alternates', r.sellCents === baseOnly.sellCents, [r.sellCents, baseOnly.sellCents]);
ok('two alternates in the schedule', r.alternates.length === 2, r.alternates.map((a) => a.label));
ok('add alternate has positive delta', (r.alternates.find((a) => a.type === 'add')?.deltaCents ?? 0) > 0);
ok('deduct alternate has negative delta', (r.alternates.find((a) => a.type === 'deduct')?.deltaCents ?? 0) < 0);

// ---- 6. byLocation: groups when tagged, empty when not ----
const tagged: Condition[] = [
  { id: 't1', name: 'L1 slab', kind: 'area', value: 1000, thicknessIn: 5, assemblyId: 'slab_on_grade', building: 'A', level: '1' },
  { id: 't2', name: 'L2 slab', kind: 'area', value: 1000, thicknessIn: 5, assemblyId: 'slab_on_grade', building: 'A', level: '2' },
];
const rt = computeTakeoff(tagged, opts);
ok('byLocation groups two levels', rt.byLocation.length === 2, rt.byLocation.map((l) => l.key));
ok('byLocation empty when untagged', computeTakeoff([conds[0]], opts).byLocation.length === 0);

// ---- 7. sanity: every catalog key is banded ----
ok('no un-banded catalog keys', unbandedCatalogKeys().length === 0, unbandedCatalogKeys());

// ---- 8. determinism + back-compat ----
ok('deterministic (identical re-run)', JSON.stringify(computeTakeoff(conds, opts)) === JSON.stringify(r));
const legacy = computeTakeoff([{ id: 'x', name: 'Wall', kind: 'linear', value: 120, heightFt: 10, assemblyId: 'interior_partition' }], { overheadPct: 10, profitPct: 8 });
ok('back-compat: no-v3-fields still prices', legacy.sellCents > 0 && legacy.byDivision.length > 0 && legacy.alternates.length === 0 && legacy.byLocation.length === 0);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
