// Proof of the DXF importer. Run:
//   npx esbuild scratch/dxf_test.ts --bundle --platform=node --format=cjs | node
import { parseDxf, dxfLinearFeet, dxfClosedAreaSF, insUnitsToFeet } from '../lib/takeoff/dxf';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, got?: unknown) => { if (c) { pass++; console.log('  PASS', n); } else { fail++; console.log('  FAIL', n, '→', got); } };

// A minimal but valid DXF: units=feet, a 30ft LINE, a closed 40x60 LWPOLYLINE rectangle,
// a CIRCLE (r5), and a quarter ARC (r10, 0→90°).
const dxf = [
  '0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', '2', '0', 'ENDSEC',
  '0', 'SECTION', '2', 'ENTITIES',
  '0', 'LINE', '10', '0', '20', '0', '11', '30', '21', '0',
  '0', 'LWPOLYLINE', '90', '4', '70', '1',
  '10', '0', '20', '0', '10', '40', '20', '0', '10', '40', '20', '60', '10', '0', '20', '60',
  '0', 'CIRCLE', '10', '100', '20', '100', '40', '5',
  '0', 'ARC', '10', '0', '20', '0', '40', '10', '50', '0', '51', '90',
  '0', 'ENDSEC', '0', 'EOF',
].join('\n');

const r = parseDxf(dxf);
console.log('parsed:', JSON.stringify({ ok: r.ok, insUnits: r.insUnits, lines: r.lines.length, polylines: r.polylines.length, circles: r.circles.length, arcs: r.arcs.length }));

ok('ok', r.ok === true);
ok('$INSUNITS = 2 (feet)', r.insUnits === 2 && insUnitsToFeet(2) === 1);
ok('1 LINE (0,0)-(30,0)', r.lines.length === 1 && r.lines[0].x2 === 30 && r.lines[0].y2 === 0);
ok('1 closed LWPOLYLINE, 4 verts', r.polylines.length === 1 && r.polylines[0].closed === true && r.polylines[0].pts.length === 4);
ok('1 CIRCLE r=5 @ (100,100)', r.circles.length === 1 && r.circles[0].r === 5 && r.circles[0].cx === 100);
ok('1 ARC r=10, 0→90°', r.arcs.length === 1 && r.arcs[0].r === 10 && r.arcs[0].startDeg === 0 && r.arcs[0].endDeg === 90);
ok('linear feet = 30 (line) + 200 (rect perimeter) = 230', dxfLinearFeet(r) === 230, dxfLinearFeet(r));
ok('closed area = 40×60 = 2400 SF', dxfClosedAreaSF(r) === 2400, dxfClosedAreaSF(r));

// mm units should convert (a 1000mm line ≈ 3.28 ft)
const mm = ['0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', '4', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES', '0', 'LINE', '10', '0', '20', '0', '11', '1000', '21', '0', '0', 'ENDSEC', '0', 'EOF'].join('\n');
ok('mm units convert: 1000mm ≈ 3.28 ft', Math.abs(dxfLinearFeet(parseDxf(mm)) - 3.28) < 0.02, dxfLinearFeet(parseDxf(mm)));
ok('garbage input → ok:false, no throw', parseDxf('not a dxf at all').ok === false);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
