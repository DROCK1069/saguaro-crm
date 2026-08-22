#!/usr/bin/env node
/**
 * Takeoff engine GOLDEN harness — engine-executed truth, asserted to the cent.
 * Run:  npx -y tsx scripts/takeoff-golden.test.mjs        (exit 0 = every assertion held)
 *
 * This file is committed BYTE-IDENTICAL to both repos (Saguaro-Field mobile +
 * saguaro-web). It imports lib/takeoff DIRECTLY (engine.ts + geometry.ts — never the
 * index barrel, which is surface-local by design; see scripts/sync-takeoff-engine.mjs).
 * Import mechanics mirror scripts/interfloor.test.mjs / lib/heatmap/sanity.test.ts:
 * the real TS via tsx, no separate build step.
 *
 * Sections:
 *   1. Geometry goldens — scale, area, perimeter, linear, count
 *   2. Priced-bill golden — one 3-condition takeoff, EVERY rollup bucket to the cent
 *   3. Markup-stack anchor — applyMarkupStack alone, every rung to the cent
 *   4. Invariants — per-line waste identity, rollup identity, stage-split identity,
 *      markup-independent explode, instanceCount doubling, integer-cents everywhere
 *   5. PEER PARITY — when the sibling repo is on disk, the SAME fixtures run through
 *      ITS lib/takeoff and every result must deep-equal this repo's (drift tripwire).
 *
 * Accuracy is sacred: these numbers are the contract. If an engine change moves ANY
 * of them, that change is a bid-changing event — it must be intentional, defended,
 * and this file updated in the SAME commit in BOTH repos.
 */
import { existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { computeTakeoff, explodeTakeoff, rollupTakeoff, applyMarkupStack } from '../lib/takeoff/engine.ts';
import { pxPerFt, measure, perimeterLF, round2 } from '../lib/takeoff/geometry.ts';

let passed = 0;
let total = 0;
const check = (name, cond, detail) => {
  total++;
  if (cond) { passed++; console.log(`ok   ${name}`); }
  else { console.log(`FAIL ${name} — ${detail}`); process.exitCode = 1; }
};
const eq = (name, got, want) => check(name, got === want, `got ${got}, want ${want}`);

/** Key-sorted stringify → order-independent deep equality across module instances. */
const sorted = (v) => {
  if (Array.isArray(v)) return v.map(sorted);
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v).sort()) o[k] = sorted(v[k]);
    return o;
  }
  return v;
};
const stable = (v) => JSON.stringify(sorted(v));

/* ── Fixtures (fresh objects per call — no shared mutable state across engines) ── */
const OPTS = () => ({
  overheadPct: 10, profitPct: 10, contingencyPct: 5, salesTaxPct: 8, laborBurdenPct: 30,
  generalConditionsPct: 8, bondPct: 1.5, buildingSf: 2400, costPerSfBand: [1000, 60000],
});
const CONDS = () => ([
  { id: 'c-slab', name: 'Slab on grade', kind: 'area', value: 2400, thicknessIn: 6, assemblyId: 'slab_on_grade' },
  { id: 'c-part', name: 'Interior partitions', kind: 'linear', value: 100, heightFt: 9, assemblyId: 'interior_partition' },
  { id: 'c-door', name: 'Doors', kind: 'count', value: 7, assemblyId: 'door_frame' },
]);
const DOOR = (instanceCount) => ({
  id: 'c-door', name: 'Doors', kind: 'count', value: 7, assemblyId: 'door_frame',
  ...(instanceCount > 1 ? { instanceCount } : {}),
});

/* ── 1. Geometry goldens ─────────────────────────────────────────────────────── */
const RING = () => [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 400 }, { x: 0, y: 400 }];
eq('geometry: pxPerFt (0,0)->(100,0) over 10 ft = 10', pxPerFt({ x: 0, y: 0 }, { x: 100, y: 0 }, 10), 10);
eq('geometry: area ring 600x400 px @ ppf 10 = 2400.00 SF', measure('area', RING(), 10), 2400);
eq('geometry: perimeter of that ring = 200.00 LF', round2(perimeterLF(RING(), 10)), 200);
eq('geometry: linear (0,0)->(1000,0) @ ppf 10 = 100.00 LF', measure('linear', [{ x: 0, y: 0 }, { x: 1000, y: 0 }], 10), 100);
eq('geometry: count 7 = 7 EA', measure('count', [], 10, 7), 7);

/* ── 2. Priced-bill golden — every bucket to the cent ────────────────────────── */
const R = computeTakeoff(CONDS(), OPTS());
eq('bill: line count (3+5+2)', R.lines.length, 10);
eq('bill: materialCents', R.materialCents, 2401555);
eq('bill: laborCents (bare)', R.laborCents, 752500);
eq('bill: equipmentCents', R.equipmentCents, 0);
eq('bill: subCents', R.subCents, 0);
eq('bill: materialTaxCents (8% on material)', R.materialTaxCents, 192124);
eq('bill: burdenedLaborCents (labor x 1.30)', R.burdenedLaborCents, 978250);
eq('bill: generalConditionsCents (8% on direct)', R.generalConditionsCents, 285754);
eq('bill: subtotalCents == direct cost', R.subtotalCents, 3571929);
eq('bill: overheadCents (10% on cost-of-work)', R.overheadCents, 385768);
eq('bill: contingencyCents (5%)', R.contingencyCents, 212173);
eq('bill: profitCents (10% pre-bond)', R.profitCents, 445562);
eq('bill: bondCents (1.5% on contract value)', R.bondCents, 73518);
eq('bill: SELL', R.sellCents, 4974704);

/* ── 3. Markup-stack anchor — applyMarkupStack alone ─────────────────────────── */
const M = applyMarkupStack({ materialCents: 100000, laborCents: 50000 }, OPTS());
eq('anchor: materialTaxCents', M.materialTaxCents, 8000);
eq('anchor: burdenedLaborCents', M.burdenedLaborCents, 65000);
eq('anchor: directCents', M.directCents, 173000);
eq('anchor: generalConditionsCents', M.generalConditionsCents, 13840);
eq('anchor: overheadCents', M.overheadCents, 18684);
eq('anchor: contingencyCents', M.contingencyCents, 10276);
eq('anchor: profitCents', M.profitCents, 21580);
eq('anchor: bondCents', M.bondCents, 3561);
eq('anchor: sellCents', M.sellCents, 240941);

/* ── 4. Invariants ───────────────────────────────────────────────────────────── */
// 4a. Per-line waste identity: qty is (round2 | ceil)(net-per-instance x (1 + waste%))
//     x instances. The stored Net (baseQty) is itself round2-quantized, so the round2
//     branch tolerates <= 0.011 of double-rounding drift — a real missing/extra waste
//     application shifts qty by whole percents, orders of magnitude above that.
for (const l of R.lines) {
  const inst = l.instanceCount ?? 1;
  const perInst = l.baseQty / inst;
  const f = 1 + l.wastePct / 100;
  const candRound = round2(round2(perInst * f) * inst);
  const candCeil = round2(Math.ceil(perInst * f - 1e-9) * inst);
  const holds = Math.abs(l.qty - candRound) <= 0.011 || Math.abs(l.qty - candCeil) <= 1e-9;
  check(`waste identity: ${l.assemblyId}/${l.key}`, holds,
    `qty=${l.qty} net=${l.baseQty} waste=${l.wastePct}% inst=${inst} -> round2 ${candRound} / ceil ${candCeil}`);
}
// 4b. Rollup identity: the printed buckets are exactly the sum of their lines.
const sum = (k) => R.lines.reduce((a, l) => a + (l[k] ?? 0), 0);
eq('rollup identity: sum(line materialCents) == materialCents', sum('materialCents'), R.materialCents);
eq('rollup identity: sum(line laborCents) == laborCents', sum('laborCents'), R.laborCents);
eq('rollup identity: sum(line equipmentCents) == equipmentCents', sum('equipmentCents'), R.equipmentCents);
eq('rollup identity: sum(line subCents) == subCents', sum('subCents'), R.subCents);
eq('rollup identity: round2(sum(line laborHrs)) == laborHrs', round2(sum('laborHrs')), R.laborHrs);
// 4c. Stage-split identity: explode -> rollup IS computeTakeoff, byte-for-byte.
check('stage-split identity: rollupTakeoff(explodeTakeoff(c,o),o) deep-equals computeTakeoff(c,o)',
  stable(rollupTakeoff(explodeTakeoff(CONDS(), OPTS()), OPTS())) === stable(R), 'stage split diverged from single-shot');
// 4d. Explode is markup-independent: stripping every markup pct changes NOTHING upstream.
check('explode is markup-independent (opts with vs without markup pcts)',
  stable(explodeTakeoff(CONDS(), OPTS())) === stable(explodeTakeoff(CONDS(), {})), 'markup pcts leaked into the explode stage');
// 4e. instanceCount: measure one, apply to N — 2 exactly doubles qty + labor + money.
{
  const one = computeTakeoff([DOOR(1)], {});
  const two = computeTakeoff([DOOR(2)], {});
  eq('instanceCount=2: line count unchanged', two.lines.length, one.lines.length);
  one.lines.forEach((a, i) => {
    const b = two.lines[i];
    check(`instanceCount=2 doubles ${a.assemblyId}/${a.key}`,
      b.qty === 2 * a.qty && b.baseQty === 2 * a.baseQty && b.laborHrs === 2 * a.laborHrs
      && b.laborCents === 2 * a.laborCents && b.materialCents === 2 * a.materialCents && b.totalCents === 2 * a.totalCents,
      `x1 qty=${a.qty} labor=${a.laborCents} mat=${a.materialCents} vs x2 qty=${b.qty} labor=${b.laborCents} mat=${b.materialCents}`);
  });
  eq('instanceCount=2 doubles rollup materialCents', two.materialCents, 2 * one.materialCents);
  eq('instanceCount=2 doubles rollup laborCents', two.laborCents, 2 * one.laborCents);
}
// 4f. Money is integer cents, everywhere.
{
  const centKeys = ['materialCents', 'laborCents', 'equipmentCents', 'subCents', 'materialTaxCents',
    'burdenedLaborCents', 'generalConditionsCents', 'subtotalCents', 'overheadCents', 'contingencyCents',
    'profitCents', 'bondCents', 'sellCents'];
  check('integer cents: every rollup bucket', centKeys.every((k) => Number.isInteger(R[k])),
    centKeys.map((k) => `${k}=${R[k]}`).join(' '));
  check('integer cents: every line', R.lines.every((l) =>
    [l.materialCents, l.laborCents, l.equipmentCents ?? 0, l.subCents ?? 0, l.totalCents, l.unitMaterialCents].every(Number.isInteger)),
    'a line carries fractional cents');
}

/* ── 5. PEER PARITY — same fixtures through the sibling repo's lib/takeoff ───── */
// Peer discovery mirrors scripts/sync-heatmap-engine.mjs: $SAGUARO_PEER_DIR, then the
// standard local layout. Missing peer (CI/Vercel) skips with a notice, never fails.
const HERE = dirname(dirname(fileURLToPath(import.meta.url)));
const isMobile = existsSync(join(HERE, 'app.config.ts'));
const peerCandidates = process.env.SAGUARO_PEER_DIR
  ? [process.env.SAGUARO_PEER_DIR]
  : isMobile
    ? ['D:/saguaro-web', join(HERE, '..', 'saguaro-web'), 'D:/Live-Code-Saguaro']
    : ['D:/Saguaro-Field', join(HERE, '..', 'Saguaro-Field')];
const peer = peerCandidates.map((p) => resolve(p)).find((p) => existsSync(join(p, 'lib', 'takeoff', 'engine.ts')));
if (!peer) {
  console.log('peer repo not found on this machine — peer-parity skipped (enforced on dev machines; set SAGUARO_PEER_DIR to point at it).');
} else {
  const pe = await import(pathToFileURL(join(peer, 'lib', 'takeoff', 'engine.ts')).href);
  const pg = await import(pathToFileURL(join(peer, 'lib', 'takeoff', 'geometry.ts')).href);
  check(`peer parity: computeTakeoff deep-equals (${peer})`,
    stable(pe.computeTakeoff(CONDS(), OPTS())) === stable(R), 'peer engine prices the same takeoff differently');
  check('peer parity: explodeTakeoff deep-equals',
    stable(pe.explodeTakeoff(CONDS(), OPTS())) === stable(explodeTakeoff(CONDS(), OPTS())), 'peer explode stage diverged');
  check('peer parity: applyMarkupStack anchor deep-equals',
    stable(pe.applyMarkupStack({ materialCents: 100000, laborCents: 50000 }, OPTS())) === stable(M), 'peer markup stack diverged');
  check('peer parity: geometry (area / perimeter / linear / count)',
    pg.measure('area', RING(), 10) === 2400 && round2(pg.perimeterLF(RING(), 10)) === 200
    && pg.measure('linear', [{ x: 0, y: 0 }, { x: 1000, y: 0 }], 10) === 100 && pg.measure('count', [], 10, 7) === 7,
    'peer geometry measured differently');
}

console.log(`\nTAKEOFF GOLDENS: ${passed}/${total} passed${passed === total ? '' : ' — ENGINE OUTPUT MOVED. A golden mismatch is a bid-changing event.'}`);
if (passed !== total) process.exitCode = 1;
