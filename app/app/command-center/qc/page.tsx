'use client';
import { useMemo, useState } from 'react';
import { useProjects } from '@/lib/hooks/useProjects';
import { useQC, toggleQC } from '@/lib/hooks/useFranchise';
import { QC_TRADES } from '@/lib/franchise-template';
import { C, font, useFranchiseGate, GateLoading, PageHeader, Tile, EmptyState } from '@/components/franchise/kit';

export default function QCPage() {
  const { ready, loading: gateLoading } = useFranchiseGate();
  const { items, loading } = useQC();
  const { projects } = useProjects();
  const [site, setSite] = useState('');
  const [done, setDone] = useState<Record<string, boolean>>({});

  const activeSite = site || (projects as any[])[0]?.id || '';
  const isDone = (it: any) => (it.id in done ? done[it.id] : it.is_done);

  const trades = useMemo(() => {
    const mine = (items as any[]).filter((i) => i.project_id === activeSite);
    mine.sort((a, b) => String(a.linked_id || '').localeCompare(String(b.linked_id || ''), undefined, { numeric: true }));
    const passed = mine.filter(isDone).length;
    return { list: mine, passed, pct: mine.length ? Math.round((passed / mine.length) * 100) : 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, activeSite, done]);

  async function toggle(it: any) {
    const next = !isDone(it);
    setDone((d) => ({ ...d, [it.id]: next }));
    try { await toggleQC(it.id, next); } catch { setDone((d) => { const n = { ...d }; delete n[it.id]; return n; }); }
  }

  if (gateLoading) return <GateLoading />;
  if (!ready) return null;

  return (
    <div style={{ padding: '28px 24px 60px', maxWidth: 900, margin: '0 auto', fontFamily: font, color: C.text }}>
      <PageHeader title="Quality Control by Trade" subtitle="QC before inspections — the same 14-trade checklist on every site, so nothing reaches the inspector unchecked."
        right={
          <select value={activeSite} onChange={(e) => setSite(e.target.value)} style={{ padding: '9px 12px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, background: '#16243A', fontWeight: 600 }}>
            {(projects as any[]).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        } />

      {loading ? <div style={{ color: C.dim, padding: 40, textAlign: 'center' }}>Loading…</div>
      : trades.list.length === 0 ? (
        <EmptyState icon="🔍" title="No QC checklist for this site" body={`Sites launched from the template come pre-loaded with the ${QC_TRADES.length}-trade QC checklist.`} />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
            <Tile label="Trades Passed" value={`${trades.passed}/${trades.list.length}`} color={trades.pct >= 100 ? C.green : C.gold} />
            <Tile label="QC Complete" value={`${trades.pct}%`} color={trades.pct >= 100 ? C.green : C.gold} />
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '10px 14px' }}>
            {trades.list.map((it) => {
              const d = isDone(it);
              return (
                <button key={it.id} onClick={() => toggle(it)} style={{ display: 'flex', gap: 12, alignItems: 'center', width: '100%', textAlign: 'left', background: 'none', border: 'none', borderBottom: `1px solid ${C.border}`, cursor: 'pointer', padding: '11px 4px' }}>
                  <span style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${d ? C.green : C.border}`, background: d ? C.green : '#16243A', color: '#fff', flexShrink: 0, fontSize: 12, fontWeight: 900, lineHeight: '17px', textAlign: 'center' }}>{d ? '✓' : ''}</span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: d ? C.faint : C.text, textDecoration: d ? 'line-through' : 'none', flex: 1 }}>{it.title}</span>
                  {d && <span style={{ fontSize: 12, fontWeight: 700, color: C.green }}>Passed</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
