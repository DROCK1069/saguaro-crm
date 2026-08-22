'use client';
/**
 * GettingStartedRail — the GC Guided Journey.
 *
 * A new GC signs in and follows Step 1 -> completion without training. Eight
 * steps, each auto-checked from LIVE data (/api/projects/list + the
 * /api/project-context snapshot) and deep-linked into the module that
 * completes it. Renders inside a SectionCard as a numbered gold pipeline
 * (FlowSteps anatomy — inlined here so every step row can be a <Link>, which
 * FlowSteps' string-only props can't host). Collapsible, persisted in
 * localStorage ('sag_journey_collapsed'); hides entirely once all 8 are done.
 */
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Compass, CaretDown, CaretUp, Check, ArrowRight } from '@phosphor-icons/react';
import { SectionCard, goldButtonStyle } from '@/components/ui/premium';
import { useProjects } from '@/lib/hooks/useProjects';
import { useProjectContext } from '@/lib/hooks/useProjectContext';

const GOLD = '#F59E0B';
const GOLD_HI = '#FBBF24';
const TEXT = '#FFFFFF';
const MUTED = 'rgba(255,255,255,0.62)';
const FAINT = 'rgba(255,255,255,0.42)';
const LS_KEY = 'sag_journey_collapsed';

interface JourneyStep { title: string; desc: string; done: boolean; href?: string }

export default function GettingStartedRail({ projectId }: { projectId?: string }) {
  const [hydrated, setHydrated] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Live data from the shared SWR caches (W-2/W-4): the dashboard and the
  // projects page fill the same keys, so the rail costs zero extra requests.
  const { projects, loading: listLoading, error: listError, degraded } = useProjects();
  // On the dashboard (no projectId prop) the journey tracks the most recent
  // project — the list is already created_at desc.
  const activeId = projectId || projects[0]?.id;
  const { ctx, loading: ctxLoading } = useProjectContext(activeId || null);
  // Never flash a wrong journey: wait for the list (and for the snapshot when
  // a project exists); a degraded list route never shows a false "0/8".
  const loaded = !listLoading && !listError && !degraded && (!activeId || !!ctx || !ctxLoading);

  // Read the persisted collapse state after mount (SSR-safe).
  useEffect(() => {
    try { setCollapsed(localStorage.getItem(LS_KEY) === '1'); } catch { /* private mode */ }
    setHydrated(true);
  }, []);

  const money = ctx?.money;
  const pLink = (suffix: string) => (activeId ? `/app/projects/${activeId}/${suffix}` : undefined);

  // MONEY rule: DB numerics can round-trip as strings — Number(x)||0 before math.
  const steps: JourneyStep[] = [
    { title: 'Create your project', desc: 'Name, address, owner — everything else builds on this.',
      done: projects.length > 0, href: '/app/projects/new' },
    { title: 'Set contract & budget', desc: 'Enter the contract sum and budget lines — every module reads from them.',
      done: (Number(money?.originalContract) || 0) > 0 || (ctx?.budget?.lineCount || 0) > 0, href: pLink('budget') },
    { title: 'Send bid packages', desc: 'Scoped packages go out to your sub network for pricing.',
      done: (ctx?.bidPackages || []).length > 0, href: pLink('bid-packages') },
    { title: 'Award & onboard subs', desc: 'Award the winners — contracts, insurance, and W-9s collect automatically.',
      done: (ctx?.subs || []).length > 0, href: pLink('subs') },
    { title: 'Build the schedule', desc: 'Sequence the work — the critical path drives field priorities.',
      done: (ctx?.counts?.scheduleTasks || 0) > 0, href: pLink('schedule') },
    { title: 'Run the field', desc: 'Daily logs capture crews, weather, and progress from the job site.',
      done: ctx?.recent?.lastDailyLogDate != null, href: pLink('daily-logs') },
    { title: 'Bill the owner', desc: 'The G702/G703 pay application builds itself from live project data.',
      done: (money?.payAppCount || 0) > 0, href: pLink('pay-apps/new') },
    { title: 'Get paid', desc: 'Lien waivers auto-generate and gate payment until signed.',
      done: (Number(money?.paidToDate) || 0) > 0, href: pLink('pay-apps') },
  ];
  const doneCount = steps.filter(s => s.done).length;
  const next = steps.find(s => !s.done);

  if (!loaded || !hydrated) return null; // never flash a wrong journey
  if (doneCount === 8) return null;     // journey complete — get out of the way

  function toggle() {
    setCollapsed(c => {
      const n = !c;
      try { localStorage.setItem(LS_KEY, n ? '1' : '0'); } catch { /* private mode */ }
      return n;
    });
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <SectionCard
        title="Your path to first payment"
        subtitle={next ? `Next up: ${next.title}` : undefined}
        icon={<Compass size={17} weight="duotone" color={GOLD} />}
        flush={collapsed}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              padding: '3px 10px', borderRadius: 999, background: 'rgba(245,158,11,0.14)',
              border: '1px solid rgba(245,158,11,0.4)', color: GOLD_HI,
              fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', whiteSpace: 'nowrap',
            }}>{doneCount}/8 complete</span>
            <button
              onClick={toggle}
              aria-label={collapsed ? 'Expand getting started' : 'Collapse getting started'}
              className="pmBtn"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, borderRadius: 8, cursor: 'pointer',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {collapsed ? <CaretDown size={13} weight="bold" color={MUTED} /> : <CaretUp size={13} weight="bold" color={MUTED} />}
            </button>
          </div>
        }
      >
        {collapsed ? null : (
          <>
            {/* Progress */}
            <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', marginBottom: 18 }}>
              <div style={{ height: '100%', width: `${(doneCount / 8) * 100}%`, background: `linear-gradient(90deg,${GOLD},${GOLD_HI})`, borderRadius: 999, transition: 'width .4s ease' }} />
            </div>

            {/* The pipeline — FlowSteps anatomy, every row deep-linked */}
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 10, top: 10, bottom: 16, width: 1, background: 'linear-gradient(180deg, rgba(245,158,11,0.45), rgba(255,255,255,0.08))' }} />
              {steps.map((s, i) => {
                const row = (
                  <div
                    style={{
                      display: 'flex', gap: 12, alignItems: 'flex-start', position: 'relative',
                      padding: '7px 8px', margin: '0 -8px', borderRadius: 10,
                      transition: 'background .15s ease',
                    }}
                    onMouseEnter={e => { if (s.href) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{
                      width: 21, height: 21, borderRadius: 999, flexShrink: 0, zIndex: 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: s.done ? `linear-gradient(180deg,${GOLD_HI},${GOLD})` : '#101011',
                      border: s.done ? 'none' : '1px solid rgba(245,158,11,0.45)',
                      color: s.done ? '#241500' : GOLD_HI, fontSize: 10, fontWeight: 900,
                    }}>
                      {s.done ? <Check size={12} weight="bold" color="#241500" /> : i + 1}
                    </div>
                    <div style={{ minWidth: 0, paddingTop: 1, flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: s.done ? MUTED : TEXT, lineHeight: 1.35 }}>{s.title}</div>
                      <div style={{ fontSize: 11.5, color: s.done ? FAINT : MUTED, lineHeight: 1.5, marginTop: 2 }}>{s.desc}</div>
                    </div>
                    {!s.done && s.href && (
                      <ArrowRight size={13} weight="bold" color={FAINT} style={{ flexShrink: 0, marginTop: 4 }} />
                    )}
                  </div>
                );
                return s.href
                  ? <Link key={i} href={s.href} style={{ textDecoration: 'none', display: 'block' }}>{row}</Link>
                  : <div key={i}>{row}</div>;
              })}
            </div>

            {/* Gold CTA on the next incomplete step */}
            {next?.href && (
              <Link href={next.href} style={{ ...goldButtonStyle, marginTop: 18 }} className="pmBtn">
                Next: {next.title} <ArrowRight size={15} weight="bold" color="#241500" />
              </Link>
            )}
          </>
        )}
      </SectionCard>
    </div>
  );
}
