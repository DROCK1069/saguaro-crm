/**
 * Materials Catalog — the availability-honesty rule, in ONE place.
 *
 * THE RULE: the platform never claims inventory it cannot source.
 *
 * Every row in `catalog_vendor_prices` today carries `source = 'reference'` —
 * a one-time seeded snapshot with no store, no branch, no account, and no
 * live feed behind it. A seeded `stock_status` / `qty_in_stock` is therefore
 * NOT inventory; rendering it as a green "In stock" badge is a lie.
 *
 * Stock and availability may only be shown when the price row came from a
 * REAL vendor feed (any `source` other than 'reference'), and then it must be
 * stamped with the vendor and the `as_of` capture date. Otherwise the UI shows
 * the honest state plus the real path to act.
 *
 * Both the API route and the Catalog page import `hasLiveStock` from here so
 * the rule cannot drift apart between server and client.
 */

/** The seeded, never-refreshed snapshot source. Not a feed. */
export const REFERENCE_SOURCE = 'reference';

/** Loose shape so the same check works on raw DB rows and on API offers. */
export interface StockRow {
  source?: string | null;
  stock_status?: string | null;
  stockStatus?: string | null;
  qty_in_stock?: number | string | null;
  qtyInStock?: number | string | null;
}

/** True when `source` names a real vendor feed rather than the seeded snapshot. */
export function isLiveFeed(source: string | null | undefined): boolean {
  const s = String(source ?? '').trim().toLowerCase();
  return s.length > 0 && s !== REFERENCE_SOURCE;
}

/**
 * The single gate for every stock badge, quantity, lead time, and in-stock
 * sort in the catalog. False for reference rows — which today is all of them.
 */
export function hasLiveStock(row: StockRow | null | undefined): boolean {
  if (!row) return false;
  if (!isLiveFeed(row.source)) return false;
  const status = row.stockStatus ?? row.stock_status;
  const qty = row.qtyInStock ?? row.qty_in_stock;
  return (status != null && String(status).trim() !== '') || qty != null;
}

/** Honest availability language for rows with no live feed behind them. */
export const AVAILABILITY_UNTRACKED_LABEL = 'Availability not tracked';
export const AVAILABILITY_UNTRACKED_LINE = 'Availability not tracked — verify with the vendor';

/** The one-sentence description of how ordering actually works here. */
export const ORDER_PATH_SENTENCE =
  'To order: check availability with the vendor, draft the purchase order, and the vendor confirms price and stock before it is issued.';
