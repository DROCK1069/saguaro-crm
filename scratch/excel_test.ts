// Proof of the Excel round-trip export. Run:
//   npx esbuild scratch/excel_test.ts --bundle --platform=node --format=cjs | node
import * as XLSX from 'xlsx';
import { computeTakeoff } from '../lib/takeoff/engine';
import { buildTakeoffWorkbook, workbookToBase64 } from '../lib/takeoff/excel-export';
import { rowsToImport } from '../lib/takeoff/import-quantities';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, got?: unknown) => { if (c) { pass++; console.log('  PASS', n); } else { fail++; console.log('  FAIL', n, '→', got); } };

const conditions = [
  { id: 'a', name: 'Slab', kind: 'area', value: 2400, thicknessIn: 6, assemblyId: 'slab_on_grade' },
  { id: 'b', name: 'Partition', kind: 'linear', value: 100, heightFt: 9, assemblyId: 'interior_partition' },
] as never;
const result = computeTakeoff(conditions, { overheadPct: 10, profitPct: 8 });
const wb = buildTakeoffWorkbook({ projectName: 'Test Project', conditions, result });

ok('4 sheets present', ['Line Items', 'Conditions', 'By Division', 'Summary'].every((s) => wb.SheetNames.includes(s)), wb.SheetNames);

// write → read back (real xlsx binary round-trip)
const b64 = workbookToBase64(wb);
ok('base64 xlsx produced', b64.length > 100);
const wb2 = XLSX.read(b64, { type: 'base64' });
const summary = XLSX.utils.sheet_to_json<(string | number)[]>(wb2.Sheets['Summary'], { header: 1 });
const sellRow = summary.find((r) => String(r[0]).toUpperCase() === 'SELL PRICE');
ok('Summary SELL PRICE survives the write/read', !!sellRow && Math.abs(Number(sellRow![1]) - result.sellCents / 100) < 0.5, sellRow);

// the Line Items sheet RE-IMPORTS through import-quantities (the round-trip)
const liRows = XLSX.utils.sheet_to_json<(string | number)[]>(wb2.Sheets['Line Items'], { header: 1 });
const back = rowsToImport(liRows, [
  { id: 'slab_on_grade', name: 'Slab-on-grade' },
  { id: 'interior_partition', name: 'Interior partition (metal stud + GWB)' },
]);
console.log('exported line items:', result.lines.length, '→ re-imported:', back.items.length);
ok('exported Line Items re-import (round-trip)', back.ok && back.items.length === result.lines.length, `${back.items.length}/${result.lines.length}`);
ok('re-imported qty matches an exported line', back.items[0].qty === result.lines[0].qty && back.items[0].description === result.lines[0].name);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
