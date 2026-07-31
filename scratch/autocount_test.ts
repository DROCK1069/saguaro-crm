// Proof of auto-count + region-fill. Run:
//   npx esbuild scratch/autocount_test.ts --bundle --platform=node --format=cjs | node
import { findMatches, fillRegion } from '../lib/takeoff/autocount';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, got?: unknown) => { if (c) { pass++; console.log('  PASS', n); } else { fail++; console.log('  FAIL', n, '→', got); } };

// ── template match: a distinct 8x8 symbol stamped at 3 known spots on a light sheet ──
const W = 64, H = 64;
const img = new Uint8Array(W * H).fill(210); // light background
// symbol = an "L" (distinct, not flat): dark down the left col + across the bottom row of an 8x8 box
function stamp(ox: number, oy: number) {
  for (let j = 0; j < 8; j++) img[(oy + j) * W + ox] = 20;          // left column
  for (let i = 0; i < 8; i++) img[(oy + 7) * W + (ox + i)] = 20;    // bottom row
}
const spots = [[10, 10], [40, 12], [22, 44]];
spots.forEach(([x, y]) => stamp(x, y));
// a little non-symbol clutter that must NOT match
for (let i = 0; i < 6; i++) img[(30 + i) * W + 50] = 60;

const matches = findMatches({ data: img, w: W, h: H }, { x: 10, y: 10, w: 8, h: 8 }, { threshold: 0.85 });
console.log('matches:', matches.map((m) => `(${Math.round(m.x)},${Math.round(m.y)})@${m.score.toFixed(2)}`).join(' '));
ok('found exactly 3 instances (click-one-find-all)', matches.length === 3, matches.length);
const nearAny = (mx: number, my: number) => spots.some(([x, y]) => Math.abs(mx - (x + 4)) <= 2 && Math.abs(my - (y + 4)) <= 2);
ok('every match sits on a stamped symbol center', matches.every((m) => nearAny(m.x, m.y)));
ok('clutter did not produce a false match', matches.length === 3);

// ── region fill: a boxed room, seed inside → area + boundary polygon ──
const w2 = 40, h2 = 40;
const bin = new Uint8Array(w2 * h2); // 0 = open, 1 = wall
for (let x = 8; x <= 28; x++) { bin[8 * w2 + x] = 1; bin[28 * w2 + x] = 1; }   // top/bottom walls
for (let y = 8; y <= 28; y++) { bin[y * w2 + 8] = 1; bin[y * w2 + 28] = 1; }   // left/right walls
const region = fillRegion({ data: bin, w: w2, h: h2 }, { x: 18, y: 18 });
const xs = region.polygon.map((p) => p.x), ys = region.polygon.map((p) => p.y);
const bbox = { minx: Math.min(...xs), maxx: Math.max(...xs), miny: Math.min(...ys), maxy: Math.max(...ys) };
console.log('region area:', region.area, 'polygon verts:', region.polygon.length, 'bbox:', JSON.stringify(bbox));
ok('interior area ≈ 19×19 = 361 open cells', Math.abs(region.area - 361) <= 8, region.area);
ok('boundary hugs the room (bbox 9..27)', bbox.minx >= 8 && bbox.miny >= 8 && bbox.maxx <= 28 && bbox.maxy <= 28);
ok('boundary simplified to a few corners (not per-pixel)', region.polygon.length >= 4 && region.polygon.length <= 14, region.polygon.length);
ok('seed on a wall returns empty', fillRegion({ data: bin, w: w2, h: h2 }, { x: 8, y: 8 }).area === 0);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
