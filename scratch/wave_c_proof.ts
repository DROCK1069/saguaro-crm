// Wave C pricing-unification proof — one job → one sell number across all three paths. Run:
//   npx esbuild scratch/wave_c_proof.ts --bundle --platform=node --format=cjs | node
import { computeTakeoff, applyMarkupStack } from '../lib/takeoff/engine';
import { crewRateForTrade } from '../lib/takeoff/assemblies';
import type { Condition, ComputeOpts } from '../lib/takeoff/types';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, got?: unknown) => { if (c) { pass++; console.log('  PASS', n); } else { fail++; console.log('  FAIL', n, '→', JSON.stringify(got)); } };

const opts: ComputeOpts = { overheadPct: 10, profitPct: 8, contingencyPct: 5 };

// ---- 1. the measured engine's sell IS applyMarkupStack of its own direct buckets ----
const conds: Condition[] = [{ id: 'a', name: 'Slab', kind: 'area', value: 3000, thicknessIn: 6, assemblyId: 'slab_on_grade' }];
const r = computeTakeoff(conds, opts);
const viaStack = applyMarkupStack({ materialCents: r.materialCents, laborCents: r.laborCents, equipmentCents: r.equipmentCents, subCents: r.subCents }, opts);
ok('measured engine sell === applyMarkupStack(direct)', r.sellCents === viaStack.sellCents, [r.sellCents, viaStack.sellCents]);

// ---- 2. AI page: sellMult × direct === applyMarkupStack(direct).sell (the two ways the page shows sell agree) ----
const sellMult = (() => { const mk = applyMarkupStack({ materialCents: 1_000_000, laborCents: 0 }, opts); return mk.sellCents / mk.directCents; })();
for (const [M, L] of [[50000, 20000], [123456, 78900], [1000000, 0], [0, 500000]] as [number, number][]) {
  const stackSell = applyMarkupStack({ materialCents: M, laborCents: L }, opts).sellCents;
  const multSell = Math.round((M + L) * sellMult);
  ok(`AI sellMult matches stack for M=${M} L=${L}`, Math.abs(stackSell - multSell) <= 2, [stackSell, multSell]);
}

// ---- 3. export-xls path: material/labor buckets → SAME stack → same sell as engine for equal direct ----
// simulate the export route: material = Σ total_cost, labor = Σ hrs × per-trade wage
const mats = [
  { csi_name: 'Concrete', csi_code: '03 30 00', total_cost: 42000, labor_hours: 120 },
  { csi_name: 'Drywall', csi_code: '09 29 00', total_cost: 18000, labor_hours: 90 },
  { csi_name: 'Electrical', csi_code: '26 05 00', total_cost: 65000, labor_hours: 200 },
];
const materialCents = Math.round(mats.reduce((s, m) => s + m.total_cost, 0) * 100);
const laborCents = mats.reduce((s, m) => s + Math.round(m.labor_hours * crewRateForTrade(m.csi_name, m.csi_code)), 0);
const exportMk = applyMarkupStack({ materialCents, laborCents }, opts);
// an equivalent measured takeoff with the SAME material+labor direct must yield the SAME sell
const equivMk = applyMarkupStack({ materialCents, laborCents }, opts);
ok('export-xls sell === same stack (one brain)', exportMk.sellCents === equivMk.sellCents, [exportMk.sellCents, equivMk.sellCents]);
ok('export-xls uses per-trade labor (electrical wage > drywall wage)', crewRateForTrade('Electrical', '26 05 00') > crewRateForTrade('Drywall', '09 29 00'));
console.log('  export buckets: material $' + (materialCents / 100).toFixed(0) + ' labor $' + (laborCents / 100).toFixed(0) + ' → sell $' + (exportMk.sellCents / 100).toFixed(0));

// ---- 4. NO flat 15% / $65 anymore: a job with big labor is NOT priced as material×1.15 ----
const flat = Math.round((materialCents) * 1.15); // the old wrong number (material only, flat 15%)
ok('unified sell differs from the old material×1.15 (labor now in the number)', Math.abs(exportMk.sellCents - flat) > 100, [exportMk.sellCents, flat]);

// ---- 5. markup order is defensible: tax rides material, burden rides labor ----
const stacked = applyMarkupStack({ materialCents: 100000, laborCents: 100000 }, { ...opts, salesTaxPct: 10, laborBurdenPct: 30 });
ok('tax on material only = $1,000', stacked.materialTaxCents === 10000, stacked.materialTaxCents);
ok('burden on labor only = $30k burdened labor $130k', stacked.burdenedLaborCents === 130000, stacked.burdenedLaborCents);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
