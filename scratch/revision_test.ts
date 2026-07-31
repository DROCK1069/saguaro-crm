// Proof of the priced revision compare. Run:
//   npx esbuild scratch/revision_test.ts --bundle --platform=node --format=cjs | node
import { diffTakeoffs } from '../lib/takeoff/revision-diff';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, got?: unknown) => { if (c) { pass++; console.log('  PASS', n); } else { fail++; console.log('  FAIL', n, '→', got); } };

const opts = { overheadPct: 10, profitPct: 8, contingencyPct: 5 };
const oldC = [
  { id: 'a', name: 'Slab', kind: 'area', value: 2000, thicknessIn: 6, assemblyId: 'slab_on_grade' },
  { id: 'b', name: 'Partition', kind: 'linear', value: 100, heightFt: 9, assemblyId: 'interior_partition' },
] as never;
const newC = [
  { id: 'a', name: 'Slab', kind: 'area', value: 2400, thicknessIn: 6, assemblyId: 'slab_on_grade' }, // changed
  { id: 'b', name: 'Partition', kind: 'linear', value: 100, heightFt: 9, assemblyId: 'interior_partition' }, // same
  { id: 'c', name: 'Doors', kind: 'count', value: 3, assemblyId: 'door_frame' }, // added
] as never;

const d = diffTakeoffs(oldC, newC, opts);
const line = (k: string) => d.lines.find((l) => l.key === k)!;
console.log('net delta $:', (d.netDeltaCents / 100).toFixed(2), '| added:', (d.addedCents / 100).toFixed(2), '| changed:', (d.changedCents / 100).toFixed(2));

ok('slab CHANGED 2000→2400, positive delta', line('a').status === 'changed' && line('a').newValue === 2400 && line('a').deltaCents > 0);
ok('partition UNCHANGED, zero delta', line('b').status === 'unchanged' && line('b').deltaCents === 0);
ok('doors ADDED, positive delta', line('c').status === 'added' && line('c').deltaCents > 0);
ok('addedCents > 0 (the 3 doors)', d.addedCents > 0);
ok('changedCents > 0 (bigger slab)', d.changedCents > 0);
ok('removedCents === 0 (nothing removed)', d.removedCents === 0);
ok('net delta = added + changed + removed (linear markups, ±rounding)',
  Math.abs(d.netDeltaCents - (d.addedCents + d.changedCents + d.removedCents)) < 100,
  d.netDeltaCents - (d.addedCents + d.changedCents + d.removedCents));

// removal case: dropping the partition is a credit
const d2 = diffTakeoffs(oldC, [oldC[0]] as never, opts);
ok('removing a condition → negative removedCents (credit)', d2.lines.find((l) => l.key === 'b')!.status === 'removed' && d2.removedCents < 0, d2.removedCents);
ok('net delta negative on a removal', d2.netDeltaCents < 0);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
