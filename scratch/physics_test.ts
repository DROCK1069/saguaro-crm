// Physics proofs for the improved heatmap RF engine (audits #15/#16/#17).
//   npx esbuild scratch/physics_test.ts --bundle --platform=node --format=cjs | node
import * as fs from 'fs';
import { computeCoverage, inspectAt, cellRf, noiseFloorDbm } from '../lib/heatmap/engine';
import { relativeGainDb, frontToBackDb } from '../lib/heatmap/antenna';
import { estimateCapacity, mcsForSnr, phyRateMbps, base20Mbps, MCS_TABLE } from '../lib/heatmap/capacity';
import type { HeatmapProject, Device, CoverageResult } from '../lib/heatmap/types';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, extra = '') => { if (c) { pass++; console.log('  PASS', n, extra); } else { fail++; console.log('  FAIL', n, extra); } };
const approx = (a: number, b: number, tol = 0.15) => Math.abs(a - b) <= tol;

const mk = (over: Partial<HeatmapProject>): HeatmapProject => ({
  id: 'p', name: 't', planDataUrl: '', imgW: 420, imgH: 320,
  scale: { pxPerFt: 8 }, env: 'office', walls: [], devices: [],
  activeType: 'wifi_ap', rssiTargetDbm: -67, heatmapOpacity: 0.6, ...over,
});
const ap = (id: string, x: number, y: number, extra: Partial<Device> = {}): Device => ({
  id, typeId: 'wifi_ap', pos: { x, y }, band: '5', txPowerDbm: 20, antennaGainDbi: 3, ...extra,
});

/* ══ #15 ANTENNA PATTERN: directional AP beams — less signal BEHIND than in FRONT ══ */
console.log('\n[#15] Antenna radiation patterns');
{
  // relativeGainDb unit properties: boresight = 0, behind = −FBR, half-beamwidth = −3 dB.
  ok('patch boresight offset = 0 dB', relativeGainDb('patch', 0, 0, 0, 0) === 0);
  ok('patch directly behind = −FBR', approx(relativeGainDb('patch', 180, 0, 0, 0), -frontToBackDb('patch')), `(${relativeGainDb('patch', 180, 0, 0, 0).toFixed(1)} dB)`);
  // half-power at ±beamwidth/2: with 60° beamwidth override, ±30° → −3 dB (the "12" coeff).
  ok('−3 dB at half-beamwidth (60° bw → ±30°)', approx(relativeGainDb('patch', 30, 0, 0, 0, 60), -3, 0.05), `(${relativeGainDb('patch', 30, 0, 0, 0, 60).toFixed(2)} dB)`);
  ok('omni is isotropic in azimuth (0 dB everywhere at horizon)',
    [0, 45, 90, 135, 180].every((a) => relativeGainDb('omni', a, 0, 0, 0) === 0));
  ok('omni has an upward null (straight up < horizon)', relativeGainDb('omni', 0, 90, 0, 0) < relativeGainDb('omni', 0, 0, 0, 0));

  // Through the ENGINE: a patch AP pointing EAST (azimuth 0). Front (east) > back (west), equal distance.
  const cx = 210, cy = 160, d = 80;
  const dir = mk({ devices: [ap('a1', cx, cy, { antennaPattern: 'patch', azimuthDeg: 0, antennaGainDbi: 6 })] });
  const front = inspectAt({ x: cx + d, y: cy }, dir).value; // east = boresight
  const back = inspectAt({ x: cx - d, y: cy }, dir).value;  // west = behind
  ok('directional AP: FRONT signal > BEHIND signal', front > back, `(front ${front.toFixed(1)} > back ${back.toFixed(1)} dBm)`);
  ok('directional front-to-back gap ≈ FBR', approx(front - back, frontToBackDb('patch'), 0.5), `(${(front - back).toFixed(1)} dB)`);

  // Omni control: same geometry, no pattern → front == back (byte-compatible isotropy).
  const omni = mk({ devices: [ap('a1', cx, cy, { antennaGainDbi: 6 })] });
  const of = inspectAt({ x: cx + d, y: cy }, omni).value;
  const ob = inspectAt({ x: cx - d, y: cy }, omni).value;
  ok('omni (no pattern): front == back (isotropic)', of === ob, `(${of.toFixed(2)} == ${ob.toFixed(2)})`);
}

/* ══ #16 CAPACITY / THROUGHPUT: SNR→MCS→PHY rate, streams scale ══ */
console.log('\n[#16] Capacity / throughput');
{
  // MCS table reproduces published 802.11ax HE 20 MHz / 1-SS rates (formula + citation check).
  ok('HE MCS0 @20/1SS ≈ 8.6 Mbps', approx(base20Mbps(MCS_TABLE[0]), 8.6, 0.1), `(${base20Mbps(MCS_TABLE[0]).toFixed(2)})`);
  ok('HE MCS7 @20/1SS ≈ 86.0 Mbps', approx(base20Mbps(MCS_TABLE[7]), 86.0, 0.2), `(${base20Mbps(MCS_TABLE[7]).toFixed(2)})`);
  ok('HE MCS9 @20/1SS ≈ 114.7 Mbps', approx(base20Mbps(MCS_TABLE[9]), 114.7, 0.2), `(${base20Mbps(MCS_TABLE[9]).toFixed(2)})`);
  ok('HE MCS11 @20/1SS ≈ 143.4 Mbps', approx(base20Mbps(MCS_TABLE[11]), 143.4, 0.2), `(${base20Mbps(MCS_TABLE[11]).toFixed(2)})`);

  // Higher SNR → higher MCS → higher throughput.
  const lowMcs = mcsForSnr(10)!, hiMcs = mcsForSnr(30)!;
  ok('higher SNR selects a higher MCS index', hiMcs.idx > lowMcs.idx, `(SNR10→MCS${lowMcs.idx}, SNR30→MCS${hiMcs.idx})`);
  ok('higher SNR → higher PHY rate', phyRateMbps(30, 20, 1) > phyRateMbps(10, 20, 1), `(${phyRateMbps(10, 20, 1).toFixed(0)} → ${phyRateMbps(30, 20, 1).toFixed(0)} Mbps)`);
  ok('SNR below MCS0 threshold → 0 Mbps (cannot decode)', phyRateMbps(0, 20, 1) === 0);

  // More spatial streams → more throughput (MIMO linear scaling).
  ok('4 streams > 1 stream (same SNR/width)', phyRateMbps(30, 80, 4) > phyRateMbps(30, 80, 1), `(1SS ${phyRateMbps(30, 80, 1).toFixed(0)} → 4SS ${phyRateMbps(30, 80, 4).toFixed(0)} Mbps)`);
  ok('4 streams ≈ 4× 1 stream', approx(phyRateMbps(30, 80, 4) / phyRateMbps(30, 80, 1), 4, 0.01));
  // Wider channel → more throughput.
  ok('80 MHz > 20 MHz (same SNR/streams)', phyRateMbps(30, 80, 2) > phyRateMbps(30, 20, 2));

  // estimateCapacity end-to-end: a single strong AP, 4SS beats 1SS aggregate.
  const covOf = (ss: number): CoverageResult =>
    computeCoverage(mk({ devices: [ap('a1', 210, 160, { channel: 36, spatialStreams: ss, widthMhz: 80 })] }), 12);
  const cap1 = estimateCapacity(mk({ devices: [ap('a1', 210, 160, { channel: 36, spatialStreams: 1, widthMhz: 80 })] }), covOf(1));
  const cap4 = estimateCapacity(mk({ devices: [ap('a1', 210, 160, { channel: 36, spatialStreams: 4, widthMhz: 80 })] }), covOf(4));
  ok('estimateCapacity: 4-stream AP aggregate > 1-stream AP', cap4.aggregateMbps > cap1.aggregateMbps, `(1SS ${cap1.aggregateMbps} → 4SS ${cap4.aggregateMbps} Mbps)`);
  ok('estimateCapacity: perApMbps + avg populated', cap4.perApMbps.length === 1 && cap4.perApMbps[0].mbps > 0 && cap4.avgMbpsPerCoveredCell > 0);
  ok('clientCapacityAtRate(25) = floor(aggregate/25)', cap4.clientCapacityAtRate(25) === Math.floor(cap4.aggregateMbps / 25), `(${cap4.clientCapacityAtRate(25)} clients @25 Mbps)`);
}

/* ══ #17 REAL SINR CO-CHANNEL INTERFERENCE ══ */
console.log('\n[#17] Real SINR co-channel interference');
{
  ok('noise floor @20 MHz ≈ −94 dBm (kTB+NF)', approx(noiseFloorDbm(20), -94, 0.1), `(${noiseFloorDbm(20).toFixed(1)})`);
  ok('noise floor @80 MHz ≈ −88 dBm', approx(noiseFloorDbm(80), -88, 0.1), `(${noiseFloorDbm(80).toFixed(1)})`);
  ok('wider channel → higher (worse) noise floor', noiseFloorDbm(80) > noiseFloorDbm(20));

  const p = mk({});
  const pt = { x: 210, y: 160 };
  const a1 = ap('a1', 150, 160, { channel: 36 });
  const a2co = ap('a2', 270, 160, { channel: 36 }); // co-channel
  const a2diff = ap('a2', 270, 160, { channel: 149 }); // different channel

  const one = cellRf(pt, [a1], p);
  const twoCo = cellRf(pt, [a1, a2co], p);
  const twoDiff = cellRf(pt, [a1, a2diff], p);

  ok('single AP: SINR == SNR (no interferers)', approx(one.sinrDb, one.snrDb, 0.001), `(SINR ${one.sinrDb.toFixed(1)} = SNR ${one.snrDb.toFixed(1)})`);
  ok('two CO-channel APs give LOWER SINR than one', twoCo.sinrDb < one.sinrDb, `(1AP ${one.sinrDb.toFixed(1)} → 2co ${twoCo.sinrDb.toFixed(1)} dB)`);
  ok('co-channel neighbor is flagged interfered', twoCo.interfered === true);
  ok('two DIFFERENT-channel APs do NOT degrade SINR', approx(twoDiff.sinrDb, one.sinrDb, 0.001), `(2diff ${twoDiff.sinrDb.toFixed(1)} dB)`);
  ok('different-channel neighbor NOT flagged interfered', twoDiff.interfered === false);

  // Sum ALL interferers: three co-channel APs give lower SINR than two.
  const a3co = ap('a3', 210, 100, { channel: 36 });
  const threeCo = cellRf(pt, [a1, a2co, a3co], p);
  ok('SINR sums ALL co-channel interferers (3 < 2 < 1)', threeCo.sinrDb < twoCo.sinrDb && twoCo.sinrDb < one.sinrDb, `(${one.sinrDb.toFixed(1)} > ${twoCo.sinrDb.toFixed(1)} > ${threeCo.sinrDb.toFixed(1)})`);

  // Coverage gate uses SINR: two strong co-equal co-channel APs can drop a cell to uncovered.
  const collide = mk({ devices: [ap('a1', 200, 160, { channel: 36 }), ap('a2', 220, 160, { channel: 36 })] });
  const midCollide = cellRf({ x: 210, y: 160 }, collide.devices, collide);
  ok('co-equal co-channel overlap crushes SINR below the coverage floor', midCollide.sinrDb < 5, `(SINR ${midCollide.sinrDb.toFixed(1)} dB)`);
}

/* ══ #REGRESSION: omni-no-pattern byte-compatible vs saved ORIGINAL-engine baseline ══ */
console.log('\n[baseline] Omni / no-co-channel output unchanged vs pre-change engine');
{
  const base = JSON.parse(fs.readFileSync('scratch/baseline_omni.json', 'utf8')) as any[];
  const project = (r: CoverageResult) => r.cells.map((c) => (c ? { covered: c.covered, value: c.value, color: c.color, rgba: c.rgba, opacity: c.opacity } : null));
  // Rebuild the EXACT scenarios the baseline captured.
  const scen: Record<string, HeatmapProject> = {
    'single-omni-nochannel': mk({ devices: [ap('a1', 210, 160)] }),
    'single-omni-channel36': mk({ devices: [ap('a1', 210, 160, { channel: 36 })] }),
    'two-omni-diff-channels': mk({ devices: [ap('a1', 120, 160, { channel: 36 }), ap('a2', 300, 160, { channel: 40 })] }),
    'walls-two-omni-diff': mk({
      walls: [{ id: 'w1', a: { x: 210, y: 0 }, b: { x: 210, y: 320 }, material: 'concrete' }],
      devices: [ap('a1', 120, 160, { channel: 36 }), ap('a2', 300, 160, { channel: 149 })],
    }),
  };
  for (const b of base) {
    const cov = computeCoverage(scen[b.name], 10);
    const nowCells = project(cov);
    // Compare per-cell legacy fields.
    let cellMismatch = -1;
    for (let i = 0; i < b.cells.length; i++) {
      if (JSON.stringify(b.cells[i]) !== JSON.stringify(nowCells[i])) { cellMismatch = i; break; }
    }
    // Compare ONLY the original stat keys (new additive keys ignored).
    const statMismatch = Object.keys(b.stats).filter((k) => JSON.stringify((b.stats as any)[k]) !== JSON.stringify((cov.stats as any)[k]));
    ok(`baseline "${b.name}" cells byte-identical`, cellMismatch === -1, cellMismatch === -1 ? '' : `(cell ${cellMismatch}: ${JSON.stringify(b.cells[cellMismatch])} vs ${JSON.stringify(nowCells[cellMismatch])})`);
    ok(`baseline "${b.name}" stats byte-identical`, statMismatch.length === 0, statMismatch.length ? `(diff keys: ${statMismatch.join(',')})` : '');
  }
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
