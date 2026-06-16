/**
 * Takeoff normalization — the deterministic guardrail around AI-extracted line
 * items. Source of truth for each line is qty × unit cost; the AI's own total is
 * accepted only when within 10% of that, else recomputed. Invalid lines dropped.
 * Project total derived from validated lines — never trusted from the model.
 */
import { Cents, extend, sumCents, scaleCents } from './money';

export interface RawTakeoffItem {
  description: string;
  quantity: number;
  unit: string;
  unitCostCents: Cents;
  totalCents?: Cents;
  laborHours?: number;
}

export interface TakeoffItem {
  description: string;
  quantity: number;
  unit: string;
  unitCostCents: Cents;
  totalCents: Cents;
  laborHours: number;
}

export interface TakeoffTotals {
  items: TakeoffItem[];
  materialCents: Cents;
  laborCents: Cents;
  contingencyPercent: number;
  projectTotalCents: Cents;
}

const DEFAULT_LABOR_RATE_CENTS = 6500; // $65/hr blended

export function normalizeTakeoff(
  raw: RawTakeoffItem[],
  opts: { laborRateCents?: Cents; contingencyPercent?: number } = {},
): TakeoffTotals {
  const laborRate = opts.laborRateCents ?? DEFAULT_LABOR_RATE_CENTS;
  const contingencyPercent = Math.max(0, Math.min(50, opts.contingencyPercent ?? 10));

  const items: TakeoffItem[] = raw
    .map((r) => {
      const quantity = Math.max(0, Number(r.quantity) || 0);
      const unitCostCents = Math.max(0, Number(r.unitCostCents) || 0);
      const computed = extend(quantity, unitCostCents);
      const provided = Number(r.totalCents) || 0;
      const totalCents = provided > 0 && computed > 0 && Math.abs(provided - computed) / computed < 0.10 ? provided : computed;
      return {
        description: String(r.description || '').trim(),
        quantity,
        unit: String(r.unit || 'LS').toUpperCase(),
        unitCostCents,
        totalCents,
        laborHours: Math.max(0, Number(r.laborHours) || 0),
      };
    })
    .filter((it) => it.description.length > 0 && it.quantity > 0 && it.unitCostCents > 0);

  const materialCents = sumCents(items.map((i) => i.totalCents));
  const laborCents = sumCents(items.map((i) => scaleCents(laborRate, i.laborHours)));
  const projectTotalCents = scaleCents(materialCents + laborCents, 1 + contingencyPercent / 100);

  return { items, materialCents, laborCents, contingencyPercent, projectTotalCents };
}
