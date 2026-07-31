/**
 * Heatmap engine — geometry primitives (pure, param-independent).
 * All coordinates are in floor-plan IMAGE PIXELS; convert to feet via Scale.pxPerFt.
 */

export interface Pt { x: number; y: number }
export interface Seg { a: Pt; b: Pt }

export const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Orientation sign of ordered triplet (p, q, r). */
function orient(p: Pt, q: Pt, r: Pt): number {
  return (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
}
function onSeg(p: Pt, q: Pt, r: Pt): boolean {
  return q.x <= Math.max(p.x, r.x) + 1e-9 && q.x >= Math.min(p.x, r.x) - 1e-9 &&
         q.y <= Math.max(p.y, r.y) + 1e-9 && q.y >= Math.min(p.y, r.y) - 1e-9;
}

/** True if segments p1p2 and p3p4 properly intersect (used for wall crossing). */
export function segmentsIntersect(p1: Pt, p2: Pt, p3: Pt, p4: Pt): boolean {
  const d1 = orient(p3, p4, p1);
  const d2 = orient(p3, p4, p2);
  const d3 = orient(p1, p2, p3);
  const d4 = orient(p1, p2, p4);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  if (Math.abs(d1) < 1e-9 && onSeg(p3, p1, p4)) return true;
  if (Math.abs(d2) < 1e-9 && onSeg(p3, p2, p4)) return true;
  if (Math.abs(d3) < 1e-9 && onSeg(p1, p3, p2)) return true;
  if (Math.abs(d4) < 1e-9 && onSeg(p1, p4, p2)) return true;
  return false;
}

/** Count how many of the given wall segments the ray a→b crosses (for attenuation / LOS).
 *  AABB pre-reject: a wall whose bounding box does not overlap the ray's bounding box cannot
 *  intersect it, so we skip the (costlier) exact test. This is EXACT — it only skips walls for
 *  which segmentsIntersect would have returned false — so results are byte-identical, just faster
 *  on wall-heavy plans where most walls are nowhere near a given cell→device ray. */
export function crossings<T extends Seg>(a: Pt, b: Pt, walls: T[]): T[] {
  const hit: T[] = [];
  const rMinX = a.x < b.x ? a.x : b.x, rMaxX = a.x < b.x ? b.x : a.x;
  const rMinY = a.y < b.y ? a.y : b.y, rMaxY = a.y < b.y ? b.y : a.y;
  for (const w of walls) {
    const wMinX = w.a.x < w.b.x ? w.a.x : w.b.x, wMaxX = w.a.x < w.b.x ? w.b.x : w.a.x;
    if (wMaxX < rMinX || wMinX > rMaxX) continue;
    const wMinY = w.a.y < w.b.y ? w.a.y : w.b.y, wMaxY = w.a.y < w.b.y ? w.b.y : w.a.y;
    if (wMaxY < rMinY || wMinY > rMaxY) continue;
    if (segmentsIntersect(a, b, w.a, w.b)) hit.push(w);
  }
  return hit;
}

/** Is point p inside polygon poly (ray-cast even-odd)? Empty/degenerate poly → true (no bound). */
export function pointInPolygon(p: Pt, poly: Pt[]): boolean {
  if (poly.length < 3) return true;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    const intersect = (yi > p.y) !== (yj > p.y) && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Angle (deg, 0=east, CCW positive) from a to b. */
export const angleDeg = (a: Pt, b: Pt): number => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;

/** Smallest absolute difference between two angles in degrees (0..180). */
export function angleDiff(a: number, b: number): number {
  let d = Math.abs(((a - b) % 360 + 360) % 360);
  if (d > 180) d = 360 - d;
  return d;
}
