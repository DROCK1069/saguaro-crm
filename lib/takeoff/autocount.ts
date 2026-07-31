/**
 * Deterministic auto-count + auto-region-fill — the two "AI-magic" features the
 * competitors charge for, done with classical CV (zero AI cost, fully deterministic):
 *   - findMatches: normalized cross-correlation template match. Click ONE symbol
 *     (door/fixture/receptacle) → find every instance. Bluebeam VisualSearch / STACK
 *     Autocount / Countfire parity.
 *   - fillRegion: flood-fill from a seed inside an enclosed room, then Moore-trace +
 *     simplify the boundary to a polygon. Bluebeam Dynamic Fill parity.
 * Inputs are grayscale/binary typed arrays the tracer builds from canvas getImageData.
 */

export interface Gray { data: Uint8Array | number[]; w: number; h: number }
export interface TemplateRect { x: number; y: number; w: number; h: number }
export interface Match { x: number; y: number; score: number } // center in image px

/**
 * Normalized cross-correlation template match with non-maximum suppression.
 * NCC is illumination-invariant (mean/std normalized), so faint vs bold prints of the
 * same symbol still match. O(W·H·tw·th) — for big sheets, downscale or limit the search
 * region first (the UI passes a working-resolution image).
 */
export function findMatches(img: Gray, tpl: TemplateRect, opts: { threshold?: number; maxMatches?: number; step?: number } = {}): Match[] {
  const threshold = opts.threshold ?? 0.8;
  const step = Math.max(1, opts.step ?? 1);
  const { data, w, h } = img;
  const { x: tx, y: ty, w: tw, h: th } = tpl;
  if (tw < 2 || th < 2 || tx < 0 || ty < 0 || tx + tw > w || ty + th > h) return [];

  const tvals = new Float64Array(tw * th);
  let tsum = 0;
  for (let j = 0; j < th; j++) for (let i = 0; i < tw; i++) { const v = data[(ty + j) * w + (tx + i)]; tvals[j * tw + i] = v; tsum += v; }
  const tmean = tsum / (tw * th);
  let tden = 0;
  for (let k = 0; k < tvals.length; k++) { tvals[k] -= tmean; tden += tvals[k] * tvals[k]; }
  tden = Math.sqrt(tden);
  if (tden === 0) return []; // flat template — nothing to correlate

  const raw: Match[] = [];
  for (let y = 0; y + th <= h; y += step) {
    for (let x = 0; x + tw <= w; x += step) {
      let wsum = 0;
      for (let j = 0; j < th; j++) for (let i = 0; i < tw; i++) wsum += data[(y + j) * w + (x + i)];
      const wmean = wsum / (tw * th);
      let num = 0, wden = 0;
      for (let j = 0; j < th; j++) for (let i = 0; i < tw; i++) {
        const wv = data[(y + j) * w + (x + i)] - wmean;
        num += wv * tvals[j * tw + i];
        wden += wv * wv;
      }
      wden = Math.sqrt(wden);
      if (wden === 0) continue;
      const ncc = num / (tden * wden);
      if (ncc >= threshold) raw.push({ x: x + tw / 2, y: y + th / 2, score: ncc });
    }
  }
  // NMS: keep the strongest, suppress neighbours within ~symbol size
  raw.sort((a, b) => b.score - a.score);
  const minSep = Math.min(tw, th) * 0.6;
  const out: Match[] = [];
  for (const m of raw) {
    if (out.every((o) => Math.hypot(o.x - m.x, o.y - m.y) > minSep)) out.push(m);
    if (opts.maxMatches && out.length >= opts.maxMatches) break;
  }
  return out;
}

export interface Binary { data: Uint8Array | boolean[] | number[]; w: number; h: number } // truthy = wall/blocked
export interface Region { area: number; polygon: { x: number; y: number }[] }

/** Flood-fill an enclosed room from a seed, then trace + simplify its boundary polygon. */
export function fillRegion(bin: Binary, seed: { x: number; y: number }, opts: { maxCells?: number; simplifyTol?: number } = {}): Region {
  const { data, w, h } = bin;
  const wall = (i: number) => !!data[i];
  const sx = Math.round(seed.x), sy = Math.round(seed.y);
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return { area: 0, polygon: [] };
  const start = sy * w + sx;
  if (wall(start)) return { area: 0, polygon: [] };

  const filled = new Uint8Array(w * h);
  const stack = [start];
  filled[start] = 1;
  let count = 0;
  const maxCells = opts.maxCells ?? w * h;
  while (stack.length) {
    const p = stack.pop() as number;
    count++;
    if (count > maxCells) break;
    const x = p % w, y = (p - x) / w;
    if (x + 1 < w) { const n = p + 1; if (!filled[n] && !wall(n)) { filled[n] = 1; stack.push(n); } }
    if (x - 1 >= 0) { const n = p - 1; if (!filled[n] && !wall(n)) { filled[n] = 1; stack.push(n); } }
    if (y + 1 < h) { const n = p + w; if (!filled[n] && !wall(n)) { filled[n] = 1; stack.push(n); } }
    if (y - 1 >= 0) { const n = p - w; if (!filled[n] && !wall(n)) { filled[n] = 1; stack.push(n); } }
  }
  const poly = traceBoundary(filled, w, h);
  return { area: count, polygon: simplify(poly, opts.simplifyTol ?? 1.5) };
}

/** Moore-neighbour boundary trace of a filled mask → ordered pixel outline (clockwise).
 *  Standard radial-sweep: from each boundary pixel, sweep CW starting just past the cell
 *  we entered from, take the first filled neighbour, and set the new backtrack opposite. */
function traceBoundary(mask: Uint8Array, w: number, h: number): { x: number; y: number }[] {
  let start = -1;
  for (let i = 0; i < w * h && start < 0; i++) if (mask[i]) start = i;
  if (start < 0) return [];
  const sx = start % w, sy = (start - (start % w)) / w;
  // 8 neighbour offsets in clockwise order starting from North
  const OFF = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
  const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && !!mask[y * w + x];
  const out: { x: number; y: number }[] = [{ x: sx, y: sy }];
  let cx = sx, cy = sy;
  let backIdx = 6; // top-left-most start ⇒ we came from the West (empty)
  const maxSteps = 8 * (w * h);
  for (let s = 0; s < maxSteps; s++) {
    let foundIdx = -1;
    for (let k = 1; k <= 8; k++) {
      const idx = (backIdx + k) % 8;
      if (inb(cx + OFF[idx][0], cy + OFF[idx][1])) { foundIdx = idx; break; }
    }
    if (foundIdx < 0) break; // isolated pixel
    cx += OFF[foundIdx][0]; cy += OFF[foundIdx][1];
    backIdx = (foundIdx + 4) % 8; // direction from the new cell back to the previous one
    if (cx === sx && cy === sy) break; // returned to start → closed
    out.push({ x: cx, y: cy });
  }
  return out;
}

/** Douglas–Peucker polyline simplification (keeps corners, drops staircase pixels). */
function simplify(pts: { x: number; y: number }[], tol: number): { x: number; y: number }[] {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = 1; keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop() as [number, number];
    let maxD = -1, idx = -1;
    const A = pts[a], B = pts[b];
    const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i].x - A.x) * dy - (pts[i].y - A.y) * dx) / len;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tol && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
