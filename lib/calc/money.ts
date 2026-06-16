/**
 * Money — exact currency math in INTEGER CENTS. Never use floats for money.
 * One rounding rule everywhere: round half away from zero, to the cent.
 * This is the single source of truth for all currency arithmetic, web + native.
 */
export type Cents = number; // always an integer

function assertInt(c: number): number {
  if (!Number.isInteger(c)) throw new Error(`Money must be integer cents, got ${c}`);
  return c;
}

/** Round to nearest integer, half away from zero, with float-dust guard. */
export function roundHalfUp(n: number): number {
  if (!Number.isFinite(n)) throw new Error('roundHalfUp: non-finite input');
  return Math.sign(n) * Math.round(Math.abs(n) + 1e-9);
}

/** Parse a dollar amount (number or "$1,234.56") into integer cents. */
export function toCents(dollars: number | string): Cents {
  const n = typeof dollars === 'string' ? Number(dollars.replace(/[$,\s]/g, '')) : dollars;
  if (!Number.isFinite(n)) throw new Error(`toCents: invalid amount "${dollars}"`);
  return roundHalfUp(n * 100);
}

export const toDollars = (c: Cents): number => assertInt(c) / 100;

export function formatUSD(c: Cents): string {
  return (assertInt(c) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export const sumCents = (xs: Cents[]): Cents => xs.reduce((a, b) => a + assertInt(b), 0);
export const addCents = (...xs: Cents[]): Cents => sumCents(xs);
export const subCents = (a: Cents, b: Cents): Cents => assertInt(a) - assertInt(b);

/** percent (e.g. 10 → 10%) of an amount, rounded to the cent. */
export const percentOf = (c: Cents, percent: number): Cents => roundHalfUp((assertInt(c) * percent) / 100);

/** multiply an amount by a factor/quantity, rounded to the cent. */
export const scaleCents = (c: Cents, factor: number): Cents => roundHalfUp(assertInt(c) * factor);

/** line item: quantity × unit price (cents) → extended cost (cents). */
export const extend = (quantity: number, unitPriceCents: Cents): Cents => roundHalfUp(quantity * assertInt(unitPriceCents));
