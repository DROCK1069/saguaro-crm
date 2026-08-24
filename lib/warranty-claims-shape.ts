/**
 * warranty_claims stores a few UI fields under different column names
 * (priority->severity, assigned_trade->trade, assigned_contractor->assigned_to,
 * photos->photo_urls, completed_date->resolved_at). Everything else has a real
 * column of its own — see supabase/migrations/20260824_warranty_claims_full_model.sql.
 *
 * This module is the single place that translates between the DB row and the
 * shape app/app/warranty-claims/page.tsx renders, so neither side has to guess.
 */

export type WarrantyRow = Record<string, unknown>;

function dateOnly(v: unknown): string {
  if (!v) return '';
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

export interface WarrantyClaimUi {
  id: string;
  claim_number: string;
  title: string;
  description: string;
  category: string;
  location: string;
  reported_by: string;
  reported_date: string;
  priority: string;
  status: string;
  assigned_trade: string;
  assigned_contractor: string;
  scheduled_date: string;
  completed_date: string;
  resolution: string;
  cost: number;
  covered_under_warranty: boolean;
  warranty_expiry: string;
  photos: string[];
  notes: string;
  communication_log: unknown[];
}

export function toUi(row: WarrantyRow): WarrantyClaimUi {
  return {
    id: String(row.id ?? ''),
    claim_number: (row.claim_number as string) || '',
    title: (row.title as string) || '',
    description: (row.description as string) || '',
    category: (row.category as string) || 'general',
    location: (row.location as string) || '',
    reported_by: (row.reported_by as string) || '',
    reported_date: dateOnly(row.reported_date ?? row.created_at),
    priority: (row.severity as string) || 'medium',
    status: (row.status as string) || 'submitted',
    assigned_trade: (row.trade as string) || '',
    assigned_contractor: (row.assigned_to as string) || '',
    scheduled_date: dateOnly(row.scheduled_date),
    completed_date: dateOnly(row.resolved_at),
    resolution: (row.resolution as string) || '',
    // cost is numeric in PG but arrives as a string over PostgREST — Number() always.
    cost: Number(row.cost ?? 0) || 0,
    covered_under_warranty: row.covered_under_warranty !== false,
    warranty_expiry: dateOnly(row.warranty_expiry),
    photos: Array.isArray(row.photo_urls) ? (row.photo_urls as string[]) : [],
    notes: (row.notes as string) || '',
    communication_log: Array.isArray(row.communication_log) ? (row.communication_log as unknown[]) : [],
  };
}

/**
 * UI field name -> DB column, for PATCH. Fields absent from a body are left
 * untouched; anything not listed here has no column and is rejected rather than
 * silently dropped (a dropped edit is the bug this map exists to prevent).
 */
export const PATCH_COLUMN: Record<string, string> = {
  title: 'title',
  description: 'description',
  category: 'category',
  location: 'location',
  reported_by: 'reported_by',
  reported_date: 'reported_date',
  priority: 'severity',
  status: 'status',
  assigned_trade: 'trade',
  assigned_contractor: 'assigned_to',
  scheduled_date: 'scheduled_date',
  completed_date: 'resolved_at',
  resolution: 'resolution',
  cost: 'cost',
  covered_under_warranty: 'covered_under_warranty',
  warranty_expiry: 'warranty_expiry',
  photos: 'photo_urls',
  notes: 'notes',
  communication_log: 'communication_log',
  claim_number: 'claim_number',
};

/** Build the DB patch for a UI-shaped body. Empty date strings become NULL. */
export function toDbPatch(body: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const DATE_FIELDS = new Set(['reported_date', 'scheduled_date', 'completed_date', 'warranty_expiry']);
  for (const [uiKey, column] of Object.entries(PATCH_COLUMN)) {
    if (body[uiKey] === undefined) continue;
    let v = body[uiKey];
    if (DATE_FIELDS.has(uiKey) && (v === '' || v === null)) v = null;
    if (uiKey === 'cost') v = Number(v) || 0;
    patch[column] = v;
  }
  return patch;
}
