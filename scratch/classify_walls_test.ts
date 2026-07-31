// Proof for CAD wall classification (audit #6). Run:
//   npx esbuild scratch/classify_walls_test.ts --bundle --platform=node --format=cjs | node
import { classifyWalls } from '../lib/heatmap/vector-pdf';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) { pass++; console.log('  PASS', n); } else { fail++; console.log('  FAIL', n); } };

const pxPerFt = 8; // minWall=12pt, faceMin≈1.33pt, faceMax≈10.67pt
// Two parallel faces of ONE wall (gap 5pt), a short dimension tick, and a lone perpendicular wall.
const segs = [
  { x1: 0, y1: 0, x2: 80, y2: 0, len: 80 },     // wall face A
  { x1: 0, y1: 5, x2: 80, y2: 5, len: 80 },     // wall face B (5pt away → same wall)
  { x1: 10, y1: 20, x2: 10, y2: 25, len: 5 },   // dimension tick (too short)
  { x1: 200, y1: 0, x2: 200, y2: 100, len: 100 }, // lone perpendicular wall
];

const walls = classifyWalls(segs, pxPerFt, 300, 300);
console.log('input segments:', segs.length, '→ walls:', walls.length, JSON.stringify(walls));

ok('parallel faces collapsed + tick dropped → exactly 2 walls', walls.length === 2);
const horiz = walls.find((w) => Math.abs(w.y1 - w.y2) < 1);
const vert = walls.find((w) => Math.abs(w.x1 - w.x2) < 1);
ok('the two faces became ONE centerline at the midline (y≈2.5)', !!horiz && Math.abs((horiz.y1 + horiz.y2) / 2 - 2.5) < 0.6);
ok('centerline spans the wall (len≈80)', !!horiz && Math.abs(horiz.len - 80) < 2);
ok('the lone perpendicular wall is kept (x≈200, len≈100)', !!vert && Math.abs(vert.x1 - 200) < 1 && Math.abs(vert.len - 100) < 2);
ok('no sub-wall-length clutter survives', walls.every((w) => w.len >= pxPerFt * 1.5 * 0.6));

// No-scale fallback: page-relative floor still classifies.
const w2 = classifyWalls(segs, null, 300, 300);
ok('no-scale path returns walls without throwing', Array.isArray(w2));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
