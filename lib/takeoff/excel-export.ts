/**
 * Excel round-trip — export a priced takeoff to a real, editable .xlsx (and its "Line Items"
 * sheet is shaped to re-import through import-quantities.ts, so a GC can export → edit in
 * Excel → bring it back). Completes the migration loop competitors only do one way.
 * Pure (uses the installed xlsx). Deterministic.
 */
import * as XLSX from 'xlsx';
import type { Condition, TakeoffResult } from './types';

const usd = (cents: number) => Math.round(cents) / 100;

export function buildTakeoffWorkbook(args: {
  projectName?: string;
  conditions: Condition[];
  result: TakeoffResult;
  assemblyName?: (id: string) => string;
}): XLSX.WorkBook {
  const { projectName = 'Takeoff', conditions, result } = args;
  const wb = XLSX.utils.book_new();

  // Sheet 1 — LINE ITEMS (re-importable: Description / Quantity / Unit / CSI / Unit Cost).
  const lineRows: (string | number)[][] = [['Description', 'Quantity', 'Unit', 'CSI', 'Unit Cost', 'Material', 'Labor', 'Extended']];
  for (const l of result.lines) {
    lineRows.push([
      l.name, l.qty, l.unit, l.csi,
      usd(l.unitMaterialCents), usd(l.materialCents), usd(l.laborCents), usd(l.totalCents),
    ]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(lineRows), 'Line Items');

  // Sheet 2 — CONDITIONS (measured inputs).
  const condRows: (string | number)[][] = [['Name', 'Kind', 'Value', 'Unit', 'Assembly', 'Height ft', 'Thickness in']];
  for (const c of conditions) {
    condRows.push([c.name, c.kind, c.value, c.kind === 'area' ? 'SF' : c.kind === 'linear' ? 'LF' : 'EA', c.assemblyId, c.heightFt ?? '', c.thicknessIn ?? '']);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(condRows), 'Conditions');

  // Sheet 3 — DIVISION ROLLUP.
  const divRows: (string | number)[][] = [['Division / Trade', 'Material', 'Labor', 'Extended', 'Lines']];
  for (const d of result.byDivision) divRows.push([d.trade, usd(d.materialCents), usd(d.laborCents), usd(d.totalCents), d.lines]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(divRows), 'By Division');

  // Sheet 4 — SUMMARY + markup build-up.
  const sumRows: (string | number)[][] = [
    ['Project', projectName],
    ['Material', usd(result.materialCents)],
    ['Labor', usd(result.laborCents)],
    ['Labor hours', result.laborHrs],
    ['Subtotal (direct)', usd(result.subtotalCents)],
    ['Overhead', usd(result.overheadCents)],
    ['Contingency', usd(result.contingencyCents)],
    ['Profit', usd(result.profitCents)],
    ['SELL PRICE', usd(result.sellCents)],
    ['Cost / SF', result.costPerSf ?? ''],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sumRows), 'Summary');

  return wb;
}

/** Base64 .xlsx for a download link / data-URL. */
export function workbookToBase64(wb: XLSX.WorkBook): string {
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
}
