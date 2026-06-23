/**
 * lib/qbo-mapping.ts — construction-specific QuickBooks Online mapping.
 *
 * Transforms between Saguaro records and QBO API entities, both directions:
 *   subcontractor      → QBO Vendor
 *   commitment (sub/PO) → QBO Bill (cost-code → AccountRef, project → ClassRef)
 *   cost entry / invoice→ QBO Bill line
 *   owner pay app       → QBO Invoice (AR)
 *   QBO Bill            → cost entry        (pull)
 *   QBO BillPayment     → commitment invoiced-to-date update (pull)
 *
 * Pure functions — unit-testable offline; the route layer adds the OAuth call.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

const num = (v: unknown): number => (typeof v === 'number' ? v : parseFloat(String(v ?? '')) || 0);

export interface QboRefMap {
  /** cost_code / csi_division → QBO expense AccountRef value */
  accountByCode: Record<string, string>;
  /** default account when a code isn't mapped */
  defaultAccount: string;
  /** project_id → QBO ClassRef value (optional job costing) */
  classByProject?: Record<string, string>;
  /** our subcontractor/vendor id → QBO Vendor value */
  vendorByName?: Record<string, string>;
}

// ── Saguaro → QBO ────────────────────────────────────────────────────────────

export function subcontractorToVendor(sub: any) {
  const v: any = { DisplayName: String(sub.name || sub.company_name || 'Vendor').slice(0, 100) };
  if (sub.company_name) v.CompanyName = sub.company_name;
  if (sub.email) v.PrimaryEmailAddr = { Address: sub.email };
  if (sub.phone) v.PrimaryPhone = { FreeFormNumber: sub.phone };
  if (sub.tax_id || sub.ein) v.TaxIdentifier = String(sub.tax_id || sub.ein);
  return v;
}

function acctRef(code: string | null | undefined, refs: QboRefMap): { value: string } {
  const key = String(code || '').trim();
  return { value: refs.accountByCode[key] || refs.defaultAccount };
}

export function commitmentToBill(c: any, refs: QboRefMap): any {
  const amount = num(c.current_amount ?? c.original_amount);
  const line: any = {
    DetailType: 'AccountBasedExpenseLineDetail',
    Amount: amount,
    Description: (c.scope_of_work || c.description || 'Subcontract').slice(0, 1000),
    AccountBasedExpenseLineDetail: { AccountRef: acctRef(c.cost_code ?? c.csi_division, refs) },
  };
  if (c.project_id && refs.classByProject?.[c.project_id]) line.AccountBasedExpenseLineDetail.ClassRef = { value: refs.classByProject[c.project_id] };
  const bill: any = { Line: [line] };
  if (c.vendor_name && refs.vendorByName?.[c.vendor_name]) bill.VendorRef = { value: refs.vendorByName[c.vendor_name] };
  if (c.commitment_number) bill.DocNumber = String(c.commitment_number).slice(0, 21);
  if (c.contract_date) bill.TxnDate = String(c.contract_date).slice(0, 10);
  bill.PrivateNote = `Saguaro commitment ${c.id}`;
  return bill;
}

export function costEntryToBill(e: any, refs: QboRefMap): any {
  const line: any = {
    DetailType: 'AccountBasedExpenseLineDetail',
    Amount: num(e.amount),
    Description: (e.description || 'Cost').slice(0, 1000),
    AccountBasedExpenseLineDetail: { AccountRef: acctRef(e.csi_division, refs) },
  };
  if (e.project_id && refs.classByProject?.[e.project_id]) line.AccountBasedExpenseLineDetail.ClassRef = { value: refs.classByProject[e.project_id] };
  const bill: any = { Line: [line] };
  if (e.vendor_name && refs.vendorByName?.[e.vendor_name]) bill.VendorRef = { value: refs.vendorByName[e.vendor_name] };
  if (e.invoice_number) bill.DocNumber = String(e.invoice_number).slice(0, 21);
  if (e.entry_date) bill.TxnDate = String(e.entry_date).slice(0, 10);
  bill.PrivateNote = `Saguaro cost ${e.id}`;
  return bill;
}

export function payAppToInvoice(pa: any, customerRef: string, itemRef: string): any {
  const amount = num(pa.current_payment_due ?? pa.this_period ?? pa.amount);
  return {
    CustomerRef: { value: customerRef },
    DocNumber: pa.app_number ? `PA-${pa.app_number}` : undefined,
    TxnDate: (pa.created_at || '').slice(0, 10) || undefined,
    Line: [{ DetailType: 'SalesItemLineDetail', Amount: amount, Description: `Application for Payment ${pa.app_number ?? ''}`.trim(), SalesItemLineDetail: { ItemRef: { value: itemRef } } }],
  };
}

// ── QBO → Saguaro ────────────────────────────────────────────────────────────

export function qboBillToCostEntry(bill: any, ctx: { tenantId: string; projectId?: string | null }): any {
  const amount = num(bill.TotalAmt ?? (bill.Line || []).reduce((s: number, l: any) => s + num(l.Amount), 0));
  return {
    tenant_id: ctx.tenantId,
    project_id: ctx.projectId || null,
    amount,
    entry_type: 'bill',
    entry_date: (bill.TxnDate || new Date().toISOString().slice(0, 10)),
    vendor_name: bill.VendorRef?.name || null,
    invoice_number: bill.DocNumber || null,
    description: bill.PrivateNote || `QBO Bill ${bill.Id || ''}`.trim(),
  };
}

export function qboPaymentToInvoicedDelta(payment: any): { amount: number; billIds: string[] } {
  const lines = payment.Line || [];
  const billIds: string[] = [];
  for (const l of lines) for (const t of (l.LinkedTxn || [])) if (t.TxnType === 'Bill' && t.TxnId) billIds.push(String(t.TxnId));
  return { amount: num(payment.TotalAmt), billIds };
}
