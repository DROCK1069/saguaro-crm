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
import { autoPlaceAPs, disciplineAiDevices, gapsWorthFixing, recompute, AI_CAMERA_FT2, MIN_GAP_FIX_FT2 } from './smart';
import { computeBom } from './bom';

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


/* ── H: AI-SCAN DISCIPLINE — the 20 Aug 2026 autopilot incident, replayed. On a
   2,400 ft² plan the vision model proposed 3 room-named APs + 6 cameras + 18
   sensors, several floating in the page margins. The AI reads drawings; the
   ENGINE places RF: AI APs ignored, outside devices dropped, counts capped. ── */
{
  const k = 10;
  // walls inset 5 ft so the "page margins" exist (footprint = [50..550]x[50..350] px)
  const inset = [
    { id: 'h1', a: { x: 5 * k, y: 5 * k }, b: { x: 55 * k, y: 5 * k }, material: 'drywall' as const },
    { id: 'h2', a: { x: 55 * k, y: 5 * k }, b: { x: 55 * k, y: 35 * k }, material: 'drywall' as const },
    { id: 'h3', a: { x: 55 * k, y: 35 * k }, b: { x: 5 * k, y: 35 * k }, material: 'drywall' as const },
    { id: 'h4', a: { x: 5 * k, y: 35 * k }, b: { x: 5 * k, y: 5 * k }, material: 'drywall' as const },
  ];
  const p = proj(60, 40, k, inset);
  const dev = (id: string, typeId: Device['typeId'], x: number, y: number): Device =>
    ({ id, typeId, pos: { x: x * k, y: y * k }, label: id });
  const scanned: Device[] = [
    dev('AP-Office', 'wifi_ap', 15, 15), dev('AP-Warehouse', 'wifi_ap', 40, 15), dev('AP-Storage', 'wifi_ap', 30, 28),
    // 6 cameras — 2 in the page margins
    dev('c1', 'camera', 10, 10), dev('c2', 'camera', 50, 10), dev('c3', 'camera', 30, 20),
    dev('c4', 'camera', 20, 30), dev('c5', 'camera', 58, 2), dev('c6', 'camera', 2, 38),
    // 18 sensors — 5 outside
    ...Array.from({ length: 13 }, (_, i) => dev(`s${i}`, 'smoke_detector_spot', 8 + (i % 5) * 9, 8 + Math.floor(i / 5) * 8)),
    ...Array.from({ length: 5 }, (_, i) => dev(`o${i}`, 'smoke_detector_spot', 58, 4 + i * 2)),
  ];
  const disc = disciplineAiDevices(p, scanned);
  const camCap = Math.max(2, Math.ceil(2400 / AI_CAMERA_FT2));
  const camsKept = disc.kept.filter((d) => d.typeId === 'camera').length;
  const withKept = { ...p, devices: disc.kept };
  const placed = autoPlaceAPs(withKept, { targetPct: 0.92, ...RADIO });
  check('H1: AI AP picks are ignored (engine owns Wi-Fi)', disc.droppedAps === 3, `dropped ${disc.droppedAps} AI APs`);
  check('H2: margin-floaters dropped', disc.droppedOutside >= 5, `dropped ${disc.droppedOutside} outside the footprint`);
  check(`H3: cameras capped at ${camCap} for 2,400 ft²`, camsKept <= camCap, `kept ${camsKept}`);
  check('H4: sensors trimmed to area density', disc.kept.filter((d) => d.typeId === 'smoke_detector_spot').length <= Math.ceil(2400 / 700) + 1, `kept ${disc.kept.filter((d) => d.typeId === 'smoke_detector_spot').length}`);
  check('H5: engine then places exactly 1 AP on 2,400 ft²', placed.aps.length === 1, `placed ${placed.aps.length}`);
}


/* ── I: A BIDDABLE LOW-VOLT SCHEDULE — the bid package must carry what a sub
   actually prices: terminations, patch panel, router+controller, ISP handoff,
   and full door hardware (mag lock, push-to-exit, controller, power). ── */
{
  const devs: Device[] = [
    { id: 'a1', typeId: 'wifi_ap', pos: { x: 100, y: 100 }, label: 'UniFi U6 Pro' },
    { id: 'k1', typeId: 'camera', pos: { x: 200, y: 100 }, label: 'UniFi G6 Turret' },
    { id: 'k2', typeId: 'camera', pos: { x: 300, y: 100 }, label: 'UniFi G6 Dome' },
    { id: 'r1', typeId: 'access_reader', pos: { x: 400, y: 100 }, label: 'Reader' },
  ];
  const bom = computeBom(devs);
  const items = bom.rows.map((r) => r.item.toLowerCase()).join(' | ');
  const has = (re: RegExp, name: string) => check(`I: schedule has ${name}`, re.test(items), items.slice(0, 160));
  has(/rj45 terminations/, 'RJ45 ends');
  has(/patch panel/, 'patch panel');
  has(/router \+ unifi network controller/, 'router + controller');
  has(/isp handoff/, 'modem/fiber allowance');
  has(/mag lock/, 'mag lock');
  has(/request-to-exit push button/, 'push-button entry');
  has(/door controller/, 'door controller');
  has(/poe switch/, 'PoE switch');
  has(/recorder/, 'NVR');
}

console.log(failures ? `\n${failures} FAILED` : '\nPASS — AP-count discipline holds through the real engine');
process.exit(failures ? 1 : 0);
