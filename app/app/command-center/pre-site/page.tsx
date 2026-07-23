'use client';
import { useMemo, useState } from 'react';
import { useProjects } from '@/lib/hooks/useProjects';
import { usePreSite, setPreSite } from '@/lib/hooks/useFranchise';
import { PRESITE_CHECKLIST } from '@/lib/franchise-template';
import { C, font, useFranchiseGate, GateLoading, PageHeader, Tile, EmptyState } from '@/components/franchise/kit';

type PState = 'open' | 'passed' | 'flagged';

export default function PreSitePage() {
  const { ready, loading: gateLoading } = useFranchiseGate();
  const { items, loading } = usePreSite();
  const { projects } = useProjects();
  const [site, setSite] = useState('');
  const [override, setOverride] = useState<Record<string, PState>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const activeSite = site || (projects as any[])[0]?.id || '';
  const stateOf = (it: any): PState => (override[it.id] as PState) || (it.state as PState) || 'open';

  const view = useMemo(() => {
    const mine = (items as any[]).filter((i) => i.project_id === activeSite);
    mine.sort((a, b) => String(a.linked_id || '').localeCompare(String(b.linked_id || ''), undefined, { numeric: true }));
    const passed = mine.filter((i) => stateOf(i) === 'passed').length;
    const flagged = mine.filter((i) => stateOf(i) === 'flagged').length;
    const reviewed = passed + flagged;
    return { list: mine, passed, flagged, reviewed, pct: mine.length ? Math.round((reviewed / mine.length) * 100) : 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, activeSite, override]);

  async function mark(it: any, next: PState) {
    const cur = stateOf(it);
    const target = cur === next ? 'open' : next; // tapping the active state clears it
    setOverride((o) => ({ ...o, [it.id]: target }));
    setBusy((b) => ({ ...b, [it.id]: true }));
    try { await setPreSite(it.id, target); }
    catch { setOverride((o) => { const n = { ...o }; delete n[it.id]; return n; }); }
    finally { setBusy((b) => ({ ...b, [it.id]: false })); }
  }

  if (gateLoading) return <GateLoading />;
  if (!ready) return null;

  const pill = (active: boolean, color: string): React.CSSProperties => ({
    padding: '5px 11px', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer',
    border: `1px solid ${active ? color : C.border}`, background: active ? color : '#16243A', color: active ? '#fff' : C.dim,
  });

  return (
    <div style={{ padding: '28px 24px 60px', maxWidth: 960, margin: '0 auto', fontFamily: font, color: C.text }}>
      <PageHeader title="Pre-Site Inspection" subtitle="Feasibility due-diligence run before lease + build — confirm a prospective location can actually take the indoor-golf TI. Flag anything that could kill or re-price the deal."
        right={
          <select value={activeSite} onChange={(e) => setSite(e.target.value)} style={{ padding: '9px 12px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, background: '#16243A', fontWeight: 600 }}>
            {(projects as any[]).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        } />

      {loading ? <div style={{ color: C.dim, padding: 40, textAlign: 'center' }}>Loading…</div>
      : view.list.length === 0 ? (
        <EmptyState icon="📋" title="No pre-site checklist for this site" body={`Sites launched from the template come pre-loaded with the ${PRESITE_CHECKLIST.length}-point pre-site feasibility inspection.`} />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
            <Tile label="Reviewed" value={`${view.reviewed}/${view.list.length}`} color={view.pct >= 100 ? C.green : C.gold} />
            <Tile label="Passed" value={view.passed} color={C.green} />
            <Tile label="Flagged" value={view.flagged} color={view.flagged ? C.red : C.dim} sub={view.flagged ? 'needs resolution' : 'clear'} />
            <Tile label="Complete" value={`${view.pct}%`} color={view.pct >= 100 ? C.green : C.gold} />
          </div>
          {view.flagged > 0 && (
            <div style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.25)', borderRadius: 12, padding: '11px 14px', marginBottom: 14, fontSize: 13, color: C.text }}>
              🚩 <b>{view.flagged}</b> item(s) flagged — resolve or price these before signing the lease.
            </div>
          )}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '6px 14px' }}>
            {view.list.map((it) => {
              const st = stateOf(it);
              const bar = st === 'passed' ? C.green : st === 'flagged' ? C.red : C.border;
              return (
                <div key={it.id} style={{ display: 'flex', gap: 12, alignItems: 'center', borderBottom: `1px solid ${C.border}`, borderLeft: `3px solid ${bar}`, paddingLeft: 10, padding: '11px 4px 11px 10px' }}>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: st === 'passed' ? C.faint : C.text, textDecoration: st === 'passed' ? 'line-through' : 'none' }}>{it.title}</span>
                  <button onClick={() => mark(it, 'passed')} disabled={busy[it.id]} style={pill(st === 'passed', C.green)}>✓ Pass</button>
                  <button onClick={() => mark(it, 'flagged')} disabled={busy[it.id]} style={pill(st === 'flagged', C.red)}>🚩 Flag</button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
