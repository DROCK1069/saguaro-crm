/**
 * lib/approvals.ts
 * Shared metadata + helpers for the Approval Workflows engine.
 *
 * The pending / history / dashboard surfaces are computed LIVE from
 * the four real approvable entity tables (change_orders, pay_applications,
 * purchase_orders, invoices). This module maps each approval "module"
 * to its underlying table + the columns/statuses that make it real.
 */

export type EntityType = 'change_order' | 'pay_app' | 'purchase_order' | 'invoice';

export interface EntityMeta {
  entityType: EntityType;
  table: 'change_orders' | 'pay_applications' | 'purchase_orders' | 'invoices';
  /** Human display label (kept in sync with the page's Module type). */
  label: string;
  /** Columns actually present on the DB row that select() must request. */
  selectCols: string[];
  /** Amount columns, first non-null wins. */
  amountCols: string[];
  numberCol: string;
  numberPrefix: string;
  titleCol: string | null;
  /** A text column naming the requester, if the table has one. */
  requesterCol: string | null;
  /** True if the table has a rejected_at timestamp column. */
  hasRejectedAt: boolean;
  /** Statuses that mean "awaiting approval" (shows in Pending). */
  awaiting: string[];
  /** Statuses that mean "approved" (terminal). */
  approved: string[];
  /** Statuses that mean "rejected" (terminal). */
  rejected: string[];
}

export const ENTITY_META: Record<EntityType, EntityMeta> = {
  change_order: {
    entityType: 'change_order', table: 'change_orders', label: 'Change Orders',
    selectCols: ['id', 'status', 'co_number', 'title', 'amount', 'initiated_by', 'project_id', 'created_at', 'approved_at', 'rejected_at'],
    amountCols: ['amount'], numberCol: 'co_number', numberPrefix: 'CO #',
    titleCol: 'title', requesterCol: 'initiated_by', hasRejectedAt: true,
    awaiting: ['pending', 'submitted', 'pm_review', 'architect_review', 'pending_owner', 'pricing', 'under_review', 'in_review'],
    approved: ['approved'], rejected: ['rejected'],
  },
  pay_app: {
    entityType: 'pay_app', table: 'pay_applications', label: 'Pay Apps',
    selectCols: ['id', 'status', 'app_number', 'current_payment_due', 'this_period', 'project_id', 'created_at', 'approved_at', 'rejected_at'],
    amountCols: ['current_payment_due', 'this_period'], numberCol: 'app_number', numberPrefix: 'Pay App #',
    titleCol: null, requesterCol: null, hasRejectedAt: true,
    awaiting: ['submitted', 'pending', 'under_review'],
    approved: ['approved', 'certified'], rejected: ['rejected'],
  },
  purchase_order: {
    entityType: 'purchase_order', table: 'purchase_orders', label: 'Purchase Orders',
    selectCols: ['id', 'status', 'po_number', 'vendor_name', 'total', 'subtotal', 'project_id', 'created_at', 'approved_at'],
    amountCols: ['total', 'subtotal'], numberCol: 'po_number', numberPrefix: 'PO #',
    titleCol: 'vendor_name', requesterCol: null, hasRejectedAt: false,
    awaiting: ['pending', 'submitted', 'pending_approval', 'under_review'],
    approved: ['approved'], rejected: ['rejected'],
  },
  invoice: {
    entityType: 'invoice', table: 'invoices', label: 'Invoices',
    selectCols: ['id', 'status', 'invoice_number', 'vendor_name', 'total', 'amount', 'project_id', 'created_at', 'approved_at'],
    amountCols: ['total', 'amount'], numberCol: 'invoice_number', numberPrefix: 'INV ',
    titleCol: 'vendor_name', requesterCol: null, hasRejectedAt: false,
    awaiting: ['pending', 'submitted', 'under_review'],
    approved: ['approved'], rejected: ['rejected'],
  },
};

export const ENTITY_TYPES = Object.keys(ENTITY_META) as EntityType[];

export function metaFor(t: string | null | undefined): EntityMeta | null {
  if (!t) return null;
  return (ENTITY_META as Record<string, EntityMeta>)[t] || null;
}

export function moduleLabel(t: EntityType): string {
  return ENTITY_META[t].label;
}

/** First non-null numeric amount column, coerced to a number. */
export function pickAmount(meta: EntityMeta, row: Record<string, unknown>): number {
  for (const c of meta.amountCols) {
    const v = row[c];
    if (v !== null && v !== undefined && v !== '') {
      const n = typeof v === 'number' ? v : Number(v);
      if (!Number.isNaN(n)) return n;
    }
  }
  return 0;
}

/** Build a human item label ("CO #12 - Foundation Rework"). */
export function itemLabel(meta: EntityMeta, row: Record<string, unknown>): string {
  const num = row[meta.numberCol];
  const numPart = num !== null && num !== undefined && num !== ''
    ? `${meta.numberPrefix}${num}` : meta.label.replace(/s$/, '');
  const title = meta.titleCol ? (row[meta.titleCol] as string | null) : null;
  return title ? `${numPart} - ${title}` : numPart;
}

/** Normalized shape shared by pending + history rows. */
export interface NormalizedItem {
  entityType: EntityType;
  entityId: string;
  module: string;          // display label
  itemName: string;
  itemAmount: number;
  requestedBy: string | null;
  requestedAt: string | null;
  projectId: string | null;
  status: string;
}

export function normalizeRow(meta: EntityMeta, row: Record<string, unknown>): NormalizedItem {
  return {
    entityType: meta.entityType,
    entityId: String(row.id),
    module: meta.label,
    itemName: itemLabel(meta, row),
    itemAmount: pickAmount(meta, row),
    requestedBy: meta.requesterCol ? ((row[meta.requesterCol] as string | null) ?? null) : null,
    requestedAt: (row.created_at as string | null) ?? null,
    projectId: (row.project_id as string | null) ?? null,
    status: String(row.status ?? ''),
  };
}
