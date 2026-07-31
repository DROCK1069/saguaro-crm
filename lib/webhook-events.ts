/**
 * lib/webhook-events.ts
 * -------------------------------------------------------------------------
 * THE canonical catalog of outbound webhook events.
 *
 * This is the single source of truth that ties three things together so
 * webhooks actually fire end-to-end:
 *   1. What events `lib/triggers.ts` emits (via lib/webhook-dispatch.ts).
 *   2. What events a tenant can SUBSCRIBE to (the outbound_webhooks POST
 *      validation + the Integration Hub subscription UI + the Zapier route).
 *   3. What the public API docs advertise.
 *
 * Before this file existed, the subscribe-side lists (rfi.created,
 * submittal.approved, budget.updated, …) named events that NO trigger ever
 * emitted — which is exactly why every registered webhook showed "Never
 * fired". Every entry below is emitted for real by a trigger in
 * lib/triggers.ts; keep the two in lock-step.
 *
 * Pure data only — NO node/server imports — so it is safe to import from
 * client components (the api-docs + integrations-hub pages) as well as
 * server routes.
 * -------------------------------------------------------------------------
 */

export interface WebhookEventDef {
  /** Wire name sent in the payload + X-Saguaro-Event header. */
  event: string;
  /** Human description shown in docs / subscription UI. */
  description: string;
  /** Grouping label for docs rendering. */
  category: 'Projects' | 'Pay Applications' | 'Bids' | 'RFIs' | 'Change Orders' | 'Subcontractors' | 'Compliance';
}

export const WEBHOOK_EVENT_CATALOG: readonly WebhookEventDef[] = [
  // Projects
  { event: 'project.created', description: 'A new project is created', category: 'Projects' },
  { event: 'project.substantial_completion', description: 'A project is marked substantially complete', category: 'Projects' },
  { event: 'project.closed', description: 'A project is closed and closeout begins', category: 'Projects' },
  // Pay Applications
  { event: 'pay_app.created', description: 'A pay application draft is created', category: 'Pay Applications' },
  { event: 'pay_app.submitted', description: 'A pay application is submitted to the owner', category: 'Pay Applications' },
  { event: 'pay_app.approved', description: 'A pay application is approved', category: 'Pay Applications' },
  { event: 'pay_app.certified', description: 'A pay application payment is certified', category: 'Pay Applications' },
  // Bids
  { event: 'bid_package.created', description: 'A bid package is created', category: 'Bids' },
  { event: 'bid.invited', description: 'A subcontractor is invited to bid', category: 'Bids' },
  { event: 'bid.submitted', description: 'A subcontractor submits a bid', category: 'Bids' },
  { event: 'bid.awarded', description: 'A bid is awarded to a subcontractor', category: 'Bids' },
  // RFIs
  { event: 'rfi.submitted', description: 'A new RFI is submitted', category: 'RFIs' },
  { event: 'rfi.responded', description: 'An RFI receives a response', category: 'RFIs' },
  // Change Orders
  { event: 'change_order.approved', description: 'A change order is approved', category: 'Change Orders' },
  // Subcontractors
  { event: 'subcontractor.added', description: 'A subcontractor is added to a project', category: 'Subcontractors' },
  // Compliance
  { event: 'insurance.expiring', description: 'A subcontractor insurance certificate is expiring', category: 'Compliance' },
] as const;

/** Just the wire names — used for subscription validation + UI chips. */
export const WEBHOOK_EVENT_NAMES: readonly string[] = WEBHOOK_EVENT_CATALOG.map((e) => e.event);

/** A subscribable webhook event name. Loose by design (catalog is the runtime gate). */
export type WebhookEvent = string;

/** True if `event` is a known, emittable webhook event. */
export function isKnownWebhookEvent(event: string): boolean {
  return WEBHOOK_EVENT_NAMES.includes(event);
}
