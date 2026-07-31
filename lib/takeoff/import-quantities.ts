/**
 * Import existing takeoff quantities from CSV / Excel — the migration wedge (bring a
 * PlanSwift/STACK/Excel takeoff straight in). Pure + deterministic: detects the header
 * row, maps columns fuzzily (description / qty / unit / CSI / unit-cost), and — when given
 * the assembly catalog — auto-matches each row to an assembly by name overlap so it prices
 * through the same engine. Rows it can't match come in unassigned for the user to map.
 */

export interface ImportedItem {
  description: string;
  qty: number;
  unit: string;
  csi?: string;
  unitCostCents?: number;
  assemblyId?: string;      // auto-matched when possible
}
export interface ImportResult {
  ok: boolean;
  error?: string;
  items: ImportedItem[];
  headerRow: number;        // 0-based row the header was found on (-1 if none)
  columns: Record<string, number>; // resolved column indices
  warnings: string[];
}

/** Quote-aware CSV/TSV parser → rows of string cells. */
export function parseDelimited(text: string): string[][] {
  const delim = text.indexOf('\t') >= 0 && (text.indexOf(',') < 0 || text.indexOf('\t') < text.indexOf(',')) ? '\t' : ',';
  const rows: string[][] = [];
  let row: string[] = [], cell = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c === '\r') { /* skip */ }
    else cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const HEADERS: Record<string, string[]> = {
  description: ['description', 'item', 'material', 'scopeofwork', 'lineitem', 'name'],
  qty: ['qty', 'quantity', 'count', 'amount', 'takeoffqty'],
  unit: ['unit', 'uom', 'units', 'measure'],
  csi: ['csi', 'csicode', 'division', 'code'],
  unitcost: ['unitcost', 'unitprice', 'rate', 'cost', 'price', 'material'],
};

function findHeader(rows: string[][]): { row: number; cols: Record<string, number> } {
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const cells = rows[r].map(norm);
    const cols: Record<string, number> = {};
    for (const [key, aliases] of Object.entries(HEADERS)) {
      const idx = cells.findIndex((c) => aliases.some((a) => c === a || c.includes(a)));
      if (idx >= 0) cols[key] = idx;
    }
    if (cols.description != null && cols.qty != null) return { row: r, cols };
  }
  return { row: -1, cols: {} };
}

const toNum = (s: unknown) => {
  const n = parseFloat(String(s ?? '').replace(/[$,%\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/** Fuzzy-match a description to an assembly id by word-token overlap (needs the catalog).
 *  Tokenize the RAW strings on words (3+ letters) — do NOT norm() first, or spaces collapse
 *  and every multi-word name becomes one un-matchable token. */
const words = (s: string) => new Set((s.toLowerCase().match(/[a-z]{3,}/g) || []));
function matchAssembly(desc: string, catalog?: { id: string; name: string }[]): string | undefined {
  if (!catalog?.length) return undefined;
  const dtok = words(desc);
  if (!dtok.size) return undefined;
  let best: string | undefined, bestScore = 0;
  for (const a of catalog) {
    const atok = [...words(a.name)];
    if (!atok.length) continue;
    let hit = 0;
    for (const t of atok) if (dtok.has(t)) hit++;
    const score = hit / atok.length;
    if (hit >= 1 && score > bestScore) { bestScore = score; best = a.id; }
  }
  return bestScore >= 0.34 ? best : undefined; // require a real overlap
}

/** Parse rows (from CSV or an Excel sheet_to_json header:1 array) into importable items. */
export function rowsToImport(rows: (string | number)[][], catalog?: { id: string; name: string }[]): ImportResult {
  const grid = rows.map((r) => r.map((c) => String(c ?? '')));
  const { row: headerRow, cols } = findHeader(grid);
  if (headerRow < 0) return { ok: false, error: 'No header row with a Description and Quantity column was found.', items: [], headerRow: -1, columns: {}, warnings: [] };

  const items: ImportedItem[] = [];
  const warnings: string[] = [];
  for (let r = headerRow + 1; r < grid.length; r++) {
    const cells = grid[r];
    const description = (cells[cols.description] ?? '').trim();
    if (!description) continue;
    const qty = toNum(cells[cols.qty]);
    if (!(qty > 0)) { warnings.push(`Row ${r + 1} "${description.slice(0, 30)}" has no positive quantity — skipped.`); continue; }
    const unit = (cols.unit != null ? cells[cols.unit] : '')?.trim() || 'EA';
    const csi = cols.csi != null ? cells[cols.csi]?.trim() : undefined;
    const uc = cols.unitcost != null ? toNum(cells[cols.unitcost]) : 0;
    items.push({
      description, qty, unit,
      csi: csi || undefined,
      unitCostCents: uc > 0 ? Math.round(uc * 100) : undefined,
      assemblyId: matchAssembly(description, catalog),
    });
  }
  if (!items.length) warnings.push('No priced rows found below the header.');
  return { ok: items.length > 0, items, headerRow, columns: cols, warnings };
}

/** Convenience: parse a CSV/TSV string end-to-end. */
export function importCsv(text: string, catalog?: { id: string; name: string }[]): ImportResult {
  if (!text?.trim()) return { ok: false, error: 'Empty file', items: [], headerRow: -1, columns: {}, warnings: [] };
  return rowsToImport(parseDelimited(text), catalog);
}
