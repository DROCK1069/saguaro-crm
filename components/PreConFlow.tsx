'use client';
/**
 * PreConFlow — the pre-construction setup path band.
 *
 * Web port of the mobile overview's "Contract to Cash" segmented milestone
 * band: one machined horizontal strip that walks a GC through project setup
 * IN ORDER (bid jacket -> takeoff -> heatmap -> budget -> bid packages ...),
 * every step auto-checked from REAL rows by GET /api/projects/:id/setup-path
 * — never checkbox theater. Done segments fill gold, the current segment
 * glows, todo segments stay ghosted; each segment deep-links to the screen
 * that completes it. When the server offers a handoff action ("Package the
 * Signal Studio bid", "Seed budget from takeoff") the current step carries a
 * one-click GoldButton that POSTs the endpoint with the given body, toasts
 * the honest result, and refetches — real data moving through the existing
 * engines on one click.
 *
 * FREE MOVEMENT (owner rule): the band opens focused on the current step, but
 * NO step is ever locked. Every segment — done, current, or future — is a
 * button that selects it; the panel underneath becomes that step's surface.
 * A done step opens in a review state (the server's detail line is literally
 * what was entered) with an Edit button; the current step keeps its one-click
 * handoff; a future step opens normally. "Back to current step" returns focus.
 * Identical model to the mobile Contract-to-Cash band on the Overview tab.
 *
 * Collapses to a slim "Setup 4/6 · next: …" bar once pctComplete >= 100, or
 * when the user dismisses it (remembered per project in localStorage).
 * Renders nothing at all if the route is missing, errors, or returns no
 * steps — zero dead space, and tolerant of a sibling API that isn't live yet.
 */
import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { ListChecks, CaretDown, CaretUp, Check, ArrowRight } from '@phosphor-icons/react';
import { GoldButton, PremiumFX } from '@/components/ui/premium';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/Toast';
import { getAuthHeaders } from '@/lib/supabase-browser';
import { humanError } from '@/lib/errors';

const GOLD = '#F59E0B';
const GOLD_HI = '#FBBF24';
const GREEN = '#22C55E';
const TEXT = '#FFFFFF';
const MUTED = 'rgba(255,255,255,0.62)';
const FAINT = 'rgba(255,255,255,0.42)';
const BORDER = 'rgba(255,255,255,0.08)';
const SURFACE = 'linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))';
const INK = '#241500';
const LS_PREFIX = 'sag_precon_dismissed_';

interface SetupAction { handoff?: string; endpoint?: string; body?: Record<string, unknown> }
interface SetupStep { key?: string; title?: string; done?: boolean; detail?: string; href?: string; action?: SetupAction }

// Tolerant fetcher: the setup-path route may not be deployed yet, may 404, or
// may omit keys — every one of those means "no band", never an error block.
const fetcher = async (url: string) => {
  const auth = await getAuthHeaders();
  const r = await fetch(url, { headers: auth });
  if (!r.ok) return null;
  let d: any = null;
  try { d = await r.json(); } catch { return null; }
  if (!d || !Array.isArray(d.steps)) return null;
  return d;
};

const pillStyle: React.CSSProperties = {
  padding: '2px 9px', borderRadius: 999, background: 'rgba(245,158,11,0.14)',
  border: '1px solid rgba(245,158,11,0.4)', color: GOLD_HI,
  fontSize: 10.5, fontWeight: 800, letterSpacing: '0.04em', whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums',
};

export default function PreConFlow({ projectId }: { projectId?: string }) {
  const { showToast } = useToast();
  const [hydrated, setHydrated] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false); // session-only override for a 100% path
  const [acting, setActing] = useState(false);
  // null === "follow the current step" (preserves auto-open-on-current-step on
  // first entry); a number pins the GC's own choice until they clear it.
  const [sel, setSel] = useState<number | null>(null);

  const { data, isLoading, mutate: refetch } = useSWR<any>(
    projectId ? '/api/projects/' + projectId + '/setup-path' : null,
    fetcher,
    { refreshInterval: 60_000, revalidateOnFocus: false, keepPreviousData: true },
  );

  // Read the per-project dismissal after mount (SSR-safe). Switching projects
  // also drops any pinned step so the new project opens on ITS current step.
  useEffect(() => {
    try { setDismissed(localStorage.getItem(LS_PREFIX + projectId) === '1'); } catch { /* private mode */ }
    setSel(null);
    setHydrated(true);
  }, [projectId]);

  if (!projectId) return null;

  const steps: SetupStep[] = (Array.isArray(data?.steps) ? data.steps : [])
    .filter((s: unknown): s is SetupStep => !!s && typeof s === 'object');

  // Band-shaped skeleton while the first fetch (or hydration) is in flight.
  if ((isLoading && !data) || (!hydrated && steps.length > 0)) return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '14px 16px', marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Skeleton width={130} height={12} />
        <span style={{ flex: 1 }} />
        <Skeleton width={46} height={18} style={{ borderRadius: 999 }} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{ flex: 1, minWidth: 0 }}>
            <Skeleton height={4} style={{ borderRadius: 999, marginBottom: 8 }} />
            <Skeleton height={11} width="70%" style={{ margin: '0 auto' }} />
          </div>
        ))}
      </div>
    </div>
  );

  if (steps.length === 0) return null; // route missing / empty — zero dead space

  // Honest math from the real rows the server checked. DB numerics can
  // round-trip as strings — Number() before any math, always.
  const doneCount = steps.filter(s => !!s.done).length;
  const rawPct = Number(data?.pctComplete);
  const pct = Number.isFinite(rawPct)
    ? Math.max(0, Math.min(100, Math.round(rawPct)))
    : Math.round((doneCount / steps.length) * 100);

  const nextKey = typeof data?.nextKey === 'string' ? data.nextKey : undefined;
  let curIdx = nextKey ? steps.findIndex(s => s.key === nextKey) : -1;
  if (curIdx < 0) curIdx = steps.findIndex(s => !s.done);
  const current = curIdx >= 0 ? steps[curIdx] : null;
  const stepTitle = (s: SetupStep, i: number) => s.title || s.key || 'Step ' + (i + 1);
  const curTitle = current ? stepTitle(current, curIdx) : '';

  // The step the panel is showing. Defaults to the current step (auto-open),
  // but any segment the GC picks wins — backwards to review, or forwards.
  const activeIdx = sel != null && sel >= 0 && sel < steps.length ? sel : curIdx;
  const active = activeIdx >= 0 ? steps[activeIdx] : null;
  const activeTitle = active ? stepTitle(active, activeIdx) : '';
  const offCurrent = activeIdx >= 0 && curIdx >= 0 && activeIdx !== curIdx;
  const action = active?.action;

  const collapse = () => {
    setDismissed(true); setExpanded(false);
    try { localStorage.setItem(LS_PREFIX + projectId, '1'); } catch { /* private mode */ }
  };
  const expand = () => {
    setDismissed(false); setExpanded(true);
    try { localStorage.removeItem(LS_PREFIX + projectId); } catch { /* private mode */ }
  };

  // One click, real data moving: POST the server-declared handoff endpoint,
  // toast the honest outcome, then refetch so done-detection re-runs on rows.
  async function runAction(step: SetupStep) {
    const a = step.action;
    if (!a?.endpoint || acting) return;
    setActing(true);
    try {
      const auth = await getAuthHeaders();
      const res = await fetch(a.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify(a.body ?? {}),
      });
      let json: any = null;
      try { json = await res.json(); } catch { /* empty body is fine */ }
      if (!res.ok || json?.error) throw new Error(json?.error || json?.message || 'Request failed (' + res.status + ')');
      showToast(json?.summary || json?.message || (a.handoff || stepTitle(step, activeIdx)) + ' — done', 'success');
      await refetch();
    } catch (e) {
      showToast(humanError(e, (a.handoff || 'The handoff') + " didn't go through. Try again."), 'error');
    } finally {
      setActing(false);
    }
  }

  const collapsed = dismissed || (pct >= 100 && !expanded);

  // ── Slim bar — the whole path in one line, one click to reopen ────────────
  if (collapsed) return (
    <>
      <PremiumFX />
      <button
        onClick={expand}
        className="pmBtn"
        aria-label={'Expand project setup — ' + doneCount + ' of ' + steps.length + ' steps done'}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 16px', borderRadius: 12, marginBottom: 22, cursor: 'pointer',
          background: SURFACE, border: `1px solid ${BORDER}`, textAlign: 'left',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        <span aria-hidden style={{
          width: 7, height: 7, borderRadius: 999, flexShrink: 0,
          background: pct >= 100 ? GREEN : GOLD,
          boxShadow: pct >= 100 ? '0 0 8px rgba(34,197,94,0.7)' : '0 0 8px rgba(245,158,11,0.7)',
        }} />
        <span style={{ fontSize: 12.5, fontWeight: 800, color: TEXT, whiteSpace: 'nowrap' }}>
          Setup {doneCount}/{steps.length}
        </span>
        <span style={{ fontSize: 12, color: MUTED, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {current ? '· next: ' + curTitle : '· complete'}
        </span>
        <span style={{ flex: 1 }} />
        <span style={pillStyle}>{pct}%</span>
        <CaretDown size={12} weight="bold" color={FAINT} />
      </button>
    </>
  );

  // ── The band — segmented milestone strip + current-step handoff row ───────
  return (
    <>
      <PremiumFX />
      <section
        aria-label={'Project setup — ' + doneCount + ' of ' + steps.length + ' steps done'}
        style={{
          background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16,
          padding: '14px 16px', marginBottom: 22,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        {/* Header — eyebrow + honest count + collapse */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{
            width: 24, height: 24, borderRadius: 8, flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(150deg, rgba(245,158,11,0.16), rgba(245,158,11,0.04))',
            border: '1px solid rgba(245,158,11,0.26)',
          }}><ListChecks size={13} weight="duotone" color={GOLD_HI} /></span>
          <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.09em', color: MUTED, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            Project Setup
          </span>
          <span style={pillStyle}>{doneCount}/{steps.length}</span>
          <span style={{ flex: 1 }} />
          <span style={pillStyle}>{pct}%</span>
          <button
            onClick={collapse}
            aria-label="Collapse project setup"
            className="pmBtn"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 26, height: 26, borderRadius: 8, cursor: 'pointer',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            }}
          ><CaretUp size={12} weight="bold" color={MUTED} /></button>
        </div>

        {/* Segments — EVERY step is a button, none are locked. Done fills gold,
            the current step glows, the selected step carries the bright ring. */}
        <div style={{ display: 'flex', gap: 8 }}>
          {steps.map((s, i) => {
            const title = stepTitle(s, i);
            const isCur = i === curIdx;
            const isSel = i === activeIdx;
            return (
              <button
                key={s.key || i}
                type="button"
                aria-pressed={isSel}
                aria-current={isCur ? 'step' : undefined}
                title={title + (s.done ? ' — done, tap to review' : isCur ? ' — current step' : ' — tap to open')}
                onClick={() => setSel(i)}
                className="pmTile"
                aria-label={title + (s.done ? ' — done, open to review' : isCur ? ' — current step' : ' — upcoming step')}
                style={{
                  flex: 1, minWidth: 0, cursor: 'pointer', textAlign: 'left',
                  background: isSel ? 'rgba(245,158,11,0.07)' : 'transparent',
                  border: isSel ? '1px solid rgba(245,158,11,0.5)' : '1px solid transparent',
                  borderRadius: 10, padding: '4px 4px 5px',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
                  <div style={{
                    height: 4, borderRadius: 999,
                    background: s.done ? `linear-gradient(90deg,${GOLD},${GOLD_HI})` : isCur ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.07)',
                    boxShadow: isCur ? '0 0 10px rgba(245,158,11,0.55)' : s.done ? '0 0 6px rgba(245,158,11,0.25)' : undefined,
                  }} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minWidth: 0 }}>
                    <span aria-hidden style={{
                      width: 17, height: 17, borderRadius: 999, flexShrink: 0,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      background: s.done ? `linear-gradient(180deg,${GOLD_HI},${GOLD})` : isCur ? 'rgba(245,158,11,0.16)' : 'rgba(255,255,255,0.05)',
                      border: s.done ? 'none' : isCur ? '1px solid rgba(245,158,11,0.55)' : `1px solid ${BORDER}`,
                      color: isCur ? GOLD_HI : FAINT, fontSize: 9.5, fontWeight: 900,
                      boxShadow: isCur ? '0 0 12px rgba(245,158,11,0.45)' : undefined,
                    }}>{s.done ? <Check size={10} weight="bold" color={INK} /> : i + 1}</span>
                    {/* A done step must still read as reachable — never fully greyed out. */}
                    <span style={{
                      fontSize: 11, fontWeight: isCur || isSel ? 800 : 700,
                      color: isSel ? GOLD_HI : isCur ? TEXT : s.done ? MUTED : FAINT,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
                    }}>{title}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Plain-language proof the rail is not one-way. */}
        <div style={{ fontSize: 10.5, color: FAINT, marginTop: 8, letterSpacing: '0.01em' }}>
          Tap any step — go back to review what you entered, or jump ahead. Nothing here is locked.
        </div>

        {/* The selected step — review / next / upcoming, with its own action */}
        {active && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            marginTop: 12, padding: '11px 14px', borderRadius: 12,
            background: 'linear-gradient(150deg, rgba(245,158,11,0.10), rgba(245,158,11,0.03))',
            border: '1px solid rgba(245,158,11,0.28)',
          }}>
            <span aria-hidden style={{
              width: 26, height: 26, borderRadius: 999, flexShrink: 0,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: active.done
                ? `linear-gradient(180deg,${GOLD_HI},${GOLD})`
                : 'linear-gradient(150deg, rgba(245,158,11,0.22), rgba(245,158,11,0.06))',
              border: active.done ? 'none' : '1px solid rgba(245,158,11,0.45)',
              color: active.done ? INK : GOLD_HI, fontSize: 12, fontWeight: 900,
            }}>{active.done ? <Check size={13} weight="bold" color={INK} /> : activeIdx + 1}</span>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 9.5, fontWeight: 900, letterSpacing: '0.1em', color: FAINT, textTransform: 'uppercase', marginBottom: 2 }}>
                {active.done ? `Step ${activeIdx + 1} · completed — review` : activeIdx === curIdx ? 'Next step' : `Step ${activeIdx + 1} · upcoming`}
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: TEXT, lineHeight: 1.3 }}>{activeTitle}</div>
              {active.detail && <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5, marginTop: 2 }}>{active.detail}</div>}
              {offCurrent && (
                <button
                  type="button"
                  onClick={() => setSel(null)}
                  className="pmBtn"
                  style={{
                    marginTop: 6, padding: 0, background: 'none', border: 'none', cursor: 'pointer',
                    color: GOLD_HI, fontSize: 11.5, fontWeight: 800, textAlign: 'left',
                  }}
                >← Back to current step ({curTitle})</button>
              )}
            </div>
            {action?.endpoint ? (
              <GoldButton size="md" disabled={acting} onClick={() => { void runAction(active); }} icon={acting ? undefined : <ArrowRight size={14} weight="bold" color={INK} />}>
                {acting ? 'Working…' : action.handoff || 'Run handoff'}
              </GoldButton>
            ) : active.href ? (
              <Link href={active.href} className="pmBtn" style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '8px 15px', borderRadius: 10, textDecoration: 'none',
                background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.45)',
                color: GOLD_HI, fontSize: 12.5, fontWeight: 800, whiteSpace: 'nowrap',
              }}>{active.done ? 'Edit' : 'Open'} {activeTitle} <ArrowRight size={13} weight="bold" color={GOLD_HI} /></Link>
            ) : null}
          </div>
        )}
      </section>
    </>
  );
}
