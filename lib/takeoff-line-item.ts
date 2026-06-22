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

// Direct UI fields that map 1:1 onto real columns
const DIRECT_FIELDS = [
  'description', 'csi_code', 'csi_division', 'csi_description',
  'category', 'quantity', 'unit', 'notes', 'sort_order',
];

// UI fields with no dedicated column — persisted in metadata jsonb.
// NOTE: material_cost/labor_cost/equipment_cost/extended_cost are EXTENDED
// totals in the UI; total_material/total_labor/total_equipment/total_sub are
// GENERATED columns in the DB (qty * unit_*), so we never write them — we
// write the unit_* columns and let the DB compute the totals, and we also
// stash the raw UI values in metadata for an exact reload round-trip.
const META_FIELDS = [
  'sheet_id', 'assembly_id', 'cost_code_id', 'measurement_type', 'markup_pct',
  'extended_cost', 'labor_hours', 'crew_size', 'duration', 'division',
  'subcontractor', 'material_cost', 'labor_cost', 'equipment_cost', 'unit_cost',
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
  // Write only WRITABLE unit_* columns; the DB computes total_* (generated).
  const qty = num(body.quantity);
  if (body.unit_cost !== undefined) fields.unit_material_cost = num(body.unit_cost);
  else if (body.material_cost !== undefined && qty > 0) fields.unit_material_cost = num(body.material_cost) / qty;
  // UI labor_cost/equipment_cost are extended totals -> store as per-unit so the
  // generated total_labor/total_equipment (qty * unit) match the entered amount.
  if (body.labor_cost !== undefined) fields.unit_labor_cost = qty > 0 ? num(body.labor_cost) / qty : num(body.labor_cost);
  if (body.equipment_cost !== undefined) fields.unit_equipment_cost = qty > 0 ? num(body.equipment_cost) / qty : num(body.equipment_cost);

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
  // Prefer the raw UI values stashed in metadata (exact round-trip); fall back
  // to the DB's generated total_* columns (qty * unit_*).
  const material_cost = num(meta.material_cost ?? row.total_material);
  const labor_cost = num(meta.labor_cost ?? row.total_labor);
  const equipment_cost = num(meta.equipment_cost ?? row.total_equipment);
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
