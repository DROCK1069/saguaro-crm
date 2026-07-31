/**
 * Priced revision compare → change-order draft. Given the OLD and NEW takeoff conditions,
 * match them, price each side through the same deterministic engine, and produce a per-line
 * priced delta (added / removed / changed) + a net change total. This is the connected loop
 * competitors don't close: a scope revision becomes an auditable, priced change order.
 */
import type { Condition, ComputeOpts } from './types';
import { computeTakeoff } from './engine';

export interface RevisionLine {
  key: string;
  name: string;
  assemblyId: string;
  oldValue: number;
  newValue: number;
  oldSellCents: number;
  newSellCents: number;
  deltaCents: number;
  status: 'added' | 'removed' | 'changed' | 'unchanged';
}
export interface RevisionDiff {
  lines: RevisionLine[];
  addedCents: number;
  removedCents: number;   // negative (credits)
  changedCents: number;
  netDeltaCents: number;
  oldSellCents: number;
  newSellCents: number;
}

/** Stable match key: explicit id, else assembly + normalized name. */
const keyOf = (c: Condition) => (c.id && String(c.id)) || `${c.assemblyId}|${String(c.name || '').trim().toLowerCase()}`;

/** Sell price of a single condition through the full engine (markups included). */
function sellOf(c: Condition, opts: ComputeOpts): number {
  try { return computeTakeoff([c], opts).sellCents; } catch { return 0; }
}

export function diffTakeoffs(oldC: Condition[], newC: Condition[], opts: ComputeOpts = {}): RevisionDiff {
  const oldMap = new Map<string, Condition>();
  const newMap = new Map<string, Condition>();
  for (const c of oldC) oldMap.set(keyOf(c), c);
  for (const c of newC) newMap.set(keyOf(c), c);

  const lines: RevisionLine[] = [];
  let addedCents = 0, removedCents = 0, changedCents = 0;
  const keys = new Set<string>([...oldMap.keys(), ...newMap.keys()]);

  for (const k of keys) {
    const o = oldMap.get(k), n = newMap.get(k);
    const oldSell = o ? sellOf(o, opts) : 0;
    const newSell = n ? sellOf(n, opts) : 0;
    const delta = newSell - oldSell;
    let status: RevisionLine['status'];
    if (o && !n) { status = 'removed'; removedCents += delta; }
    else if (!o && n) { status = 'added'; addedCents += delta; }
    else if (o && n && (o.value !== n.value || delta !== 0)) { status = 'changed'; changedCents += delta; }
    else status = 'unchanged';

    lines.push({
      key: k,
      name: (n || o)!.name,
      assemblyId: (n || o)!.assemblyId,
      oldValue: o?.value ?? 0,
      newValue: n?.value ?? 0,
      oldSellCents: oldSell,
      newSellCents: newSell,
      deltaCents: delta,
      status,
    });
  }

  // changed & most-impactful first, then added, removed, unchanged
  const rank = { changed: 0, added: 1, removed: 2, unchanged: 3 } as const;
  lines.sort((a, b) => rank[a.status] - rank[b.status] || Math.abs(b.deltaCents) - Math.abs(a.deltaCents));

  const oldSellCents = computeTakeoffSafe(oldC, opts);
  const newSellCents = computeTakeoffSafe(newC, opts);
  return {
    lines,
    addedCents,
    removedCents,
    changedCents,
    netDeltaCents: newSellCents - oldSellCents,
    oldSellCents,
    newSellCents,
  };
}

function computeTakeoffSafe(c: Condition[], opts: ComputeOpts): number {
  try { return c.length ? computeTakeoff(c, opts).sellCents : 0; } catch { return 0; }
}
