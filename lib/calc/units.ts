/**
 * Unit-aware quantities — prevents adding SF to LF or mis-converting CY↔CF.
 * Conversions only succeed within the same physical dimension.
 */
export type Unit = 'SF' | 'SY' | 'LF' | 'CF' | 'CY' | 'GAL' | 'EA' | 'LB' | 'TON' | 'HR' | 'LS';

interface UnitDef { dim: string; toBase: number; }

const UNITS: Record<Unit, UnitDef> = {
  SF:  { dim: 'area',    toBase: 1 },
  SY:  { dim: 'area',    toBase: 9 },          // 1 SY = 9 SF
  LF:  { dim: 'length',  toBase: 1 },
  CF:  { dim: 'volume',  toBase: 1 },
  CY:  { dim: 'volume',  toBase: 27 },         // 1 CY = 27 CF
  GAL: { dim: 'volume',  toBase: 0.133680556 },// 1 gal = 0.1337 CF
  LB:  { dim: 'mass',    toBase: 1 },
  TON: { dim: 'mass',    toBase: 2000 },       // 1 ton = 2000 LB
  EA:  { dim: 'count',   toBase: 1 },
  HR:  { dim: 'time',    toBase: 1 },
  LS:  { dim: 'lumpsum', toBase: 1 },
};

export function isConvertible(from: Unit, to: Unit): boolean {
  return !!UNITS[from] && !!UNITS[to] && UNITS[from].dim === UNITS[to].dim;
}

export function convert(value: number, from: Unit, to: Unit): number {
  const f = UNITS[from], t = UNITS[to];
  if (!f || !t) throw new Error(`Unknown unit: ${from}/${to}`);
  if (f.dim !== t.dim) throw new Error(`Incompatible units: ${from} (${f.dim}) → ${to} (${t.dim})`);
  return (value * f.toBase) / t.toBase;
}
