/**
 * Progress-billing pay-application calculator (AIA G702/G703-style math).
 * Standard construction-accounting identities, computed deterministically in
 * integer cents and cross-footed so a document can only be issued if it reconciles.
 */
import { Cents, addCents, subCents, sumCents, percentOf } from './money';

export interface SovLine {
  id: string;
  description: string;
  scheduledValue: Cents;   // contracted value of this line
  fromPrevious: Cents;     // work completed in prior periods
  thisPeriod: Cents;       // work completed this period
  storedMaterials: Cents;  // materials presently stored (not yet in completed)
}

export interface PayAppInput {
  lines: SovLine[];
  retainagePercent: number;             // e.g. 10
  previousPaymentsLessRetainage: Cents; // prior periods' "earned less retainage"
}

export interface PayAppLineResult {
  id: string;
  completedAndStored: Cents; // prior + thisPeriod + stored
  percentComplete: number;
  retainage: Cents;
  balanceToFinish: Cents;
}

export interface PayAppResult {
  lines: PayAppLineResult[];
  scheduledTotal: Cents;
  completedAndStoredTotal: Cents;
  percentComplete: number;
  retainageTotal: Cents;
  totalEarnedLessRetainage: Cents;
  currentPaymentDue: Cents;
  balanceToFinishIncludingRetainage: Cents;
  reconciles: boolean;
  errors: string[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computePayApp(input: PayAppInput): PayAppResult {
  const errors: string[] = [];
  if (input.retainagePercent < 0 || input.retainagePercent > 100) {
    errors.push(`retainagePercent out of range: ${input.retainagePercent}`);
  }

  const lines: PayAppLineResult[] = input.lines.map((l) => {
    const completedAndStored = addCents(l.fromPrevious, l.thisPeriod, l.storedMaterials);
    if (l.scheduledValue < 0 || l.fromPrevious < 0 || l.thisPeriod < 0 || l.storedMaterials < 0) {
      errors.push(`Line "${l.description}": negative amount`);
    }
    if (completedAndStored > l.scheduledValue) {
      errors.push(`Line "${l.description}": completed+stored exceeds scheduled value (over-billing)`);
    }
    return {
      id: l.id,
      completedAndStored,
      percentComplete: l.scheduledValue ? round2((completedAndStored / l.scheduledValue) * 100) : 0,
      retainage: percentOf(completedAndStored, input.retainagePercent),
      balanceToFinish: subCents(l.scheduledValue, completedAndStored),
    };
  });

  const scheduledTotal = sumCents(input.lines.map((l) => l.scheduledValue));
  const completedAndStoredTotal = sumCents(lines.map((l) => l.completedAndStored));
  const retainageTotal = sumCents(lines.map((l) => l.retainage));
  const totalEarnedLessRetainage = subCents(completedAndStoredTotal, retainageTotal);
  const currentPaymentDue = subCents(totalEarnedLessRetainage, input.previousPaymentsLessRetainage);
  const balanceToFinishIncludingRetainage = subCents(scheduledTotal, totalEarnedLessRetainage);
  const percentComplete = scheduledTotal ? round2((completedAndStoredTotal / scheduledTotal) * 100) : 0;

  // ── Cross-foot invariants — must reconcile exactly or the doc is rejected ──
  if (addCents(totalEarnedLessRetainage, retainageTotal) !== completedAndStoredTotal) {
    errors.push('Cross-foot: earned-less-retainage + retainage ≠ completed+stored');
  }
  if (addCents(totalEarnedLessRetainage, balanceToFinishIncludingRetainage) !== scheduledTotal) {
    errors.push('Cross-foot: earned-less-retainage + balance-to-finish ≠ scheduled total');
  }
  if (currentPaymentDue < 0) {
    errors.push('Current payment due is negative — prior payments exceed earned-to-date');
  }

  return {
    lines, scheduledTotal, completedAndStoredTotal, percentComplete,
    retainageTotal, totalEarnedLessRetainage, currentPaymentDue,
    balanceToFinishIncludingRetainage,
    reconciles: errors.length === 0,
    errors,
  };
}
