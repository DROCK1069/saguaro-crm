/**
 * Heatmap engine sanity — AP-count discipline, end to end through the REAL engine.
 * Run: npx -y tsx lib/heatmap/sanity.test.ts   (exit 0 = every assertion held)
 *
 * Exists because auto-design flooded plans with APs (Chad, 20 Aug 2026: "it adds
 * way too many APs — GCs can do this correctly without our app"). Two causes:
 *   1. the placer pre-dated area anchoring (fixed by the area-anchored rewrite);
 *   2. the gap-fix pass added ONE AP PER ≥30 ft² pocket, unbounded — bypassing the
 *      density ceiling entirely (fixed by gapsWorthFixing: ≥150 ft², capped).
 * These tests pin both behaviors so neither regression can come back quietly.
 */
import type { Device, HeatmapProject } from './types';
import { autoPlaceAPs, gapsWorthFixing, recompute, MIN_GAP_FIX_FT2 } from './smart';

let failures = 0;
const check = (name: string, cond: boolean, detail: string) => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${name} — ${detail}`);
  if (!cond) failures++;
};

const proj = (ftW: number, ftH: number, pxPerFt: number, walls: HeatmapProject['walls'] = []): HeatmapProject => ({
  id: 't', name: 'test', planDataUrl: '', imgW: ftW * pxPerFt, imgH: ftH * pxPerFt,
  scale: { pxPerFt }, env: 'office', walls, devices: [], activeType: 'wifi_ap',
  rssiTargetDbm: -67, heatmapOpacity: 0.55,
});
const RADIO = { band: '5' as const, txPowerDbm: 20, antennaGainDbi: 5, label: 'Test AP' };
const cellOf = (p: HeatmapProject) => Math.max(16, Math.round(p.imgW / 40));
const apCount = (d: Device[]) => d.filter((x) => x.typeId === 'wifi_ap').length;

// ── A. The reported bug case: a 2,400 ft² suite must get ONE AP, not 8–10 ──
{
  const p = proj(60, 40, 10);
  const r = autoPlaceAPs(p, { targetPct: 0.92, ...RADIO });
  check('A: 2,400 ft² suite → 1 AP', r.aps.length === 1, `placed ${r.aps.length} (area basis ${r.areaFt2?.toFixed(0)} ft², ${r.perApFt2} ft²/AP)`);
}

// ── B. 8,000 ft² open-ish office → area anchor says 2; density ceiling is 6 ──
{
  const p = proj(100, 80, 10);
  const r = autoPlaceAPs(p, { targetPct: 0.92, ...RADIO });
  check('B: 8,000 ft² office → ≤2 APs from the placer', r.aps.length >= 1 && r.aps.length <= 2, `placed ${r.aps.length}`);
}

// ── C. Walled 15,000 ft² floor, FULL auto-design chain (place → compute → capped
//       gap fix). Total APs must never exceed the 1 AP / 1,500 ft² ceiling = 10. ──
{
  const k = 8; // px per ft
  const wallMat = 'concrete' as const;
  // a concrete cross partition that shadows corners → guarantees detected gaps
  const walls = [
    { id: 'w1', a: { x: 75 * k, y: 0 }, b: { x: 75 * k, y: 100 * k }, material: wallMat },
    { id: 'w2', a: { x: 0, y: 50 * k }, b: { x: 150 * k, y: 50 * k }, material: wallMat },
  ];
  let design = proj(150, 100, k, walls);
  const placed = autoPlaceAPs(design, { targetPct: 0.92, ...RADIO });
  design = { ...design, devices: [...design.devices, ...placed.aps] };
  const cov = recompute(design, cellOf(design));
  const rawGaps = cov.gaps ?? [];
  const oldFixCount = rawGaps.filter((g) => g.area > 30).length;      // the OLD unbounded rule
  const fix = gapsWorthFixing(design, rawGaps, apCount(design.devices)); // the NEW capped rule
  const totalAfter = apCount(design.devices) + fix.length;
  const ceiling = Math.ceil(15000 / 1500);
  check('C1: capped fix ≤ old unbounded fix', fix.length <= oldFixCount, `old rule would add ${oldFixCount}, capped rule adds ${fix.length}`);
  check('C2: total APs ≤ density ceiling', totalAfter <= ceiling, `${apCount(design.devices)} placed + ${fix.length} fix = ${totalAfter} ≤ ${ceiling}`);
  check('C3: every fixed gap is room-sized', fix.every((g) => g.area >= MIN_GAP_FIX_FT2), `${fix.length} gaps, all ≥ ${MIN_GAP_FIX_FT2} ft²`);
}

// ── D. Closet-sized pockets are never worth hardware ──
{
  const p = proj(100, 80, 10);
  const tiny = [{ area: 40, centroid: { x: 10, y: 10 }, bbox: { x: 0, y: 0, w: 20, h: 20 }, worst: -85 },
                { area: 120, centroid: { x: 30, y: 30 }, bbox: { x: 20, y: 20, w: 20, h: 20 }, worst: -84 }];
  const fix = gapsWorthFixing(p, tiny, 2);
  check('D: 40 & 120 ft² pockets → 0 APs', fix.length === 0, `fixable = ${fix.length}`);
}

// ── E. The ceiling holds even when handed a pile of large gaps ──
{
  const p = proj(60, 40, 10); // 2,400 ft² → ceiling = 2
  const bigGaps = Array.from({ length: 9 }, (_, i) => ({ area: 300, centroid: { x: i, y: i }, bbox: { x: 0, y: 0, w: 10, h: 10 }, worst: -85 }));
  const fix = gapsWorthFixing(p, bigGaps, 1);
  check('E: 9 large gaps on a small floor → ≤1 more AP', fix.length <= 1, `ceiling ${Math.ceil(2400 / 1500)}, existing 1, fixable ${fix.length}`);
}

// ── F. A single wall must never zero the footprint (the-building-is-a-line bug) ──
{
  const k = 10;
  const oneWall = [{ id: 'w', a: { x: 10 * k, y: 40 * k }, b: { x: 90 * k, y: 40 * k }, material: 'drywall' as const }];
  const p = proj(100, 80, k, oneWall);
  const r = autoPlaceAPs(p, { targetPct: 0.92, ...RADIO });
  check('F: one horizontal wall → design still covers the floor', r.aps.length >= 1 && (r.areaFt2 ?? 0) >= 7000, `placed ${r.aps.length}, area basis ${r.areaFt2?.toFixed(0)} ft²`);
}


/* ── G: THE FIELD-TRUTH CASE — Chad's golf-sim building (39.3 x 87 ft, 4 bays,
   drywall partitions, concrete shell). ONE AP covers it in real life; the model
   must agree at true scale. (At 2x-wrong scale the same pixels read as ~13,700
   ft\u00b2 and the engine wanted 4 APs — that is a SCALE error, which the UI now
   catches by echoing the computed ft\u00b2 the moment scale is set.) ── */
{
  const k = 10;
  const gw = (id: string, x1: number, y1: number, x2: number, y2: number, material: HeatmapProject['walls'][number]['material'] = 'drywall') =>
    ({ id, a: { x: x1 * k, y: y1 * k }, b: { x: x2 * k, y: y2 * k }, material });
  const golf = proj(39.3, 87, k, [
    gw('g1', 0, 0, 39.3, 0, 'concrete'), gw('g2', 39.3, 0, 39.3, 87, 'concrete'),
    gw('g3', 39.3, 87, 0, 87, 'concrete'), gw('g4', 0, 87, 0, 0, 'concrete'),
    gw('g5', 0, 29, 39.3, 29), gw('g6', 0, 58, 39.3, 58), gw('g7', 16, 0, 16, 29), gw('g8', 0, 72, 39.3, 72),
  ]);
  const placed = autoPlaceAPs(golf, { targetPct: 0.92, ...RADIO });
  const withAps = { ...golf, devices: placed.aps };
  const cov = recompute(withAps, cellOf(golf));
  const fixable = gapsWorthFixing(withAps, cov.gaps ?? [], apCount(placed.aps));
  const total = placed.aps.length + fixable.length;
  check('G: real 3,400 ft\u00b2 golf-sim building \u2192 exactly 1 AP (field-verified)', total === 1, `placed ${placed.aps.length} + fix ${fixable.length} = ${total} (basis ${placed.areaFt2?.toFixed(0)} ft\u00b2)`);
}

console.log(failures ? `\n${failures} FAILED` : '\nPASS — AP-count discipline holds through the real engine');
process.exit(failures ? 1 : 0);
