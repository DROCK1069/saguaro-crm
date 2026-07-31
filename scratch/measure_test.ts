// Hand-checked proof of the measurement algorithm. Every expected value is worked out
// independently in the comment. Run:
//   npx esbuild scratch/measure_test.ts --bundle --platform=node --format=cjs | node
import {
  pxPerFt, calibrationSanity, segmentLengthsLF, lengthLF, perimeterLF, isClosed,
  grossSF, pointInPolygon, netAreaSF, netWallSF,
  slopeFactorPitch, slopeArea, roofingSquares, hipValleyLF,
  prismCY, crossSectionCY, averageEndAreaCY, fit3PointArc, chordSagittaToRadiusFt,
  snapEndpoint, snapOrtho, snapGrid, toSY, toSquares, toCF, measure,
} from './measure';

let pass = 0, fail = 0;
const near = (a: number, b: number, tol = 0.02) => Math.abs(a - b) <= tol;
const ok = (n: string, c: boolean, got?: unknown) => { if (c) { pass++; console.log('  PASS', n); } else { fail++; console.log('  FAIL', n, '→ got', got); } };

// scale
ok('pxPerFt: 100px / 10ft = 10', pxPerFt({ x: 0, y: 0 }, { x: 100, y: 0 }, 10) === 10);
ok('calibration sane (ppf10, 2400x1800px → 240ft)', calibrationSanity(10, 2400, 1800).ok === true);
ok('calibration flags absurd scale (ppf1000 → 2.4ft)', calibrationSanity(1000, 2400, 1800).ok === false);

// linear
ok('lengthLF 30+40 = 70', lengthLF([{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 40 }], 1) === 70);
ok('segmentLengthsLF = [30,40]', JSON.stringify(segmentLengthsLF([{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 40 }], 1)) === '[30,40]');
ok('perimeter 3-4-5 triangle = 12', perimeterLF([{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 4 }], 1) === 12);
ok('isClosed detects ring', isClosed([{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }, { x: 2, y: 2 }]) === true);

// area + voids
const rect40x60 = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 60 }, { x: 0, y: 60 }];
ok('grossSF 40x60 = 2400', grossSF(rect40x60, 1) === 2400);
ok('grossSF triangle 6x8/2 = 24', grossSF([{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 0, y: 8 }], 1) === 24);
ok('pointInPolygon inside', pointInPolygon({ x: 5, y: 5 }, rect40x60) === true);
ok('pointInPolygon outside', pointInPolygon({ x: 50, y: 50 }, rect40x60) === false);
const hole10 = [{ x: 5, y: 5 }, { x: 15, y: 5 }, { x: 15, y: 15 }, { x: 5, y: 15 }];
const net = netAreaSF(rect40x60, [hole10], 1);
ok('netAreaSF 2400 − 100 = 2300', net.netSF === 2300, net.netSF);
ok('hole is flagged contained', net.allHolesContained === true);
ok('netWallSF 1800 − 2×(3×7) = 1758', netWallSF(1800, [{ w: 3, h: 7 }, { w: 3, h: 7 }]) === 1758);
ok('netWallSF never negative', netWallSF(10, [{ w: 100, h: 100 }]) === 0);

// pitch / slope
ok('slopeFactor 6:12 = 1.1180', slopeFactorPitch(6) === 1.118);
ok('slopeArea 1000 @6:12 = 1118.03', near(slopeArea(1000, 6), 1118.03), slopeArea(1000, 6));
ok('roofingSquares 1118.03 = 11.18', roofingSquares(1118.03) === 11.18);
ok('hip/valley run 20 @6:12 = 30', hipValleyLF(20, 6) === 30);

// volume
ok('prismCY 2400SF × 0.5ft / 27 = 44.44', prismCY(2400, 0.5) === 44.44);
ok('crossSectionCY 2SF × 100LF / 27 = 7.41', crossSectionCY(2, 100) === 7.41);
ok('averageEndArea [10@0,20@50,30@100] = 74.07 CY',
  averageEndAreaCY([{ areaSF: 10, stationFt: 0 }, { areaSF: 20, stationFt: 50 }, { areaSF: 30, stationFt: 100 }]) === 74.07);

// arc (quarter circle R=10 → arc 15.71 LF, R 10, segment 28.54 SF)
const arc = fit3PointArc({ x: 10, y: 0 }, { x: 7.0711, y: 7.0711 }, { x: 0, y: 10 }, 1);
ok('arc radius ≈ 10', near(arc.radiusFt, 10), arc.radiusFt);
ok('arc length ≈ 15.71 (π/2·R) not 14.14 chord', near(arc.arcLenFt, 15.71, 0.05), arc.arcLenFt);
ok('arc segment area ≈ 28.54 SF', near(arc.segmentAreaSF, 28.54, 0.1), arc.segmentAreaSF);
ok('chord16/sagitta2 → R=17', chordSagittaToRadiusFt(16, 2) === 17);

// snapping
ok('snapOrtho (10,2) → horizontal (10,0)', JSON.stringify(snapOrtho({ x: 0, y: 0 }, { x: 10, y: 2 })) === '{"x":10,"y":0}');
ok('snapOrtho 45° (10,9) → (9.5,9.5)', JSON.stringify(snapOrtho({ x: 0, y: 0 }, { x: 10, y: 9 }, true)) === '{"x":9.5,"y":9.5}');
ok('snapGrid (23,47) g1 ppf10 → (20,50)', JSON.stringify(snapGrid({ x: 23, y: 47 }, 1, 10)) === '{"x":20,"y":50}');
ok('snapEndpoint snaps within tol', JSON.stringify(snapEndpoint({ x: 3, y: 3 }, [{ x: 0, y: 0 }, { x: 5, y: 5 }], 10)) === '{"x":5,"y":5}');

// units
ok('toSY 900SF = 100', toSY(900) === 100);
ok('toSquares 1000SF = 10', toSquares(1000) === 10);
ok('toCF 2400SF × 0.5ft = 1200', toCF(2400, 0.5) === 1200);

// dispatcher + determinism
const p = measure('pitch', { points: rect40x60, ppf: 1, riseOver12: 6 });
ok('measure(pitch) 2400 plan → sloped 2683.28', near(p.value, 2683.28, 0.1), p.value);
const v = measure('volume', { points: rect40x60, ppf: 1, depthFt: 0.5 });
ok('measure(volume) → 44.44 CY', v.value === 44.44, v.value);
const a1 = measure('area', { points: rect40x60, holes: [hole10], ppf: 1 });
const a2 = measure('area', { points: rect40x60, holes: [hole10], ppf: 1 });
ok('measure(area) net = 2300 + deterministic', a1.value === 2300 && JSON.stringify(a1) === JSON.stringify(a2));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
