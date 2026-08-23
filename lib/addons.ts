/**
 * Self-service add-on catalog — the ONE typed list.
 *
 * Both surfaces render from this file:
 *   - app/app/billing/page.tsx        -> the "Plan & Add-ons" grid
 *   - app/api/billing/addon-request   -> key validation + notification copy
 *
 * HONEST PRICING: no add-on has Stripe billing automation yet (the only
 * Stripe prices are the plan prices in stripe-billing.ts), so `price` is an
 * honest label — never an invented dollar figure. Support confirms pricing
 * with the tenant before anything is billed or enabled.
 *
 * Pure data — safe to import from client components.
 */

export type AddonKind = 'feature' | 'service';

export interface AddonDef {
  key: string;
  name: string;
  price: string;
  desc: string;
  kind: AddonKind;
}

export const ADDONS: AddonDef[] = [
  {
    key: 'radio_streaming',
    name: 'Saguaro Radio Live Streaming',
    price: 'Paid add-on',
    desc: 'Live voice streaming in Saguaro Radio — your crews hear dispatch and each other in real time, on any device in the field.',
    kind: 'feature',
  },
  {
    key: 'quickbooks',
    name: 'QuickBooks Sync',
    price: 'Included with Enterprise',
    desc: 'Sync invoices, payments, and cost codes with QuickBooks so the office never double-enters what the field already tracked.',
    kind: 'feature',
  },
  {
    key: 'api_access',
    name: 'Custom API Access',
    price: 'Included with Enterprise',
    desc: 'Authenticated API access to your projects, pay apps, and documents for your own integrations and reporting.',
    kind: 'feature',
  },
  {
    key: 'white_label',
    name: 'White Label',
    price: 'Included with Enterprise',
    desc: 'Your logo and branding across the app and every client-facing portal your owners and subs see.',
    kind: 'feature',
  },
  {
    key: 'priority_support',
    name: 'Priority Support',
    price: 'Included with Professional',
    desc: 'Front-of-the-queue support — your questions are answered before standard-tier tickets.',
    kind: 'service',
  },
  {
    key: 'dedicated_csm',
    name: 'Dedicated CSM',
    price: 'Included with Enterprise',
    desc: 'A named customer success manager who knows your projects, runs your onboarding, and reviews your account with you.',
    kind: 'service',
  },
];

export const addonByKey = (key: string): AddonDef | undefined =>
  ADDONS.find((a) => a.key === key);
