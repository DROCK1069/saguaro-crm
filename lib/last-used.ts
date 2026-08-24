'use client';
/**
 * Per-user last-used field memory — the tiny habit layer under repeat entry.
 *
 * A GC who issues POs to the same vendor, runs the same superintendent, or
 * codes to the same budget line should never retype it. Each create flow
 * writes what the user actually saved under a scope key; the next open of
 * that flow prefills from it with a visible AUTO chip (SmartCreate pattern —
 * `AutoChip` in components/ui/premium.tsx), never silently.
 *
 * Storage is localStorage (per browser, per user session context) so the
 * memory costs nothing server-side and can never leak across devices/users
 * sharing a tenant. Every call is failure-proof: storage being full, blocked
 * (Safari private mode), or absent (SSR) degrades to "no memory", never an
 * error in the flow itself.
 */

const PREFIX = 'sag_last_used:';

/** Read the last-used record for a scope (e.g. `po:<projectId>`, `daily-log`).
 *  Returns null when nothing has been remembered yet or storage is blocked. */
export function getLastUsed<T extends Record<string, unknown>>(scopeKey: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + scopeKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as T) : null;
  } catch {
    return null;
  }
}

/** Remember what the user just saved. Empty values are dropped so a blank
 *  field never erases a remembered one — memory only ever gets richer. */
export function setLastUsed(scopeKey: string, value: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  try {
    const prev = getLastUsed<Record<string, unknown>>(scopeKey) ?? {};
    const compact = Object.fromEntries(
      Object.entries(value).filter(([, v]) => v !== undefined && v !== null && v !== '')
    );
    window.localStorage.setItem(PREFIX + scopeKey, JSON.stringify({ ...prev, ...compact }));
  } catch {
    /* storage unavailable — the prefill is a nicety, never a failure */
  }
}

/** Forget a scope entirely (e.g. after the user clears a prefill). */
export function clearLastUsed(scopeKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PREFIX + scopeKey);
  } catch { /* ignore */ }
}

/**
 * Fire-and-forget receipt for an ACCEPTED prefill/duplicate — posts to
 * /api/learning/event which whitelists the client-reportable kinds and
 * records via the standard recordLearning path. Never awaited, never throws:
 * the receipt must not slow or break the work it documents.
 */
export function postLearningEvent(
  kind: 'last_used_prefill' | 'po_duplicated' | 'bid_package_duplicated' | 'daily_log_carry_forward',
  opts: { projectId?: string | null; meta?: Record<string, unknown> } = {}
): void {
  if (typeof window === 'undefined') return;
  try {
    void fetch('/api/learning/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, projectId: opts.projectId ?? null, meta: opts.meta ?? {} }),
      keepalive: true,
    }).catch(() => {});
  } catch { /* ignore */ }
}
