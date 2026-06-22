/**
 * lib/takeoff-line-item.ts
 *
 * Translation layer between the estimate workspace UI shape and the real
 * `takeoff_line_items` columns (see lib/database.types.ts).
 *
 * The UI talks in generic aliases (unit_cost, material_cost, labor_cost,
 * extended_cost, labor_hours, division, crew_size, duration, subcontractor,
 * sheet_id). Only some of those have dedicated columns; the rest live in the
 * `metadata` jsonb. These helpers keep writes and reads symmetric so values
 * survive a round-trip and don't silently vanish on reload.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return isNaN(n) ? 0 : n;
};

// UI alias -> real column on takeoff_line_items
const COST_ALIASES: Record<string, string> = {
  unit_cost: 'unit_material_cost',
  material_cost: 'total_material',
  labor_cost: 'total_labor',
  equipment_cost: 'total_equipment',
};

// Direct UI fields that map 1:1 onto real columns
const DIRECT_FIELDS = [
  'description', 'csi_code', 'csi_division', 'csi_description',
  'category', 'quantity', 'unit', 'notes', 'sort_order',
];

// UI fields with no dedicated column — persisted in metadata jsonb
const META_FIELDS = [
  'sheet_id', 'assembly_id', 'cost_code_id', 'measurement_type', 'markup_pct',
  'extended_cost', 'labor_hours', 'crew_size', 'duration', 'division',
  'subcontractor',
];

/**
 * Build the DB-column subset of a write payload from a UI body.
 * Returns { fields } where fields contains only real columns plus (optionally)
 * `metadata`. Caller merges `metadata` onto any existing jsonb for PATCH.
 */
export function lineItemWriteFields(body: Record<string, any>): {
  fields: Record<string, any>;
  metaPatch: Record<string, any>;
} {
  const fields: Record<string, any> = {};
  for (const k of DIRECT_FIELDS) {
    if (body[k] !== undefined) fields[k] = body[k];
  }
  for (const [alias, col] of Object.entries(COST_ALIASES)) {
    if (body[alias] !== undefined) fields[col] = body[alias];
  }
  const metaPatch: Record<string, any> = {};
  for (const k of META_FIELDS) {
    if (body[k] !== undefined) metaPatch[k] = body[k];
  }
  return { fields, metaPatch };
}

/**
 * Normalize a DB row into the shape the estimate UI expects. Surfaces cost
 * aliases from real columns and lifts metadata-only fields to the top level.
 * Computes extended_cost defensively so the UI never sees NaN.
 */
export function normalizeLineItem(row: Record<string, any>): Record<string, any> {
  const meta = (row.metadata && typeof row.metadata === 'object') ? row.metadata : {};

  const unit_cost = num(row.unit_material_cost ?? meta.unit_cost);
  const quantity = num(row.quantity);
  const material_cost = num(row.total_material ?? meta.material_cost);
  const labor_cost = num(row.total_labor ?? meta.labor_cost);
  const equipment_cost = num(row.total_equipment ?? meta.equipment_cost);
  const extended_cost = num(meta.extended_cost) || (quantity * unit_cost);

  return {
    ...row,
    unit_cost,
    material_cost,
    labor_cost,
    equipment_cost,
    extended_cost,
    labor_hours: num(meta.labor_hours),
    crew_size: meta.crew_size != null ? num(meta.crew_size) : 1,
    duration: num(meta.duration),
    division: meta.division ?? row.csi_division ?? '',
    subcontractor: meta.subcontractor ?? '',
    sheet_id: meta.sheet_id ?? '',
    // expose the canonical takeoff project id under the UI's field name too
    takeoff_project_id: row.takeoff_id,
  };
}

export function normalizeLineItems(rows: Record<string, any>[]): Record<string, any>[] {
  return (rows || []).map(normalizeLineItem);
}
