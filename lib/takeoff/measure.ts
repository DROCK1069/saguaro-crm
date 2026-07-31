/**
 * Enhanced takeoff MEASUREMENT algorithm — everything the tracer needs to beat
 * PlanSwift / STACK / Bluebeam. Pure, deterministic, world-units (feet) after pxPerFt.
 * (Staged in scratch; moves to lib/takeoff/measure.ts once the cost-engine build settles.)
 *
 * Covers: scale + calibration sanity, linear w/ per-segment + auto-close, polygon area
 * NET OF VOIDS, opening deductions, perimeter→wall-LF, PITCH/SLOPE area (+hip/valley),
 * true VOLUME (prism + average-end-area cut/fill), ARCS (3-point circumcircle fit),
 * ortho/grid/endpoint SNAPPING, and unit conversions (SY / squares / CF / IN).
 */

import type { Pt } from './types';

const r2 = (n: number) => Math.round(n * 100) / 100;
const r4 = (n: number) => Math.round(n * 10000) / 10000;
const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);

/* ── SCALE / CALIBRATION ─────────────────────────────────────────────────── */

/** Two calibration points a known distance apart → pixels per foot. */
export function pxPerFt(a: Pt, b: Pt, knownFt: number): number {
  const px = dist(a, b);
  return knownFt > 0 ? px / knownFt : 0;
}

/** After calibrating, is the implied sheet size plausible? Guards a fat-fingered scale. */
export function calibrationSanity(ppf: number, imgWpx: number, imgHpx: number) {
  const widthFt = ppf > 0 ? imgWpx / ppf : 0;
  const heightFt = ppf > 0 ? imgHpx / ppf : 0;
  const big = Math.max(widthFt, heightFt);
  // A real drawing sheet covers roughly 8–500 ft across at plan scale.
  const ok = ppf > 0 && big >= 8 && big <= 500;
  return {
    impliedWidthFt: r2(widthFt),
    impliedHeightFt: r2(heightFt),
    ok,
    warning: ok ? null : `Implied sheet is ${r2(big)} ft across — scale looks off; re-calibrate.`,
  };
}

/* ── LINEAR ──────────────────────────────────────────────────────────────── */

/** Per-leg lengths (ft) of a polyline. */
export function segmentLengthsLF(pts: Pt[], ppf: number): number[] {
  if (ppf <= 0 || pts.length < 2) return [];
  const out: number[] = [];
  for (let i = 1; i < pts.length; i++) out.push(r2(dist(pts[i - 1], pts[i]) / ppf));
  return out;
}

/** Total polyline length in feet. */
export function lengthLF(pts: Pt[], ppf: number): number {
  if (ppf <= 0 || pts.length < 2) return 0;
  let px = 0;
  for (let i = 1; i < pts.length; i++) px += dist(pts[i - 1], pts[i]);
  return r2(px / ppf);
}

/** Perimeter of a closed ring in feet (auto-closes). */
export function perimeterLF(ring: Pt[], ppf: number): number {
  if (ring.length < 2) return 0;
  return lengthLF([...ring, ring[0]], ppf);
}

/** Would the last point close the ring (within tolerance of the first)? */
export function isClosed(pts: Pt[], tolPx = 12): boolean {
  return pts.length >= 3 && dist(pts[0], pts[pts.length - 1]) <= tolPx;
}

/* ── AREA (net of voids) ─────────────────────────────────────────────────── */

/** Signed shoelace area in px² (auto-closes the ring). */
function shoelacePx2(ring: Pt[]): number {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length];
    s += p.x * q.y - q.x * p.y;
  }
  return s / 2;
}

/** Gross polygon area in SF. */
export function grossSF(ring: Pt[], ppf: number): number {
  if (ppf <= 0 || ring.length < 3) return 0;
  return r2(Math.abs(shoelacePx2(ring)) / (ppf * ppf));
}

/** Ray-cast point-in-polygon (px space) — used to validate holes sit inside the outer. */
export function pointInPolygon(pt: Pt, ring: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].x, yi = ring[i].y, xj = ring[j].x, yj = ring[j].y;
    const hit = (yi > pt.y) !== (yj > pt.y) && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

/** Net area = outer − Σ holes. Flags any hole not fully inside the outer. */
export function netAreaSF(outer: Pt[], holes: Pt[][], ppf: number) {
  const gross = grossSF(outer, ppf);
  let holesSF = 0;
  const contained: boolean[] = [];
  for (const h of holes) {
    // Only deduct a void that is FULLY inside the outline (every vertex). A void that spills past the
    // slab edge would otherwise remove area never in gross → under-bid. Non-contained voids are
    // excluded from the deduction and flagged (allHolesContained=false) for the estimator to review.
    const inside = h.length >= 3 && h.every((p) => pointInPolygon(p, outer));
    contained.push(inside);
    if (inside) holesSF += grossSF(h, ppf);
  }
  // Never deduct more than gross (guards degenerate/overlapping voids from driving net negative).
  const net = Math.max(0, r2(gross - Math.min(holesSF, gross)));
  return { grossSF: gross, holesSF: r2(holesSF), netSF: net, allHolesContained: contained.every(Boolean), contained };
}

/** Net wall area = gross wall area − openings (door/window). Never negative. */
export function netWallSF(grossWallSF: number, openings: { w: number; h: number }[]): number {
  const cut = openings.reduce((s, o) => s + Math.max(0, o.w) * Math.max(0, o.h), 0);
  return Math.max(0, r2(grossWallSF - cut));
}

/* ── PITCH / SLOPE (beat PlanSwift) ──────────────────────────────────────── */

/** Roof slope factor from an x:12 pitch. 6:12 → √(1+0.25)=1.1180. */
export function slopeFactorPitch(riseOver12: number): number {
  return r4(Math.sqrt(1 + (riseOver12 / 12) ** 2));
}
/** Slope factor from a slope angle in degrees. */
export function slopeFactorDeg(deg: number): number {
  const c = Math.cos((deg * Math.PI) / 180);
  return c > 0 ? r4(1 / c) : 0;
}
/** Plan (footprint) area × slope factor = true sloped surface area.
 *  Uses the FULL-precision factor (not the display-rounded slopeFactorPitch) so large
 *  roofs don't accumulate rounding error — only the final area is rounded. */
export function slopeArea(planSF: number, riseOver12: number): number {
  return r2(planSF * Math.sqrt(1 + (riseOver12 / 12) ** 2));
}
/** Roofing squares = SF / 100. */
export const roofingSquares = (sf: number) => r2(sf / 100);
/** Hip/valley diagonal run length for a given plan run at pitch x:12. */
export function hipValleyLF(runLF: number, riseOver12: number): number {
  return r2(runLF * Math.sqrt(2 + (riseOver12 / 12) ** 2));
}

/* ── VOLUME (real, not faked) ────────────────────────────────────────────── */

/** Prism volume in CY: area(SF) × depth(ft) / 27. */
export function prismCY(areaSF: number, depthFt: number): number {
  return r2((areaSF * depthFt) / 27);
}
/** Cross-section volume (footing/trench): section(SF) × run(LF) / 27. */
export function crossSectionCY(crossSectionSF: number, runLF: number): number {
  return r2((crossSectionSF * runLF) / 27);
}
/** Average-end-area cut/fill: V = Σ ((A₁+A₂)/2 × ΔL) / 27 across stations. */
export function averageEndAreaCY(stations: { areaSF: number; stationFt: number }[]): number {
  if (stations.length < 2) return 0;
  const s = [...stations].sort((a, b) => a.stationFt - b.stationFt);
  let cf = 0;
  for (let i = 1; i < s.length; i++) {
    const L = s[i].stationFt - s[i - 1].stationFt;
    cf += ((s[i - 1].areaSF + s[i].areaSF) / 2) * L;
  }
  return r2(cf / 27);
}

/* ── ARC / CURVE (3-point circumcircle fit) ──────────────────────────────── */

/** Fit a circle through start→mid→end and measure the true arc (not the chord). */
export function fit3PointArc(a: Pt, mid: Pt, b: Pt, ppf: number) {
  const d = 2 * (a.x * (mid.y - b.y) + mid.x * (b.y - a.y) + b.x * (a.y - mid.y));
  if (Math.abs(d) < 1e-9 || ppf <= 0) {
    // collinear → straight chord fallback
    const chord = dist(a, b) / ppf;
    return { ok: false, radiusFt: 0, thetaRad: 0, arcLenFt: r2(chord), segmentAreaSF: 0 };
  }
  const a2 = a.x * a.x + a.y * a.y, m2 = mid.x * mid.x + mid.y * mid.y, b2 = b.x * b.x + b.y * b.y;
  const ux = (a2 * (mid.y - b.y) + m2 * (b.y - a.y) + b2 * (a.y - mid.y)) / d;
  const uy = (a2 * (b.x - mid.x) + m2 * (a.x - b.x) + b2 * (mid.x - a.x)) / d;
  const center = { x: ux, y: uy };
  const Rpx = dist(center, a);
  // arc A→mid→b = angle(A,mid) + angle(mid,b) (robust regardless of orientation)
  const ang = (p: Pt, q: Pt) => {
    const v1x = p.x - ux, v1y = p.y - uy, v2x = q.x - ux, v2y = q.y - uy;
    const cosv = (v1x * v2x + v1y * v2y) / (Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y));
    return Math.acos(Math.max(-1, Math.min(1, cosv)));
  };
  const theta = ang(a, mid) + ang(mid, b);
  const Rft = Rpx / ppf;
  return {
    ok: true,
    radiusFt: r2(Rft),
    thetaRad: r4(theta),
    arcLenFt: r2(Rft * theta),
    segmentAreaSF: r2(0.5 * Rft * Rft * (theta - Math.sin(theta))),
  };
}
/** Radius from a chord + its mid-offset (sagitta): R = c²/(8h) + h/2. */
export function chordSagittaToRadiusFt(chordFt: number, sagittaFt: number): number {
  if (sagittaFt <= 0) return 0;
  return r2((chordFt * chordFt) / (8 * sagittaFt) + sagittaFt / 2);
}

/* ── SNAPPING (pure helpers the UI calls) ────────────────────────────────── */

/** Snap to the nearest existing vertex within tolerance (else return p). */
export function snapEndpoint(p: Pt, verts: Pt[], tolPx = 10): Pt {
  let best: Pt | null = null, bd = tolPx;
  for (const v of verts) { const d = dist(p, v); if (d <= bd) { bd = d; best = v; } }
  return best ? { ...best } : p;
}
/** Constrain the segment prev→p to 0°/90° (or 45° when allow45). */
export function snapOrtho(prev: Pt, p: Pt, allow45 = false): Pt {
  const dx = p.x - prev.x, dy = p.y - prev.y;
  if (allow45 && Math.abs(Math.abs(dx) - Math.abs(dy)) < Math.min(Math.abs(dx), Math.abs(dy)) * 0.4) {
    const s = (Math.abs(dx) + Math.abs(dy)) / 2;
    return { x: prev.x + Math.sign(dx) * s, y: prev.y + Math.sign(dy) * s };
  }
  return Math.abs(dx) >= Math.abs(dy) ? { x: p.x, y: prev.y } : { x: prev.x, y: p.y };
}
/** Snap a point to a foot-grid. */
export function snapGrid(p: Pt, gridFt: number, ppf: number): Pt {
  if (gridFt <= 0 || ppf <= 0) return p;
  const g = gridFt * ppf;
  return { x: Math.round(p.x / g) * g, y: Math.round(p.y / g) * g };
}

/* ── UNIT CONVERSIONS (same underlying feet math) ────────────────────────── */
export const toSY = (sf: number) => r2(sf / 9);          // square yards
export const toSquares = (sf: number) => r2(sf / 100);   // roofing squares
export const toCF = (areaSF: number, depthFt: number) => r2(areaSF * depthFt); // cubic feet
export const inToFt = (inches: number) => inches / 12;
export const ftToIn = (ft: number) => ft * 12;

/* ── DISPATCHER — one measured value + rich metadata per condition kind ──── */

export type MeasureToolKind = 'linear' | 'area' | 'count' | 'pitch' | 'volume' | 'arc' | 'deduction';

export interface MeasureInput {
  points?: Pt[];
  holes?: Pt[][];
  count?: number;
  ppf: number;
  riseOver12?: number;                // pitch
  depthFt?: number;                   // volume prism
  stations?: { areaSF: number; stationFt: number }[]; // cut/fill
  arc?: { a: Pt; mid: Pt; b: Pt };    // arc
}

export interface MeasureResult {
  kind: MeasureToolKind;
  value: number;      // the base value fed to explodeCondition (SF / LF / EA / CY)
  unit: string;
  meta: Record<string, unknown>;
}

export function measureCondition(kind: MeasureToolKind, input: MeasureInput): MeasureResult {
  const { ppf = 0, points = [], holes = [] } = input;
  switch (kind) {
    case 'count':
      return { kind, value: input.count ?? 0, unit: 'EA', meta: {} };
    case 'linear': {
      const segs = segmentLengthsLF(points, ppf);
      return { kind, value: lengthLF(points, ppf), unit: 'LF', meta: { segments: segs, closed: isClosed(points) } };
    }
    case 'area': {
      const net = netAreaSF(points, holes, ppf);
      return { kind, value: net.netSF, unit: 'SF', meta: { ...net, perimeterLF: perimeterLF(points, ppf), SY: toSY(net.netSF) } };
    }
    case 'deduction': {
      const net = netAreaSF(points, holes, ppf);
      return { kind, value: net.netSF, unit: 'SF', meta: net };
    }
    case 'pitch': {
      const plan = netAreaSF(points, holes, ppf).netSF; // net of voids (skylights/atria) — consistent with area
      const x = input.riseOver12 ?? 4;
      const sloped = slopeArea(plan, x);
      return { kind, value: sloped, unit: 'SF', meta: { planSF: plan, slopeFactor: slopeFactorPitch(x), squares: roofingSquares(sloped), riseOver12: x } };
    }
    case 'volume': {
      if (input.stations && input.stations.length >= 2) {
        const cy = averageEndAreaCY(input.stations);
        return { kind, value: cy, unit: 'CY', meta: { method: 'average-end-area', stations: input.stations.length } };
      }
      const plan = netAreaSF(points, holes, ppf).netSF; // net of voids (shafts/openings) — consistent with area
      const cy = prismCY(plan, input.depthFt ?? 0);
      return { kind, value: cy, unit: 'CY', meta: { method: 'prism', areaSF: plan, depthFt: input.depthFt ?? 0, CF: toCF(plan, input.depthFt ?? 0) } };
    }
    case 'arc': {
      const a = input.arc;
      const fit = a ? fit3PointArc(a.a, a.mid, a.b, ppf) : { ok: false, radiusFt: 0, thetaRad: 0, arcLenFt: 0, segmentAreaSF: 0 };
      return { kind, value: fit.arcLenFt, unit: 'LF', meta: fit };
    }
    default:
      return { kind, value: 0, unit: '', meta: {} };
  }
}
