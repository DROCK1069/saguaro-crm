/**
 * Takeoff engine v2 — deterministic proof.
 * Every expected number below is hand-computed independently in the comment,
 * then asserted against the engine. No AI in the money path.
 *
 * Run: cd C:/Users/Public/saguaro-deploy
 *      npx esbuild scratch/takeoff_engine_test.ts --bundle --platform=node --format=cjs | node -
 */
import {
  ASSEMBLIES, computeTakeoff, explodeCondition,
  volumeCY, sfToSy,
  type Condition, type ComputeOpts,
} from '../lib/takeoff';

let pass = 0, fail = 0;
const fails: string[] = [];
function assert(cond: boolean, msg: string) { if (cond) pass++; else { fail++; fails.push(msg); } }
function eq(a: unknown, b: unknown, msg: string) { assert(a === b, `${msg}: expected ${String(b)}, got ${String(a)}`); }
function near(a: number, b: number, tol: number, msg: string) { assert(Math.abs(a - b) <= tol, `${msg}: expected ~${b}, got ${a}`); }

const CREW = 6500; // $65/hr
const line = (ls: ReturnType<typeof explodeCondition>, asm: string, key: string) => ls.find((l) => l.assemblyId === asm && l.key === key)!;

// ───────────────────────────────────────────────────────────────────────────
// 0. Geometry unit rigor
// volumeCY(2400 SF, 6") = 2400 * 0.5 / 27 = 1200/27 = 44.4444 CY
// sfToSy(900) = 100
// ───────────────────────────────────────────────────────────────────────────
near(volumeCY(2400, 6), 44.4444, 0.001, 'volumeCY 2400sf@6in');
eq(sfToSy(900), 100, 'sfToSy 900');

// ───────────────────────────────────────────────────────────────────────────
// 1. 40×60 slab @ 6"  → 2400 SF
//    concrete: 2400 * (1/27) * (6/12) = 44.4444 CY pre-waste
//              +5% waste → round2(44.4444*1.05) = round2(46.6667) = 46.67 CY
//              extended = round(46.67 * 16500¢) = 770,055¢
//              labor = round2(0.9*44.4444)=40.0 hr → 40 × $75 (Concrete per-trade crew) = 300,000¢
//    rebar (v3 reinforced 0.45 lb/SF): 2400*0.45=1080 → +5% = 1134 LB (was a ~6x-light 0.15)
//    vapor: 2400 → +10% = 2640 SF
// ───────────────────────────────────────────────────────────────────────────
{
  const cond: Condition = { id: 's1', name: 'Slab', kind: 'area', value: 2400, thicknessIn: 6, assemblyId: 'slab_on_grade' };
  const ls = explodeCondition(cond, CREW);
  const c = line(ls, 'slab_on_grade', 'concrete');
  eq(c.qty, 46.67, 'slab concrete CY');
  eq(c.unit, 'CY', 'slab concrete unit');
  eq(c.materialCents, 770055, 'slab concrete $ (46.67*16500)');
  eq(c.laborCents, 300000, 'slab concrete labor (40hr × $75 Concrete per-trade crew)');
  const r = line(ls, 'slab_on_grade', 'rebar');
  eq(r.qty, 1134, 'slab rebar LB (v3 reinforced 0.45 → 1080 +5%)');
  const v = line(ls, 'slab_on_grade', 'vapor');
  eq(v.qty, 2640, 'slab vapor SF (2400 +10%)');
}

// slab_on_grade_heavy: real #4@18" EW = 0.89 lb/SF → 2400*0.89=2136 → +5% = round2(2242.8)=2242.8 LB
{
  const cond: Condition = { id: 's1h', name: 'Slab (heavy)', kind: 'area', value: 2400, thicknessIn: 6, assemblyId: 'slab_on_grade_heavy' };
  const ls = explodeCondition(cond, CREW);
  eq(line(ls, 'slab_on_grade_heavy', 'rebar').qty, 2242.8, 'heavy slab rebar LB (0.89 → 2136 +5%)');
  // heavy (#4 EW, 0.89) is still ~2x the default reinforced slab (#4 one-way + temp, 0.45)
  assert(line(ls, 'slab_on_grade_heavy', 'rebar').qty > 1.5 * 1134, 'heavy slab rebar > default reinforced');
}

// ───────────────────────────────────────────────────────────────────────────
// 2. 200 LF interior partition @ 9', NO openings.
//    drywall = 200*9 (=1800 face) *2 (both) = 3600, +10% = 3960 SF
//    (NB: the task prompt wrote "…*1.10 = 3564"; 200*9*2*1.10 is arithmetically 3960 — the
//     engine computes 3960, and 3960 is the hand-checked value asserted here.)
//    extended = 3960 * 120¢ = 475,200¢
// ───────────────────────────────────────────────────────────────────────────
{
  const cond: Condition = { id: 'p1', name: 'Partition', kind: 'linear', value: 200, heightFt: 9, assemblyId: 'interior_partition' };
  const ls = explodeCondition(cond, CREW);
  const dw = line(ls, 'interior_partition', 'drywall');
  eq(dw.qty, 3960, 'partition drywall SF (200*9*2 +10%)');
  eq(dw.materialCents, 475200, 'partition drywall $ (3960*120)');
  // studs: fieldStuds=ceil(200*12/16)=150; +1 end=151; ×1.10 allowance=ceil(166.1)=167 base
  //        +3% waste → ceil(167*1.03)=ceil(172.01)=173
  eq(line(ls, 'interior_partition', 'studs').qty, 173, 'partition studs (200LF,16"OC → 173)');
}

// ───────────────────────────────────────────────────────────────────────────
// 3. Stud-count formula (the real fix). interior_partition 40 LF, 1 door, 16" OC.
//    fieldStuds = ceil(40/(16/12)) = ceil(40*12/16) = ceil(30) = 30
//    runStuds   = 30 + 1 end = 31
//    openStuds  = 1 door × 3 adder = 3
//    base       = ceil((31+3) * 1.10) = ceil(37.4) = 38  (matches design §3.2)
//    qty        = ceil(38 * 1.03) = ceil(39.14) = 40
// ───────────────────────────────────────────────────────────────────────────
{
  const cond: Condition = { id: 'p2', name: 'Partition w/ door', kind: 'linear', value: 40, heightFt: 9, openingsSf: 21, openingsCount: 1, studSpacingIn: 16, assemblyId: 'interior_partition' };
  const ls = explodeCondition(cond, CREW);
  eq(line(ls, 'interior_partition', 'studs').qty, 40, 'stud count 40LF+1door (base 38 → +3% = 40)');
  // drywall opening deduction: (40*9 - 21)=339 face; *2 both = 678; +10% = round2(745.8) = 745.8
  eq(line(ls, 'interior_partition', 'drywall').qty, 745.8, 'drywall netted by door opening');
}

// stud-count identity: ceil(LF/spacing)+end, no allowance/openings.
// Build a bare wall on wood_stud_wall but zero out allowance via a manual clone is overkill;
// instead verify the documented worked proof for exterior_stud_wall (§8):
//   100 LF, 16" OC, 2 openings(adder4), allow12
//   fieldStuds=ceil(100*12/16)=75; +1=76; +2*4=8 → 84; ×1.12=ceil(94.08)=95 base; +3% → ceil(97.85)=98
{
  const cond: Condition = { id: 'ext1', name: 'Ext wall', kind: 'linear', value: 100, heightFt: 12, openingsSf: 180, openingsCount: 2, studSpacingIn: 16, assemblyId: 'exterior_stud_wall' };
  const ls = explodeCondition(cond, CREW);
  eq(line(ls, 'exterior_stud_wall', 'studs').qty, 98, 'ext wall studs (§8 → 98)');
  // sheathing (ext face, netted): 100*12 - 180 = 1020; +10% = 1122 SF
  eq(line(ls, 'exterior_stud_wall', 'sheathing').qty, 1122, 'ext sheathing netted (1020 +10%)');
  // WRB 1020 +12% = 1142.4 ; batt 1020 +8% = 1101.6 ; int GWB 1020 +10% = 1122 ; track 200 +5% = 210
  eq(line(ls, 'exterior_stud_wall', 'wrb').qty, 1142.4, 'ext WRB (1020 +12%)');
  eq(line(ls, 'exterior_stud_wall', 'batt').qty, 1101.6, 'ext batt (1020 +8%)');
  eq(line(ls, 'exterior_stud_wall', 'gwb').qty, 1122, 'ext int-GWB (1020 +10%)');
  eq(line(ls, 'exterior_stud_wall', 'track').qty, 210, 'ext track (200 +5%)');
}

// ───────────────────────────────────────────────────────────────────────────
// 4. Opening deduction REDUCES wall qty (both faces).
//    40 LF @ 9': no openings drywall = 40*9*2 *1.10 = 792
//               openingsSf=180  drywall = (360-180)*2 *1.10 = 396
// ───────────────────────────────────────────────────────────────────────────
{
  const base: Condition = { id: 'o1', name: 'w', kind: 'linear', value: 40, heightFt: 9, assemblyId: 'interior_partition' };
  const noOpen = explodeCondition(base, CREW);
  const withOpen = explodeCondition({ ...base, id: 'o2', openingsSf: 180 }, CREW);
  eq(line(noOpen, 'interior_partition', 'drywall').qty, 792, 'drywall no openings = 792');
  eq(line(withOpen, 'interior_partition', 'drywall').qty, 396, 'drywall with 180sf openings = 396');
  assert(line(withOpen, 'interior_partition', 'drywall').qty < line(noOpen, 'interior_partition', 'drywall').qty, 'openings reduce qty');
}

// ───────────────────────────────────────────────────────────────────────────
// 5. Markup stacking ORDER (design §8 worked proof, integer-cents).
//    material $40,000 / labor $18,000; tax 5.6 burden 32 GC 8 OH 6 cont 5 profit 8 bond 1.5
//    materialTax=224,000 burdenedLabor=2,376,000 direct=6,600,000 GC=528,000
//    costOfWork=7,128,000 OH=427,680 cont=377,784 preFee=7,933,464
//    profit=634,677 bond=128,522 sell=8,696,663  ($86,966.63)
// ───────────────────────────────────────────────────────────────────────────
const pc = (cents: number, pct: number) => Math.round((cents * pct) / 100);
function stack(material: number, labor: number, equip: number, sub: number, o: { tax: number; burden: number; gc: number; oh: number; cont: number; profit: number; bond: number }) {
  const materialTax = pc(material, o.tax);
  const burdenedLabor = labor + pc(labor, o.burden);
  const direct = material + materialTax + burdenedLabor + equip + sub;
  const gc = pc(direct, o.gc);
  const cow = direct + gc;
  const oh = pc(cow, o.oh);
  const cont = pc(cow + oh, o.cont);
  const preFee = cow + oh + cont;
  const profit = pc(preFee, o.profit);
  const bond = pc(preFee + profit, o.bond);
  return { materialTax, burdenedLabor, direct, gc, oh, cont, preFee, profit, bond, sell: preFee + profit + bond };
}
{
  const s = stack(4000000, 1800000, 0, 0, { tax: 5.6, burden: 32, gc: 8, oh: 6, cont: 5, profit: 8, bond: 1.5 });
  eq(s.materialTax, 224000, 'stack materialTax');
  eq(s.burdenedLabor, 2376000, 'stack burdenedLabor');
  eq(s.direct, 6600000, 'stack direct');
  eq(s.gc, 528000, 'stack GC');
  eq(s.oh, 427680, 'stack OH');
  eq(s.cont, 377784, 'stack contingency');
  eq(s.preFee, 7933464, 'stack preFee');
  eq(s.profit, 634677, 'stack profit');
  eq(s.bond, 128522, 'stack bond');
  eq(s.sell, 8696663, 'stack sell $86,966.63');
}

// ───────────────────────────────────────────────────────────────────────────
// 6. Full small building rolls to a plausible $/SF, and the engine wires the
//    EXACT stack above (integration: recompute stack from result buckets).
// ───────────────────────────────────────────────────────────────────────────
const BLDG_SF = 2400;
const building: Condition[] = [
  { id: 'b-slab', name: 'Slab', kind: 'area', value: 2400, thicknessIn: 6, assemblyId: 'slab_on_grade' },
  { id: 'b-ftg', name: 'Footing', kind: 'linear', value: 200, assemblyId: 'cont_footing' },
  { id: 'b-ext', name: 'Ext wall', kind: 'linear', value: 200, heightFt: 14, openingsSf: 320, openingsCount: 4, assemblyId: 'exterior_stud_wall' },
  { id: 'b-part', name: 'Partitions', kind: 'linear', value: 320, heightFt: 10, openingsSf: 168, openingsCount: 8, assemblyId: 'interior_partition' },
  { id: 'b-door', name: 'Doors', kind: 'count', value: 8, assemblyId: 'door_frame' },
  { id: 'b-roof', name: 'Roof', kind: 'area', value: 2400, assemblyId: 'roof_tpo' },
  { id: 'b-act', name: 'Ceiling', kind: 'area', value: 2400, assemblyId: 'acoustic_ceiling' },
  { id: 'b-flr', name: 'Flooring', kind: 'area', value: 2400, assemblyId: 'flooring' },
  { id: 'b-hvac', name: 'HVAC', kind: 'area', value: 2400, assemblyId: 'hvac_allowance' },
  { id: 'b-elec', name: 'Electrical', kind: 'area', value: 2400, assemblyId: 'electrical_allowance' },
  { id: 'b-fp', name: 'Sprinkler', kind: 'area', value: 2400, assemblyId: 'fire_sprinkler' },
  { id: 'b-plmb', name: 'Plumbing fix', kind: 'count', value: 6, assemblyId: 'plumbing_fixtures' },
  { id: 'b-lite', name: 'Lights', kind: 'count', value: 24, assemblyId: 'light_fixtures' },
];
const opts: ComputeOpts = {
  crewRateCents: CREW, buildingSf: BLDG_SF,
  salesTaxPct: 5.6, laborBurdenPct: 32, generalConditionsPct: 8,
  overheadPct: 6, contingencyPct: 5, profitPct: 8, bondPct: 1.5,
};
const R = computeTakeoff(building, opts);

// (a) engine applies the exact ordered stack
{
  const s = stack(R.materialCents, R.laborCents, R.equipmentCents, R.subCents, { tax: 5.6, burden: 32, gc: 8, oh: 6, cont: 5, profit: 8, bond: 1.5 });
  eq(R.materialTaxCents, s.materialTax, 'engine materialTax == stack');
  eq(R.burdenedLaborCents, s.burdenedLabor, 'engine burdenedLabor == stack');
  eq(R.subtotalCents, s.direct, 'engine subtotal(=direct) == stack');
  eq(R.generalConditionsCents, s.gc, 'engine GC == stack');
  eq(R.overheadCents, s.oh, 'engine OH == stack');
  eq(R.contingencyCents, s.cont, 'engine contingency == stack');
  eq(R.profitCents, s.profit, 'engine profit == stack');
  eq(R.bondCents, s.bond, 'engine bond == stack');
  eq(R.sellCents, s.sell, 'engine sell == stack');
}
// (b) plausible commercial $/SF
assert(R.costPerSf !== null && R.costPerSf > 80 && R.costPerSf < 600, `building $/SF plausible (got ${R.costPerSf})`);
assert(!R.sanity.some((f) => f.code === 'psf_implausible'), 'no psf_implausible flag on real building');
// (c) sub costs actually routed to the sub bucket (MEP allowances), skipping material tax
assert(R.subCents > 0, 'MEP subs populate subCents');

// ───────────────────────────────────────────────────────────────────────────
// 7. Sub/equipment routing skips sales tax on material.
//    asphalt_paving is a SUB line → materialCents 0, subCents>0, materialTax 0.
// ───────────────────────────────────────────────────────────────────────────
{
  const paving: Condition[] = [{ id: 'pav', name: 'Lot', kind: 'area', value: 10000, assemblyId: 'asphalt_paving' }];
  const r = computeTakeoff(paving, { salesTaxPct: 8, overheadPct: 6, profitPct: 8 });
  eq(r.materialCents, 0, 'asphalt material bucket = 0 (routed to sub)');
  assert(r.subCents > 0, 'asphalt cost in subCents');
  eq(r.materialTaxCents, 0, 'no sales tax on a sub line');
  // 10000 SF * 450¢ = 4,500,000¢ sub
  eq(r.subCents, 4500000, 'asphalt sub = 10000*450');
}

// ───────────────────────────────────────────────────────────────────────────
// 8. Tenant rate override wins over the catalog.
// ───────────────────────────────────────────────────────────────────────────
{
  const cond: Condition = { id: 't1', name: 'Slab', kind: 'area', value: 100, thicknessIn: 4, assemblyId: 'slab_on_grade' };
  const rTenant = explodeCondition(cond, CREW, { concrete_cy: 20000 });
  const c = line(rTenant, 'slab_on_grade', 'concrete');
  eq(c.unitMaterialCents, 20000, 'tenant concrete rate used');
  eq(c.rateSource, 'tenant', 'rateSource = tenant');
  const rBook = explodeCondition(cond, CREW);
  eq(line(rBook, 'slab_on_grade', 'concrete').unitMaterialCents, 16500, 'catalog concrete rate default');
  eq(line(rBook, 'slab_on_grade', 'concrete').rateSource, 'catalog', 'rateSource = catalog');
}

// ───────────────────────────────────────────────────────────────────────────
// 9. Backward-compat: a v1-style call (no tax/burden/GC, all-material assemblies)
//    → subtotal == material+labor, and overhead is byte-identical to the old base.
// ───────────────────────────────────────────────────────────────────────────
{
  const v1: Condition[] = [
    { id: 'v-slab', name: 'Slab', kind: 'area', value: 1000, thicknessIn: 4, assemblyId: 'slab_on_grade' },
    { id: 'v-part', name: 'Part', kind: 'linear', value: 100, heightFt: 9, assemblyId: 'interior_partition' },
  ];
  const r = computeTakeoff(v1, { overheadPct: 10, profitPct: 8, contingencyPct: 5 });
  eq(r.subtotalCents, r.materialCents + r.laborCents, 'v1 subtotal == material+labor');
  eq(r.equipmentCents, 0, 'v1 no equipment');
  eq(r.subCents, 0, 'v1 no sub');
  eq(r.materialTaxCents, 0, 'v1 no material tax');
  eq(r.overheadCents, pc(r.materialCents + r.laborCents, 10), 'v1 overhead identical to old base (pct of subtotal)');
}

// ───────────────────────────────────────────────────────────────────────────
// 10. Integer-cents everywhere — no float drift in the money path.
// ───────────────────────────────────────────────────────────────────────────
{
  const moneyFields: number[] = [
    R.materialCents, R.laborCents, R.equipmentCents, R.subCents, R.materialTaxCents,
    R.burdenedLaborCents, R.generalConditionsCents, R.subtotalCents, R.overheadCents,
    R.contingencyCents, R.profitCents, R.bondCents, R.sellCents,
    ...R.lines.flatMap((l) => [l.materialCents, l.laborCents, l.totalCents, l.equipmentCents ?? 0, l.subCents ?? 0]),
  ];
  assert(moneyFields.every((n) => Number.isInteger(n)), 'all cent fields are integers (no float drift)');
  assert(R.lines.every((l) => l.totalCents === (l.materialCents + (l.equipmentCents ?? 0) + (l.subCents ?? 0)) + l.laborCents), 'line total == routed cost + labor');
}

// ───────────────────────────────────────────────────────────────────────────
// 11. Assembly count + a spot check that every assembly explodes without throwing.
// ───────────────────────────────────────────────────────────────────────────
const asmCount = Object.keys(ASSEMBLIES).length;
assert(asmCount >= 45, `assembly count >= 45 (got ${asmCount})`);
{
  let exploded = 0;
  for (const id of Object.keys(ASSEMBLIES)) {
    const kind = ASSEMBLIES[id].appliesTo;
    const cond: Condition = { id: `x-${id}`, name: id, kind, value: 100, heightFt: 10, thicknessIn: 6, openingsSf: 40, openingsCount: 2, assemblyId: id };
    const ls = explodeCondition(cond, CREW);
    assert(ls.length > 0, `assembly ${id} explodes to >=1 line`);
    assert(ls.every((l) => l.qty >= 0 && Number.isInteger(l.materialCents)), `assembly ${id} lines sane`);
    exploded++;
  }
  eq(exploded, asmCount, 'every assembly exploded');
}

// ───────────────────────────────────────────────────────────────────────────
console.log('════════════════════════════════════════════');
console.log(`ASSEMBLIES: ${asmCount}`);
console.log(`Small-building sell: $${(R.sellCents / 100).toLocaleString()}  ($${R.costPerSf}/SF)`);
console.log(`  material $${(R.materialCents / 100).toLocaleString()} | labor $${(R.laborCents / 100).toLocaleString()} | sub $${(R.subCents / 100).toLocaleString()} | equip $${(R.equipmentCents / 100).toLocaleString()}`);
console.log('────────────────────────────────────────────');
console.log(`PASS: ${pass}   FAIL: ${fail}`);
if (fail) { console.log('FAILURES:'); for (const f of fails) console.log('  ✗ ' + f); }
console.log('════════════════════════════════════════════');
if (fail) process.exit(1);
