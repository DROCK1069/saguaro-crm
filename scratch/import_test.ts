// Proof of CSV/Excel quantity import. Run:
//   npx esbuild scratch/import_test.ts --bundle --platform=node --format=cjs | node
import { importCsv, parseDelimited } from '../lib/takeoff/import-quantities';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, got?: unknown) => { if (c) { pass++; console.log('  PASS', n); } else { fail++; console.log('  FAIL', n, '→', got); } };

const catalog = [
  { id: 'slab_on_grade', name: 'Slab-on-grade' },
  { id: 'interior_partition', name: 'Interior partition (metal stud + GWB)' },
  { id: 'acoustic_ceiling', name: 'Acoustic ceiling (ACT)' },
];

// A realistic export: title rows, a header, quoted cell w/ comma + escaped quote, a bad row.
const csv = [
  'Project Takeoff Export,,,,',
  ',,,,',
  'Description,Quantity,Unit,CSI Code,Unit Cost',
  '"Slab-on-grade, 6"" concrete",4800,SF,03 30 00,$8.50',
  'Interior partition,320,LF,09 29 00,42.00',
  'Acoustic ceiling,"4,800",SF,09 51 00,3.80',
  'Bad row no qty,,EA,,',
].join('\n');

const r = importCsv(csv, catalog);
console.log('items:', r.items.length, 'headerRow:', r.headerRow, 'warnings:', r.warnings.length);
ok('ok', r.ok === true);
ok('header detected (row index 1 after blank-row filtering)', r.headerRow === 1, r.headerRow);
ok('3 valid items (bad row skipped)', r.items.length === 3, r.items.length);
ok('bad row produced a warning', r.warnings.some((w) => /Bad row/.test(w)));
ok('quoted cell w/ comma+escaped-quote parsed', r.items[0].description === 'Slab-on-grade, 6" concrete', r.items[0].description);
ok('qty 4800 SF, unit cost $8.50 → 850¢', r.items[0].qty === 4800 && r.items[0].unit === 'SF' && r.items[0].unitCostCents === 850);
ok('CSI carried', r.items[0].csi === '03 30 00');
ok('comma-in-quotes qty "4,800" → 4800', r.items[2].qty === 4800, r.items[2].qty);
ok('fuzzy match: Slab-on-grade → slab_on_grade', r.items[0].assemblyId === 'slab_on_grade', r.items[0].assemblyId);
ok('fuzzy match: Interior partition → interior_partition', r.items[1].assemblyId === 'interior_partition', r.items[1].assemblyId);
ok('fuzzy match: Acoustic ceiling → acoustic_ceiling', r.items[2].assemblyId === 'acoustic_ceiling', r.items[2].assemblyId);

// TSV also works
const tsv = 'Item\tQty\tUnit\nDrywall\t100\tSF';
ok('TSV parsed (tab-delimited)', importCsv(tsv).items.length === 1);
ok('no-header file → ok:false', importCsv('just,some,junk\n1,2,3').ok === false);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
