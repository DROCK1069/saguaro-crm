/**
 * Finance engine — Schedule of Values + AIA G702/G703 progress billing.
 * Deterministic, integer-cents, no DOM. Shared web + iOS (mirrors lib/takeoff).
 * Closes the money loop: estimate → SOV → monthly pay application.
 */

/** One Schedule-of-Values line (a G703 row). All money in integer cents. */
export interface SovLine {
  id: string;
  itemNo: string;
  description: string;
  costCode?: string;
  scheduledValueCents: number;        // C — the contracted value of this line
  fromPreviousCents: number;          // D — completed in prior applications
  thisPeriodCents: number;            // E — completed this billing period
  storedCents: number;                // F — materials presently stored (not yet in place)
}

/** Computed G703 row — everything the continuation sheet shows. */
export interface G703Row extends SovLine {
  totalCompletedStoredCents: number;  // G = D + E + F
  percentComplete: number;            // G / C  (0–100, 1 decimal)
  retainageCents: number;             // per-line retainage on work in place
  balanceToFinishCents: number;       // C − G
}

export interface PayAppInput {
  contractSumCents: number;           // original contract sum
  changeOrdersCents: number;          // net change by approved COs
  retainagePct: number;               // e.g. 10 → 10%
  storedRetainagePct?: number;        // optional separate % on stored materials (defaults to retainagePct)
  previousCertificatesCents: number;  // sum of prior "current payment due" (G702 line 7)
  lines: SovLine[];
}

/** Computed G702 summary — the certificate for payment. */
export interface PayAppResult {
  rows: G703Row[];
  originalContractCents: number;      // line 1
  changeOrdersCents: number;          // line 2
  contractSumToDateCents: number;     // line 3 = 1 + 2
  totalCompletedStoredCents: number;  // line 4 = ΣG
  retainageCents: number;             // line 5 (completed + stored retainage)
  totalEarnedLessRetainageCents: number; // line 6 = 4 − 5
  previousCertificatesCents: number;  // line 7
  currentPaymentDueCents: number;     // line 8 = 6 − 7
  balanceToFinishCents: number;       // line 9 = 3 − 6
  percentComplete: number;            // 4 / 3 (0–100)
}
