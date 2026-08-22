/**
 * Heatmap engine — smart layer: auto-placement (greedy set-cover), gap detection
 * (flood-fill CCL), WiFi channel planning (DSATUR-style), and coverage metrics.
 */
import type { Pt } from './geometry';
import { dist, pointInPolygon } from './geometry';
import type { Band, CoverageResult, Device, Env, GapRegion, HeatmapProject } from './types';
import { apUsableRadiusFt, cellRf, computeCoverage, healthScoreFromStats, MIN_SINR_COVER_DB, type CoverageOpts } from './engine';
import { CHANNELS_24, CHANNELS_5, RF_GAIN_DEFAULT_DBI, RF_TX_DEFAULT_DBM } from './models';
import { UNIFI_APS } from './unifi';
import type { UnifiAP } from './unifi';

let _idc = 0;
const uid = () => `ap_auto_${Date.now().toString(36)}_${_idc++}`;

/** Match a requested model name against the UniFi catalog (with/without the "UniFi " prefix). */
function findUnifiAp(name?: string): UnifiAP | undefined {
  if (!name) return undefined;
  const n = name.trim().toLowerCase();
  return UNIFI_APS.find(
    (a) => a.model.toLowerCase() === n || a.model.replace(/^UniFi\s+/i, '').toLowerCase() === n,
  );
}

/** Resolve the AP model to place: explicit opts.apModel, else a strong ceiling flagship. */
function resolveApModel(apModel?: string): UnifiAP {
  return (
    findUnifiAp(apModel) ||
    findUnifiAp('UniFi U7 Pro') ||
    UNIFI_APS.find((a) => a.form === 'ceiling' && !a.outdoor) ||
    UNIFI_APS[0]
  );
}

/** Pick the band to model for a given AP: the requested band if the model supports it, else 5/first. */
function resolveBand(model: UnifiAP, want: Band): Band {
  if (model.txDbm[want] != null) return want;
  if (model.txDbm['5'] != null) return '5';
  const first = Object.keys(model.txDbm)[0] as Band | undefined;
  return first ?? '5';
}

/** Resolve the radio to model with: explicit tx+gain (any vendor) wins, else the real
 *  UniFi catalog model. Shared by autoPlaceAPs and placeInGap so the two placement
 *  paths can never disagree about the hardware they simulate. */
function resolveRadio(opts: {
  band?: Band; apModel?: string; txPowerDbm?: number; antennaGainDbi?: number; label?: string;
}): { band: Band; txPowerDbm: number; antennaGainDbi: number; label: string } {
  const useExplicit = opts.txPowerDbm != null && opts.antennaGainDbi != null;
  const model = useExplicit ? null : resolveApModel(opts.apModel);
  const band = useExplicit ? (opts.band ?? '5') : resolveBand(model!, opts.band ?? '5');
  return {
    band,
    txPowerDbm: useExplicit ? opts.txPowerDbm! : (model!.txDbm[band] ?? model!.txDbm['5'] ?? 15),
    antennaGainDbi: useExplicit ? opts.antennaGainDbi! : model!.gainDbi,
    label: useExplicit ? (opts.label ?? 'AP') : model!.model,
  };
}

/* ── Footprint + area (foolproof auto-design foundation) ─────────────────────
   The OLD placer lattices candidate APs across the WHOLE image and drives the
   count off a coverage-% loop over that whole sheet. On a permit-set PDF (big
   sheet, title block, no drawn boundary) that means "cover the empty paper too",
   and the count swings wildly with the detected px/ft scale — the exact bug that
   produced 8-10 APs on a 2,400 sq ft suite. The new design ANCHORS the AP count
   to real floor AREA, masks everything to the building footprint, and hard-caps
   density so it can never flood. */

/** Absolute polygon area in px² (shoelace). <3 verts → 0. */
export function polygonAreaPx(poly: Pt[]): number {
  if (poly.length < 3) return 0;
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += (poly[j].x + poly[i].x) * (poly[j].y - poly[i].y);
  return Math.abs(a) / 2;
}
function bboxOf(pts: Pt[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) { if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y; if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y; }
  return { minX, minY, maxX, maxY };
}

/**
 * The building floor footprint used for auto-design: the drawn boundary polygon
 * if present, else a rectangle derived from the wall geometry (so we never design
 * over empty sheet margins / title blocks), else the whole image (last resort).
 * Returns the polygon (image px) and its area in ft² (0 when the plan is unscaled).
 */
export function deriveFootprint(p: HeatmapProject): { poly: Pt[]; areaFt2: number } {
  const pxPerFt = p.scale?.pxPerFt ?? 0;
  let poly: Pt[];
  if ((p.boundary?.length ?? 0) >= 3) {
    poly = p.boundary!;
  } else if (p.walls.length) {
    const pts: Pt[] = [];
    for (const w of p.walls) { pts.push(w.a, w.b); }
    const b = bboxOf(pts);
    /* One wall (or a hand-tapped near-collinear pair) gives a zero/sliver bbox —
       "the building is a line" — which zeroed areaFt2, so auto-design returned 0
       APs WITH a success toast and the gap-fix pass disabled itself (review
       finding). Trust the walls bbox only when it is plausibly a floor: both
       sides ≥ 8 ft. Otherwise design over the whole image, the same fallback an
       empty plan uses. */
    const wallW = b.maxX - b.minX, wallH = b.maxY - b.minY;
    const minPx = pxPerFt > 0 ? pxPerFt * 8 : Math.min(p.imgW, p.imgH) * 0.05;
    poly = wallW >= minPx && wallH >= minPx
      ? [{ x: b.minX, y: b.minY }, { x: b.maxX, y: b.minY }, { x: b.maxX, y: b.maxY }, { x: b.minX, y: b.maxY }]
      : [{ x: 0, y: 0 }, { x: p.imgW, y: 0 }, { x: p.imgW, y: p.imgH }, { x: 0, y: p.imgH }];
  } else {
    poly = [{ x: 0, y: 0 }, { x: p.imgW, y: 0 }, { x: p.imgW, y: p.imgH }, { x: 0, y: p.imgH }];
  }
  const areaFt2 = pxPerFt > 0 ? polygonAreaPx(poly) / (pxPerFt * pxPerFt) : 0;
  return { poly, areaFt2 };
}

export type CoverageDensity = 'basic' | 'standard' | 'high' | 'max';
/**
 * Floor area (ft²) a single modern enterprise AP (Wi-Fi 6/7, 5 GHz primary) is
 * planned to serve, by environment + density goal. Coverage-oriented professional
 * figures: an office AP comfortably blankets ~3,000 sq ft; open plans stretch
 * further; dense/high-device areas pack tighter for capacity, not coverage.
 */
export function areaPerApFt2(env: Env, density: CoverageDensity = 'standard'): number {
  const base = env === 'open' ? 6000 : env === 'dense' ? 2500 : 4000;
  const mult = density === 'basic' ? 1.5 : density === 'high' ? 0.6 : density === 'max' ? 0.4 : 1;
  return Math.round(base * mult);
}

/** Minimum center-to-center AP separation (ft) for a given area-per-AP budget:
 *  0.55 × the radius of the circle one AP is budgeted to serve, floored at 12 ft.
 *  Two radios closer than this are one radio's coverage plus extra co-channel
 *  interference — the "auto-design stacked an AP on an AP" failure mode. Every
 *  engine placement path (seeding, gap-fill, placeInGap) enforces this invariant. */
export function minApSeparationFt(perApFt2: number): number {
  return Math.max(12, 0.55 * Math.sqrt(perApFt2 / Math.PI));
}
/** Keep points ≥ minSepPx from every `fixed` point and from each other (order-preserving).
 *  Also collapses Lloyd-relaxation collisions (two seeds snapped to one candidate). */
function enforceMinSep(pts: Pt[], fixed: Pt[], minSepPx: number): Pt[] {
  const kept: Pt[] = [];
  for (const q of pts) {
    let ok = true;
    for (const f of fixed) if (dist(q, f) < minSepPx) { ok = false; break; }
    if (ok) for (const k of kept) if (dist(q, k) < minSepPx) { ok = false; break; }
    if (ok) kept.push(q);
  }
  return kept;
}

/** Sample points on a grid that fall INSIDE the footprint polygon (image px). */
function interiorPoints(poly: Pt[], spacingPx: number): Pt[] {
  const b = bboxOf(poly);
  const out: Pt[] = [];
  if (!Number.isFinite(b.minX) || spacingPx <= 0) return out;
  for (let y = b.minY + spacingPx / 2; y < b.maxY; y += spacingPx)
    for (let x = b.minX + spacingPx / 2; x < b.maxX; x += spacingPx) {
      const q = { x, y };
      if (pointInPolygon(q, poly)) out.push(q);
    }
  return out;
}
const nearest = (q: Pt, pts: Pt[]): Pt => pts.reduce((best, p) => (dist(q, p) < dist(q, best) ? p : best), pts[0]);

/** Farthest-point (k-center) seeding: even spread of `m` points over the candidates,
 *  repelled from any already-placed APs. First point is the one nearest the centroid. */
function farthestSeed(cands: Pt[], m: number, repel: Pt[]): Pt[] {
  if (!cands.length || m <= 0) return [];
  const want = Math.min(m, cands.length); // m > |candidates| would loop into duplicate cands[0] picks
  const cx = cands.reduce((s, p) => s + p.x, 0) / cands.length;
  const cy = cands.reduce((s, p) => s + p.y, 0) / cands.length;
  const chosen: Pt[] = [nearest({ x: cx, y: cy }, cands)];
  while (chosen.length < want) {
    let best = -1, bestD = -1;
    for (let i = 0; i < cands.length; i++) {
      let md = Infinity;
      for (const c of chosen) { const d = dist(cands[i], c); if (d < md) md = d; }
      for (const c of repel) { const d = dist(cands[i], c); if (d < md) md = d; }
      if (md > bestD) { bestD = md; best = i; }
    }
    if (best < 0) break;
    chosen.push(cands[best]);
  }
  return chosen;
}
/** Lloyd relaxation: pull each AP to the centroid of the interior points it serves. */
function lloyd(aps: Pt[], cands: Pt[], iters: number): Pt[] {
  let cur = aps.slice();
  for (let it = 0; it < iters; it++) {
    const sum = cur.map(() => ({ x: 0, y: 0, n: 0 }));
    for (const c of cands) {
      let bi = 0, bd = Infinity;
      for (let i = 0; i < cur.length; i++) { const d = dist(c, cur[i]); if (d < bd) { bd = d; bi = i; } }
      sum[bi].x += c.x; sum[bi].y += c.y; sum[bi].n++;
    }
    cur = cur.map((a, i) => (sum[i].n ? nearest({ x: sum[i].x / sum[i].n, y: sum[i].y / sum[i].n }, cands) : a));
  }
  return cur;
}

/**
 * Foolproof AP auto-placement. The AP COUNT is anchored to real floor area (not a
 * coverage-% sweep over the whole sheet), everything is masked to the building
 * footprint, and density is hard-capped (≥1 AP / 700 sq ft) so it can never flood.
 * APs are spread evenly (k-center + Lloyd), then a bounded gap-fill tops up genuine
 * holes up to the cap. Uses a REAL UniFi model (per-band TX + gain) for BOM accuracy.
 *
 * Invariants:
 *  - MIN SEPARATION: no placement (seeded or gap-fill) lands within minApSeparationFt
 *    of any other AP — the same-spot / stacked-AP failure mode is structurally out.
 *  - SAME GATE AS THE MAP: verification runs engine.cellRf (shared wall model) with a
 *    provisional channel plan and requires RSSI ≥ target AND SINR ≥ MIN_SINR_COVER_DB —
 *    exactly the gate the rendered heatmap paints, so auto-design can never claim
 *    coverage the map then shows as dead.
 *  - REPLACE-NOT-APPEND: emitted APs carry autoPlaced: true and previously auto-placed
 *    APs are ignored as anchors; callers persist via replaceAutoPlacedAps so re-running
 *    the design converges to the same layout instead of doubling the count.
 */
export function autoPlaceAPs(
  p: HeatmapProject,
  opts: {
    targetPct?: number; maxDevices?: number; band?: Band; apModel?: string;
    /** Coverage density goal → floor-area budget per AP (see areaPerApFt2). */
    density?: CoverageDensity;
    /** Explicit floor-area-per-AP override (ft²); wins over density/env. */
    areaPerApFt2?: number;
    /** Explicit radio override (multi-vendor): when tx+gain are given, model any
     *  vendor's AP without needing it in the UniFi catalog. UniFi path is unchanged
     *  when these are omitted. */
    txPowerDbm?: number; antennaGainDbi?: number; label?: string;
  } = {},
): {
  aps: Device[]; achievedPct: number; metTarget: boolean;
  areaFt2?: number; footprintFt?: { w: number; h: number }; perApFt2?: number;
  scaleSuspect?: boolean; apModel?: string; minSepFt?: number;
} {
  const empty = { aps: [] as Device[], achievedPct: 0, metTarget: false };
  if (!p.scale || !(p.scale.pxPerFt > 0)) return empty;
  const targetPct = opts.targetPct ?? 0.95;
  const target = p.rssiTargetDbm;

  // Resolve the band/TX/gain to model with. An explicit tx+gain (any vendor) wins;
  // otherwise fall back to the real UniFi catalog model (unchanged default behavior).
  const radio = resolveRadio(opts);
  const band = radio.band;
  const modelTxDbm = radio.txPowerDbm, modelGainDbi = radio.antennaGainDbi, modelLabel = radio.label;

  // ── 1. Footprint + real floor area ──
  const { poly, areaFt2 } = deriveFootprint(p);
  if (!(areaFt2 > 0)) return empty; // unscaled → refuse (UI prompts to calibrate)
  const fb = bboxOf(poly);
  const footprintFt = { w: (fb.maxX - fb.minX) / p.scale.pxPerFt, h: (fb.maxY - fb.minY) / p.scale.pxPerFt };
  // Scale sanity: a real single-floor footprint is ~4–1200 ft per side / < ~400k ft².
  // Outside that the detected px/ft is almost certainly wrong — placing dozens of APs
  // off a bad scale is the failure mode we refuse to repeat, so we flag + soft-cap.
  const maxDimFt = Math.max(footprintFt.w, footprintFt.h);
  const scaleSuspect = maxDimFt > 1200 || maxDimFt < 4 || areaFt2 > 400_000;

  // ── 2. Area-anchored AP count with a hard density cap ──
  const perAp = opts.areaPerApFt2 ?? areaPerApFt2(p.env, opts.density ?? 'standard');
  const areaCount = Math.max(1, Math.ceil(areaFt2 / perAp));
  const hardCap = Math.max(1, Math.ceil(areaFt2 / 1500)); // absolute safety ceiling ~1 AP / 1,500 sq ft
  // When the scale looks wrong, never dump a swarm — cap hard and let the UI ask
  // the user to confirm the scale (the derived ft dimensions make the error obvious).
  const gapTopup = areaCount <= 2 ? 0 : Math.ceil(areaCount * 0.3);
  const maxDevices = Math.min(opts.maxDevices ?? 40, hardCap, areaCount + gapTopup, scaleSuspect ? 12 : 999);

  // ── 3. Interior candidate + eval points (masked to the footprint) ──
  const step = Math.max(14, Math.round(Math.min(p.imgW, p.imgH) / 60));
  const spacingPx = Math.max(step, p.scale.pxPerFt * 4); // ~every 4 ft
  let cells = interiorPoints(poly, spacingPx);
  if (cells.length < 8) cells = interiorPoints(poly, Math.max(6, step)); // finer fallback for small plans
  if (!cells.length) return empty;

  // ── 3.5 Verification with the SAME gate as the rendered map ──
  // engine.cellRf (shared wall model) with RSSI ≥ target AND SINR ≥ MIN_SINR_COVER_DB.
  // Channels are only assigned after placement, so each candidate layout first gets a
  // PROVISIONAL planChannels pass — RSSI-only verification used to claim coverage the
  // SINR-gated map then painted dead. Hand-placed APs verify with their REAL radios;
  // previously auto-placed APs are excluded (replace-not-append, see invariant above).
  const handAps = p.devices.filter((d) => d.typeId === 'wifi_ap' && !d.autoPlaced);
  const existing = handAps.map((d) => ({ ...d.pos }));
  const minSepFt = minApSeparationFt(perAp);
  const minSepPx = minSepFt * p.scale.pxPerFt;
  const provisional = (addedPts: Pt[]): Device[] => {
    const devs: Device[] = [
      ...handAps.map((d) => ({ ...d })),
      ...addedPts.map((pos, i): Device => ({
        id: `prov_${i}`, typeId: 'wifi_ap', pos, band,
        txPowerDbm: modelTxDbm, antennaGainDbi: modelGainDbi,
      })),
    ];
    const plan = planChannels({ ...p, devices: devs }, band === '2.4' ? '2.4' : '5');
    for (const d of devs) d.channel = plan[d.id];
    return devs;
  };
  const verify = (addedPts: Pt[]): { frac: number; site: Pt | null } => {
    const allPos = existing.concat(addedPts);
    if (!allPos.length) return { frac: 0, site: cells[0] ?? null };
    const devs = provisional(addedPts);
    const sepOk = (c: Pt) => allPos.every((a) => dist(c, a) >= minSepPx);
    let cov = 0;
    let worst: Pt | null = null, worstV = Infinity;   // weakest RSSI-starved cell anywhere
    let far: Pt | null = null, farD = -1;             // farthest min-sep-legal RSSI-starved cell
    for (const cell of cells) {
      const rf = cellRf(cell, devs, p);
      if (rf.signalDbm >= target && rf.sinrDb >= MIN_SINR_COVER_DB) { cov++; continue; }
      if (rf.signalDbm >= target) continue; // SINR-only failure — another radio would worsen it
      if (rf.signalDbm < worstV) { worstV = rf.signalDbm; worst = cell; }
      if (sepOk(cell)) {
        let md = Infinity;
        for (const a of allPos) { const d = dist(cell, a); if (d < md) md = d; }
        if (md > farD) { farD = md; far = cell; }
      }
    }
    // Min-separation invariant: the worst cell is only a legal AP site when it clears
    // minSepFt of every AP; otherwise relocate to the farthest legal starved cell.
    const site = worst && sepOk(worst) ? worst : far;
    return { frac: cov / cells.length, site };
  };

  // ── 4. Place: keep HAND-PLACED APs as anchors, add the area-anchored remainder,
  // spread evenly. Every placement honors the min-separation invariant. ──
  const targetCount = Math.min(areaCount, maxDevices); // never exceed the density / scale-suspect cap
  const toAdd = Math.max(existing.length ? 0 : 1, targetCount - existing.length);
  let added = farthestSeed(cells, toAdd, existing);
  if (added.length > 1) added = lloyd(added, cells, 2);
  added = enforceMinSep(added, existing, minSepPx); // drop Lloyd collisions / same-spot seeds

  // ── 5. Bounded gap-fill: only close GENUINE RSSI holes, never exceed the density
  // cap, never violate min separation (verify() only ever proposes legal sites) ──
  let { frac, site } = verify(added);
  let guard = 0;
  while (frac < targetPct && existing.length + added.length < maxDevices && site && guard++ < 30) {
    added.push(site);
    ({ frac, site } = verify(added));
  }

  const placed: Device[] = added.map((pos) => ({
    id: uid(), typeId: 'wifi_ap', pos: { ...pos }, band,
    txPowerDbm: modelTxDbm, antennaGainDbi: modelGainDbi, label: modelLabel,
    autoPlaced: true,
  }));
  return {
    aps: placed, achievedPct: frac, metTarget: frac >= targetPct,
    // design basis (surfaced by the UI so the count is transparent + auditable)
    areaFt2, footprintFt, perApFt2: perAp, scaleSuspect, apModel: modelLabel, minSepFt,
  };
}

/** Dead zones worth an AP of HARDWARE — a room, not a closet. Smaller pockets are
 *  placement/antenna tweaks; stacking an AP into every 30 ft² shadow is exactly how
 *  the old fix pass flooded a design the area-anchored placer had sized correctly. */
export const MIN_GAP_FIX_FT2 = 150;

/**
 * Filter detected gaps down to the ones a fix pass should actually close:
 * ≥ MIN_GAP_FIX_FT2, and never so many that the floor would exceed the SAME
 * 1 AP / 1,500 ft² density ceiling autoPlaceAPs enforces — the fix pass used
 * to bypass that cap entirely (one AP per gap, unbounded), which is where
 * "way too many APs" came from even after the placer was anchored to area.
 * Gaps arrive sorted largest-first, so the cap keeps the ones that matter.
 */
export function gapsWorthFixing(p: HeatmapProject, gaps: GapRegion[], existingApCount: number): GapRegion[] {
  const real = gaps.filter((g) => g.area >= MIN_GAP_FIX_FT2);
  if (!real.length) return [];
  const { areaFt2 } = deriveFootprint(p);
  if (!(areaFt2 > 0)) return [];
  const cap = Math.max(1, Math.ceil(areaFt2 / 1500));
  const room = Math.max(0, cap - existingApCount);
  return real.slice(0, room);
}

/** Outcome of a placeInGap fix attempt. `skipped` gaps place NO hardware — report why. */
export interface GapFix {
  /** The AP to add (tagged autoPlaced), or null when the gap was skipped. */
  device: Device | null;
  skipped: boolean;
  /** Why the gap was skipped: no scale, nothing actually uncovered inside it, or no
   *  legal site clears the min-separation invariant (placement/antenna tweak instead). */
  reason?: 'unscaled' | 'no-uncovered-cell' | 'min-separation';
}

/**
 * Place ONE AP to close a detected dead zone — the engine-owned "fix dead zones" op.
 * Targets the WORST UNCOVERED CELL inside the gap region, NEVER the raw centroid: a
 * concave or annular dead zone's centroid is the MEAN of its member cells and can
 * land directly ON the existing AP the zone wraps around (the same-spot killer).
 * Coverage is judged with the SAME RSSI + SINR gate the rendered map paints, and the
 * min-separation invariant holds: a site within minApSeparationFt of any existing AP
 * is relocated to the farthest legal uncovered cell in the gap, else the gap is
 * skipped and reported (small shadows are placement/antenna tweaks, not hardware).
 */
export function placeInGap(
  p: HeatmapProject,
  gap: GapRegion,
  opts: {
    band?: Band; apModel?: string; txPowerDbm?: number; antennaGainDbi?: number; label?: string;
    density?: CoverageDensity;
    /** Explicit floor-area-per-AP override (ft²) — must match the autoPlaceAPs call. */
    areaPerApFt2?: number;
  } = {},
): GapFix {
  if (!p.scale || !(p.scale.pxPerFt > 0)) return { device: null, skipped: true, reason: 'unscaled' };
  const radio = resolveRadio(opts);
  const perAp = opts.areaPerApFt2 ?? areaPerApFt2(p.env, opts.density ?? 'standard');
  const minSepPx = minApSeparationFt(perAp) * p.scale.pxPerFt;
  const aps = p.devices.filter((d) => d.typeId === 'wifi_ap');
  const { poly } = deriveFootprint(p);
  const target = p.rssiTargetDbm;

  // Sample the gap REGION (bbox masked to the footprint) with the map's combined gate.
  const b = gap.bbox;
  const spacing = Math.max(4, p.scale.pxPerFt * 2, b.w / 24, b.h / 24); // ~2 ft, ≤ ~600 samples
  let worstCell: Pt | null = null; let worstV = Infinity;  // weakest uncovered cell in the gap
  let farCell: Pt | null = null; let farD = -1;            // farthest min-sep-legal uncovered cell
  for (let y = b.y + spacing / 2; y < b.y + b.h; y += spacing) {
    for (let x = b.x + spacing / 2; x < b.x + b.w; x += spacing) {
      const q = { x, y };
      if (!pointInPolygon(q, poly)) continue;
      const rf = aps.length ? cellRf(q, aps, p) : null;
      const covered = rf != null && rf.signalDbm >= target && rf.sinrDb >= MIN_SINR_COVER_DB;
      if (covered) continue;
      const v = rf ? rf.signalDbm : -Infinity;
      if (v < worstV) { worstV = v; worstCell = q; }
      let md = Infinity;
      for (const a of aps) { const d = dist(q, a.pos); if (d < md) md = d; }
      if (md >= minSepPx && md > farD) { farD = md; farCell = q; }
    }
  }
  if (!worstCell) return { device: null, skipped: true, reason: 'no-uncovered-cell' };
  const worstLegal = aps.every((a) => dist(worstCell!, a.pos) >= minSepPx);
  const site = worstLegal ? worstCell : farCell;
  if (!site) return { device: null, skipped: true, reason: 'min-separation' };
  return {
    device: {
      id: uid(), typeId: 'wifi_ap', pos: { ...site }, band: radio.band,
      txPowerDbm: radio.txPowerDbm, antennaGainDbi: radio.antennaGainDbi,
      label: radio.label, autoPlaced: true,
    },
    skipped: false,
  };
}

/**
 * Replace-not-append: swap the previous auto-designed Wi-Fi layer for a fresh one.
 * Hand-placed APs and every non-AP device survive; only wifi_ap devices tagged
 * autoPlaced are dropped. Running auto-design twice therefore converges to the same
 * count instead of doubling it (autoPlaceAPs also ignores autoPlaced APs as anchors).
 */
export function replaceAutoPlacedAps(existingDevices: Device[], placed: Device[]): Device[] {
  return existingDevices.filter((d) => !(d.typeId === 'wifi_ap' && d.autoPlaced)).concat(placed);
}

/** Flood-fill dead-zone regions from a computed RF coverage result. */
/* ── AI-scan discipline ──
   The vision model is good at READING drawings (walls, rooms, doorways) and bad at
   RF engineering. Field truth (20 Aug 2026): on a 2,400 ft² plan the AI proposed
   3 room-named APs + 6 cameras + 18 sensors, several floating in the page margins.
   Rules: the AI NEVER places APs (autoPlaceAPs owns count + position — area-anchored,
   wall-aware); every kept device must sit inside the footprint (2 ft wall grace);
   per-type counts are capped by floor area so a small plan can't get a mall's
   device schedule. Used by BOTH autopilots — one engine, one discipline. */
export const AI_CAMERA_FT2 = 800;   // ~1 interior camera per 800 ft² is already dense
export const AI_SENSOR_FT2 = 700;   // per sensor TYPE (smoke, motion, …)
export function disciplineAiDevices(p: HeatmapProject, scanned: Device[]): {
  kept: Device[]; droppedAps: number; droppedOutside: number; droppedExcess: number;
} {
  const { poly, areaFt2 } = deriveFootprint(p);
  const marginPx = (p.scale?.pxPerFt ?? 0) * 2; // 2 ft grace: wall-mounted gear sits ON the line
  const nearPoly = (pt: Pt) => pointInPolygon(pt, poly) || poly.some((v, i) => {
    const w = poly[(i + 1) % poly.length];
    const vx = w.x - v.x, vy = w.y - v.y, len2 = vx * vx + vy * vy || 1;
    const t = Math.max(0, Math.min(1, ((pt.x - v.x) * vx + (pt.y - v.y) * vy) / len2));
    const dx = pt.x - (v.x + t * vx), dy = pt.y - (v.y + t * vy);
    return dx * dx + dy * dy <= marginPx * marginPx;
  });
  const droppedAps = scanned.filter((d) => d.typeId === 'wifi_ap').length;
  const rest = scanned.filter((d) => d.typeId !== 'wifi_ap');
  const inside = poly.length >= 3 ? rest.filter((d) => nearPoly(d.pos)) : rest;
  const droppedOutside = rest.length - inside.length;
  const capFor = (t: Device['typeId']) => t === 'camera'
    ? Math.max(2, Math.ceil(areaFt2 / AI_CAMERA_FT2))
    : Math.max(1, Math.ceil(areaFt2 / AI_SENSOR_FT2));
  const byType = new Map<Device['typeId'], Device[]>();
  inside.forEach((d) => { const a = byType.get(d.typeId) ?? []; a.push(d); byType.set(d.typeId, a); });
  let droppedExcess = 0;
  const kept: Device[] = [];
  for (const [t, list] of byType) {
    const cap = areaFt2 > 0 ? capFor(t) : list.length;
    if (list.length <= cap) { kept.push(...list); continue; }
    // keep the most SPREAD-OUT subset (greedy max-min / farthest-point) — never a
    // random slice. Incremental nearest-chosen distances make this O(n·cap); the old
    // chosen.includes() + full rescan per pick was O(n³).
    const chosen: Device[] = [list[0]];
    const picked = new Uint8Array(list.length); picked[0] = 1;
    const minD = list.map((d) => dist(d.pos, list[0].pos));
    while (chosen.length < cap) {
      let bi = -1, bd = -1;
      for (let i = 0; i < list.length; i++) if (!picked[i] && minD[i] > bd) { bd = minD[i]; bi = i; }
      if (bi < 0) break;
      picked[bi] = 1; chosen.push(list[bi]);
      for (let i = 0; i < list.length; i++) if (!picked[i]) { const dd = dist(list[i].pos, list[bi].pos); if (dd < minD[i]) minD[i] = dd; }
    }
    droppedExcess += list.length - chosen.length;
    kept.push(...chosen);
  }
  return { kept, droppedAps, droppedOutside, droppedExcess };
}

export function detectGaps(
  res: CoverageResult, p: HeatmapProject,
): { count: number; totalAreaFt2: number; regions: GapRegion[] } {
  const { cols, rows, cells, cellPx } = res;
  const isWeak = (i: number) => cells[i] != null && !cells[i]!.covered;
  const seen = new Uint8Array(cols * rows);
  const regions: GapRegion[] = [];
  const ftPerCell = p.scale ? cellPx / p.scale.pxPerFt : 1;
  const cellAreaFt2 = ftPerCell * ftPerCell;
  const minCells = 6;

  for (let start = 0; start < cols * rows; start++) {
    if (seen[start] || !isWeak(start)) continue;
    const stack = [start]; seen[start] = 1;
    const comp: number[] = [];
    while (stack.length) {
      const q = stack.pop()!; comp.push(q);
      const r = Math.floor(q / cols), c = q % cols;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
        const ni = nr * cols + nc;
        if (!seen[ni] && isWeak(ni)) { seen[ni] = 1; stack.push(ni); }
      }
    }
    if (comp.length < minCells) continue;
    let sx = 0, sy = 0, minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9, worst = 0;
    for (const i of comp) {
      const cx = (i % cols) * cellPx + cellPx / 2, cy = Math.floor(i / cols) * cellPx + cellPx / 2;
      sx += cx; sy += cy;
      minx = Math.min(minx, cx - cellPx / 2); miny = Math.min(miny, cy - cellPx / 2);
      maxx = Math.max(maxx, cx + cellPx / 2); maxy = Math.max(maxy, cy + cellPx / 2);
      const v = cells[i]?.value ?? 0; if (v < worst) worst = v;
    }
    regions.push({ area: comp.length * cellAreaFt2, centroid: { x: sx / comp.length, y: sy / comp.length }, bbox: { x: minx, y: miny, w: maxx - minx, h: maxy - miny }, worst });
  }
  regions.sort((a, b) => b.area - a.area);
  return { count: regions.length, totalAreaFt2: regions.reduce((s, r) => s + r.area, 0), regions };
}

/** Assign non-overlapping channels to APs (greedy saturation, by proximity/overlap). */
export function planChannels(p: HeatmapProject, band: '2.4' | '5' = '2.4'): Record<string, number> {
  const aps = p.devices.filter((d) => d.typeId === 'wifi_ap');
  const palette = band === '2.4' ? CHANNELS_24 : CHANNELS_5;
  // interference edge if APs closer than ~1.4× the mean of the two usable radii —
  // each radius from that AP's ACTUAL radio (txPowerDbm + antennaGainDbi, registry
  // defaults 15+3 when unset), not a hardcoded txGain of 18 for every model.
  const radiiPx = aps.map((d) =>
    p.scale
      ? apUsableRadiusFt(p, band, (d.txPowerDbm ?? RF_TX_DEFAULT_DBM) + (d.antennaGainDbi ?? RF_GAIN_DEFAULT_DBI), p.rssiTargetDbm) * p.scale.pxPerFt
      : 300,
  );
  const adj: Record<string, Set<string>> = {};
  aps.forEach((a) => (adj[a.id] = new Set()));
  for (let i = 0; i < aps.length; i++)
    for (let j = i + 1; j < aps.length; j++)
      if (dist(aps[i].pos, aps[j].pos) < ((radiiPx[i] + radiiPx[j]) / 2) * 1.4) { adj[aps[i].id].add(aps[j].id); adj[aps[j].id].add(aps[i].id); }

  const color: Record<string, number> = {};
  // DSATUR: repeatedly pick uncolored AP with most distinct neighbor-colors
  const uncolored = new Set(aps.map((a) => a.id));
  while (uncolored.size) {
    let pick = '', bestSat = -1, bestDeg = -1;
    for (const id of uncolored) {
      const nbColors = new Set<number>();
      for (const n of adj[id]) if (color[n] != null) nbColors.add(color[n]);
      const deg = adj[id].size;
      if (nbColors.size > bestSat || (nbColors.size === bestSat && deg > bestDeg)) { bestSat = nbColors.size; bestDeg = deg; pick = id; }
    }
    const used = new Set<number>();
    for (const n of adj[pick]) if (color[n] != null) used.add(color[n]);
    let chosen = palette.find((ch) => !used.has(ch));
    if (chosen == null) {
      // more conflicts than colors: reuse the least-used channel among neighbors
      const counts: Record<number, number> = {};
      palette.forEach((ch) => (counts[ch] = 0));
      for (const n of adj[pick]) if (color[n] != null) counts[color[n]]++;
      chosen = palette.reduce((a, b) => (counts[a] <= counts[b] ? a : b));
    }
    color[pick] = chosen;
    uncolored.delete(pick);
  }
  return color;
}

/** Coverage health score (0-100) + key metrics from an RF result. healthScore is THE
 *  engine score (engine.healthScoreFromStats) — one formula, dimensionless inputs,
 *  every surface. The second formula that used to live here mixed units (dead-zone
 *  ft² divided by a CELL COUNT) and could contradict the score the map displayed. */
export function coverageMetrics(res: CoverageResult, p: HeatmapProject) {
  const s = res.stats;
  const gaps = s.activeType === 'wifi_ap' ? detectGaps(res, p) : { count: 0, totalAreaFt2: 0, regions: [] };
  return { ...s, healthScore: healthScoreFromStats(s), deadZones: gaps.count, deadArea: gaps.totalAreaFt2, gaps: gaps.regions.slice(0, 8) };
}

export function recompute(p: HeatmapProject, cellPx = 10, opts: CoverageOpts = {}): CoverageResult {
  const res = computeCoverage(p, cellPx, opts);
  const g = res.stats.deviceCount ? detectGaps(res, p) : { count: 0, totalAreaFt2: 0, regions: [] };
  res.gaps = g.regions;
  res.stats.deadZones = g.count;
  res.stats.deadArea = g.totalAreaFt2;
  if (p.activeType === 'wifi_ap') res.stats.healthScore = coverageMetrics(res, p).healthScore;
  return res;
}
