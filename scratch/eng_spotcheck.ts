import { computeTakeoff } from '../lib/takeoff/engine';
// 40x60 slab @ 6": 2400 SF. concrete = 2400*(1/27)*(6/12) = 44.4444 CY, +5% waste = 46.6667 CY.
// @ $165/CY ($16500¢) => 46.67 * 16500 = 770,055¢ = $7,700.55 (qty rounded to 46.67).
const r = computeTakeoff([{ id: 'c1', name: 'Slab', kind: 'area', value: 2400, thicknessIn: 6, assemblyId: 'slab_on_grade' }] as any, {});
const conc = r.lines.find((l: any) => l.key === 'concrete');
console.log('concrete qty CY:', conc.qty, '(expect 46.67)');
console.log('concrete material $:', (conc.materialCents/100).toFixed(2), '(expect ~7700.55)');
console.log('HAND-CHECK:', conc.qty === 46.67 && Math.abs(conc.materialCents - 770055) < 100 ? 'PASS' : 'FAIL');
