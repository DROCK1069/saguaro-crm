/**
 * Change-order rollup → revised contract. Only APPROVED change orders move the
 * contract; pending are tracked separately; rejected are excluded entirely.
 */
import { Cents, sumCents, addCents } from './money';

export type ChangeOrderStatus = 'pending' | 'approved' | 'rejected';

export interface ChangeOrder {
  id: string;
  description: string;
  amount: Cents; // may be negative (deduct)
  status: ChangeOrderStatus;
}

export interface ContractSummary {
  originalContract: Cents;
  approvedChangeOrders: Cents;
  pendingChangeOrders: Cents;
  revisedContract: Cents; // original + approved only
}

export function summarizeContract(originalContract: Cents, changeOrders: ChangeOrder[]): ContractSummary {
  const approvedChangeOrders = sumCents(changeOrders.filter((c) => c.status === 'approved').map((c) => c.amount));
  const pendingChangeOrders = sumCents(changeOrders.filter((c) => c.status === 'pending').map((c) => c.amount));
  return {
    originalContract,
    approvedChangeOrders,
    pendingChangeOrders,
    revisedContract: addCents(originalContract, approvedChangeOrders),
  };
}
