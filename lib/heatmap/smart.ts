/**
 * Heatmap engine — smart layer: auto-placement (greedy set-cover), gap detection
 * (flood-fill CCL), WiFi channel planning (DSATUR-style), and coverage metrics.
 */
import type { Pt } from './geometry';
import { dist, pointInPolygon } from './geometry';
import type { Band, CoverageResult, Device, Env, GapRegion, HeatmapProject } from './types';
import { apRssiAt, apUsableRadiusFt, computeCoverage, type CoverageOpts } from './engine';
import { CHANNELS_24, CHANNELS_5 } from './models';
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
  const cx = cands.reduce((s, p) => s + p.x, 0) / cands.length;
  const cy = cands.reduce((s, p) => s + p.y, 0) / cands.length;
  const chosen: Pt[] = [nearest({ x: cx, y: cy }, cands)];
  while (chosen.length < m) {
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
 * Wall handling: placement/verify call the same engine.apRssiAt the live heatmap uses,
 * so its shared wall model applies — heavy/structural walls carry full attenuation while
 * light partitions are env-discounted (already in the path-loss exponent). What the
 * optimizer trusts is therefore exactly what the map paints.
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
  scaleSuspect?: boolean; apModel?: string;
} {
  const empty = { aps: [] as Device[], achievedPct: 0, metTarget: false };
  if (!p.scale || !(p.scale.pxPerFt > 0)) return empty;
  const targetPct = opts.targetPct ?? 0.95;
  const target = p.rssiTargetDbm;

  // Resolve the band/TX/gain to model with. An explicit tx+gain (any vendor) wins;
  // otherwise fall back to the real UniFi catalog model (unchanged default behavior).
  const useExplicit = opts.txPowerDbm != null && opts.antennaGainDbi != null;
  const model = useExplicit ? null : resolveApModel(opts.apModel);
  const band = useExplicit ? (opts.band ?? '5') : resolveBand(model!, opts.band ?? '5');
  const modelTxDbm = useExplicit ? opts.txPowerDbm! : (model!.txDbm[band] ?? model!.txDbm['5'] ?? 15);
  const modelGainDbi = useExplicit ? opts.antennaGainDbi! : model!.gainDbi;
  const modelLabel = useExplicit ? (opts.label ?? 'AP') : model!.model;
  const txGain = modelTxDbm + modelGainDbi;

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

  // Placement/verify use the SAME wall model as the live heatmap (engine.wallLossDb
  // env-discounts light partitions), so what auto-place trusts == what the map paints.
  const bestRssi = (cell: Pt, aps: Pt[]): number => {
    let b = -Infinity;
    for (const a of aps) { const r = apRssiAt(cell, a, p, band, txGain); if (r > b) b = r; }
    return b;
  };
  const coveredFrac = (aps: Pt[]): { frac: number; worst: Pt | null } => {
    if (!aps.length) return { frac: 0, worst: cells[0] ?? null };
    let cov = 0, worstV = Infinity; let worst: Pt | null = null;
    for (const cell of cells) {
      const r = bestRssi(cell, aps);
      if (r >= target) cov++; else if (r < worstV) { worstV = r; worst = cell; }
    }
    return { frac: cov / cells.length, worst };
  };

  // ── 4. Place: keep existing APs, add the area-anchored remainder, spread evenly ──
  const existing = p.devices.filter((d) => d.typeId === 'wifi_ap').map((d) => ({ ...d.pos }));
  const targetCount = Math.min(areaCount, maxDevices); // never exceed the density / scale-suspect cap
  const toAdd = Math.max(existing.length ? 0 : 1, targetCount - existing.length);
  let added = farthestSeed(cells, toAdd, existing);
  if (added.length > 1) added = lloyd(added, cells, 2);

  // ── 5. Bounded gap-fill: only close GENUINE holes, never exceed the density cap ──
  let all = existing.concat(added);
  let { frac, worst } = coveredFrac(all);
  let guard = 0;
  while (frac < targetPct && all.length < maxDevices && worst && guard++ < 30) {
    added.push(worst);
    all = existing.concat(added);
    ({ frac, worst } = coveredFrac(all));
  }

  const placed: Device[] = added.map((pos) => ({
    id: uid(), typeId: 'wifi_ap', pos: { ...pos }, band,
    txPowerDbm: modelTxDbm, antennaGainDbi: modelGainDbi, label: modelLabel,
  }));
  return {
    aps: placed, achievedPct: frac, metTarget: frac >= targetPct,
    // design basis (surfaced by the UI so the count is transparent + auditable)
    areaFt2, footprintFt, perApFt2: perAp, scaleSuspect, apModel: modelLabel,
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
    // keep the most SPREAD-OUT subset (greedy max-min) — never a random slice
    const chosen: Device[] = [list[0]];
    while (chosen.length < cap) {
      let best: Device | null = null, bestD = -1;
      for (const d of list) {
        if (chosen.includes(d)) continue;
        const dm = Math.min(...chosen.map((c) => dist(c.pos, d.pos)));
        if (dm > bestD) { bestD = dm; best = d; }
      }
      if (!best) break;
      chosen.push(best);
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
  // interference edge if APs closer than ~1.4× usable radius (footprints overlap)
  const rPx = (p.scale ? apUsableRadiusFt(p, band, 18, p.rssiTargetDbm) * p.scale.pxPerFt : 300) * 1.4;
  const adj: Record<string, Set<string>> = {};
  aps.forEach((a) => (adj[a.id] = new Set()));
  for (let i = 0; i < aps.length; i++)
    for (let j = i + 1; j < aps.length; j++)
      if (dist(aps[i].pos, aps[j].pos) < rPx) { adj[aps[i].id].add(aps[j].id); adj[aps[j].id].add(aps[i].id); }

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

/** Coverage health score (0-100) + key metrics from an RF result. */
export function coverageMetrics(res: CoverageResult, p: HeatmapProject) {
  const s = res.stats;
  const gaps = s.activeType === 'wifi_ap' ? detectGaps(res, p) : { count: 0, totalAreaFt2: 0, regions: [] };
  const deadPenalty = s.insideCells ? Math.min(1, gaps.totalAreaFt2 / Math.max(1, s.insideCells) / 0.1) : 0;
  const cov = s.pctCovered / 100;
  const qual = Math.max(0, Math.min(1, (s.avgValue - -85) / (-55 - -85)));
  const health = Math.round(100 * (0.6 * cov + 0.25 * qual + 0.15 * (1 - deadPenalty)));
  return { ...s, healthScore: Math.max(0, Math.min(100, health)), deadZones: gaps.count, deadArea: gaps.totalAreaFt2, gaps: gaps.regions.slice(0, 8) };
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
