/** Takeoff geometry — plan pixels → real-world quantities. Deterministic. */
import type { Pt } from './types';

/** Scale from a calibration: user taps two points a known distance apart. */
export function pxPerFt(a: Pt, b: Pt, knownFt: number): number {
  const px = Math.hypot(b.x - a.x, b.y - a.y);
  return knownFt > 0 ? px / knownFt : 0;
}

/** Chained polyline length in feet. */
export function lengthLF(points: Pt[], ppf: number): number {
  if (ppf <= 0 || points.length < 2) return 0;
  let px = 0;
  for (let i = 1; i < points.length; i++) px += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return px / ppf;
}

/** Polygon area in square feet (shoelace). Auto-closes the ring. */
export function areaSF(points: Pt[], ppf: number): number {
  if (ppf <= 0 || points.length < 3) return 0;
  let px2 = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[(i + 1) % points.length];
    px2 += p.x * q.y - q.x * p.y;
  }
  return Math.abs(px2 / 2) / (ppf * ppf);
}

/** Perimeter of a polygon ring in feet. */
export function perimeterLF(points: Pt[], ppf: number): number {
  if (points.length < 2) return 0;
  return lengthLF([...points, points[0]], ppf);
}

/** Measured base value for a condition kind, from traced geometry. */
export function measure(kind: 'area' | 'linear' | 'count', points: Pt[], ppf: number, count = 0): number {
  if (kind === 'count') return count;
  if (kind === 'linear') return round2(lengthLF(points, ppf));
  return round2(areaSF(points, ppf));
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

// --- Unit rigor: the canonical conversions the engine leans on ---
export const SF_PER_SY = 9;
export const CF_PER_CY = 27;
export const sfToSy = (sf: number) => sf / SF_PER_SY;
/** volume CY from area + thickness-in-inches — the one true concrete/aggregate conversion */
export const volumeCY = (areaSf: number, thickIn: number) => (areaSf * (thickIn / 12)) / CF_PER_CY;
