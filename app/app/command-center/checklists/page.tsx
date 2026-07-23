'use client';
import { useMemo, useState } from 'react';
import { useProjects } from '@/lib/hooks/useProjects';
import { useChecklist, toggleChecklist } from '@/lib/hooks/useFranchise';
import { CHECKLIST_TEMPLATE } from '@/lib/franchise-template';
import { C, font, useFranchiseGate, GateLoading, PageHeader, EmptyState } from '@/components/franchise/kit';

const PHASE_ORDER = CHECKLIST_TEMPLATE.map((g) => g.phase);

export default function ChecklistsPage() {
  const { ready, loading: gateLoading } = useFranchiseGate();
  const { items, loading } = useChecklist();
  const { projects } = useProjects();
  const [site, setSite] = useState('');
  const [done, setDone] = useState<Record<string, boolean>>({});

  const activeSite = site || (projects as any[])[0]?.id || '';
  const isDone = (it: any) => (it.id in done ? done[it.id] : it.is_done);

  const groups = useMemo(() => {
    const mine = (items as any[]).filter((i) => i.project_id === activeSite);
    const byPhase: Record<string, any[]> = {};
    mine.forEach((i) => { (byPhase[i.description || 'Other'] ||= []).push(i); });
    Object.values(byPhase).forEach((arr) => arr.sort((a, b) => String(a.linked_id || '').localeCompare(String(b.linked_id || ''), undefined, { numeric: true })));
    const ordered = [...PHASE_ORDER.filter((p) => byPhase[p]), ...Object.keys(byPhase).filter((p) => !PHASE_ORDER.includes(p))];
    return ordered.map((phase) => {
      const list = byPhase[phase];
      const doneN = list.filter(isDone).length;
      return { phase, list, doneN, pct: list.length ? Math.round((doneN / list.length) * 100) : 0 };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, activeSite, done]);

  const overall = useMemo(() => {
    const all = groups.flatMap((g) => g.list);
    const d = all.filter(isDone).length;
    return { total: all.length, done: d, pct: all.length ? Math.round((d / all.length) * 100) : 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, done]);

  async function check(it: any) {
    const next = !isDone(it);
    setDone((d) => ({ ...d, [it.id]: next }));
    try { await toggleChecklist(it.id, next); } catch { setDone((d) => { const n = { ...d }; delete n[it.id]; return n; }); }
  }

  if (gateLoading) return <GateLoading />;
  if (!ready) return null;

  return (
    <div style={{ padding: '28px 24px 60px', maxWidth: 900, margin: '0 auto', fontFamily: font, color: C.text }}>
      <PageHeader title="Phase Checklists" subtitle="The same Phase 1–4 operating playbook on every site — nothing gets skipped, no matter the city or contractor."
        right={
          <select value={activeSite} onChange={(e) => setSite(e.target.value)} style={{ padding: '9px 12px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, background: '#16243A', fontWeight: 600 }}>
            {(projects as any[]).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        } />

      {loading ? <div style={{ color: C.dim, padding: 40, textAlign: 'center' }}>Loading…</div>
      : groups.length === 0 ? (
        <EmptyState icon="✅" title="No checklist for this site" body="Sites launched from the standardized template come pre-loaded with the full Phase 1–4 checklist." />
      ) : (
        <>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 18px', marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 800 }}>Overall progress</span>
              <span style={{ fontSize: 20, fontWeight: 900, color: overall.pct >= 100 ? C.green : C.gold }}>{overall.pct}%</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: '#16243A', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${overall.pct}%`, background: overall.pct >= 100 ? C.green : C.gold, transition: 'width .3s' }} />
            </div>
            <div style={{ fontSize: 12, color: C.dim, marginTop: 6 }}>{overall.done} of {overall.total} steps complete</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {groups.map((g) => (
              <div key={g.phase} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 10 }}>
                  <span style={{ fontSize: 15, fontWeight: 800 }}>{g.phase}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: g.pct >= 100 ? C.green : C.dim }}>{g.doneN}/{g.list.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {g.list.map((it) => {
                    const d = isDone(it);
                    return (
                      <button key={it.id} onClick={() => check(it)} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>
                        <span style={{ marginTop: 1, width: 18, height: 18, borderRadius: 5, border: `2px solid ${d ? C.green : C.border}`, background: d ? C.green : '#16243A', color: '#fff', flexShrink: 0, fontSize: 11, fontWeight: 900, lineHeight: '15px', textAlign: 'center' }}>{d ? '✓' : ''}</span>
                        <span style={{ fontSize: 14, color: d ? C.faint : C.text, textDecoration: d ? 'line-through' : 'none' }}>{it.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
