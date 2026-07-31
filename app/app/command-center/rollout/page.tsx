'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useProjects } from '@/lib/hooks/useProjects';
import { moveStage, launchSite } from '@/lib/hooks/useFranchise';
import { computeHealth } from '@/lib/portfolio-health';
import { ROLLOUT_STAGES, STAGE_META, STAGE_IDS, GOLF_TEMPLATE } from '@/lib/franchise-template';
import { num, type Severity } from '@/lib/franchise';
import {
  C, font, fmtMoneyShort, useFranchiseGate, GateLoading, PageHeader, Tile, SevBadge,
} from '@/components/franchise/kit';
import { Plus, ArrowLeft, ArrowRight, Cactus } from '@phosphor-icons/react';

const SEV_LABEL: Record<Severity, string> = { red: 'Escalate', yellow: 'Watch', green: 'On Track' };

export default function RolloutPipelinePage() {
  const { ready, loading: gateLoading } = useFranchiseGate();
  const { projects, loading } = useProjects();
  const [override, setOverride] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [launching, setLaunching] = useState(false);

  // Effective stage = optimistic override, else stored, else entry stage.
  const stageOf = (p: any): string => override[p.id] || (STAGE_IDS.includes(p.rollout_stage) ? p.rollout_stage : 'site_selection');

  const byStage = useMemo(() => {
    const map: Record<string, any[]> = Object.fromEntries(STAGE_IDS.map((s) => [s, []]));
    ((projects as any[]) || []).forEach((p) => { map[stageOf(p)].push(p); });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, override]);

  const summary = useMemo(() => {
    const list = (projects as any[]) || [];
    const value = list.reduce((s, p) => s + (num(p.contract_value) || 0), 0);
    const inConstruction = list.filter((p) => stageOf(p) === 'construction').length;
    const openingSoon = list.filter((p) => ['inspections_co', 'training_opening'].includes(stageOf(p))).length;
    return { total: list.length, value, inConstruction, openingSoon };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, override]);

  async function shift(p: any, dir: -1 | 1) {
    const cur = STAGE_META[stageOf(p)].order;
    const next = ROLLOUT_STAGES.find((s) => s.order === cur + dir);
    if (!next || busy[p.id]) return;
    setOverride((o) => ({ ...o, [p.id]: next.id }));
    setBusy((b) => ({ ...b, [p.id]: true }));
    try { await moveStage(p.id, next.id); }
    catch { setOverride((o) => { const n = { ...o }; delete n[p.id]; return n; }); } // roll back on failure
    finally { setBusy((b) => ({ ...b, [p.id]: false })); }
  }

  if (gateLoading) return <GateLoading />;
  if (!ready) return null;

  return (
    <div style={{ padding: '28px 24px 60px', maxWidth: 1400, margin: '0 auto', fontFamily: font, color: C.text }}>
      <PageHeader
        title="Franchise Rollout Pipeline"
        subtitle="Every location from site selection to grand opening. Move a site with the arrows; launch a new one from the standardized playbook."
        right={
          <button onClick={() => setLaunching(true)} style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: C.gold, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
            <Plus size={16} weight="bold" color="#fff" style={{ verticalAlign: 'middle', marginRight: 4 }} />Launch New Site
          </button>
        }
      />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <Tile label="Locations" value={summary.total} />
        <Tile label="In Construction" value={summary.inConstruction} color={C.yellow} />
        <Tile label="Opening Soon" value={summary.openingSoon} color={C.green} />
        <Tile label="Pipeline Value" value={fmtMoneyShort(summary.value)} />
      </div>

      {loading ? (
        <div style={{ color: C.dim, padding: 40, textAlign: 'center' }}>Loading pipeline…</div>
      ) : (
        <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 12, alignItems: 'flex-start' }}>
          {ROLLOUT_STAGES.map((stage) => {
            const items = byStage[stage.id] || [];
            const colValue = items.reduce((s, p) => s + (num(p.contract_value) || 0), 0);
            return (
              <div key={stage.id} style={{ flex: '0 0 288px', width: 288, background: '#1c1c1e', border: `1px solid ${C.border}`, borderRadius: 14, padding: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px 4px' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: stage.color }} />
                  <span style={{ fontSize: 13, fontWeight: 800 }}>{stage.label}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: C.dim }}>{items.length}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 6px 8px' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: stage.color, background: `${stage.color}18`, borderRadius: 5, padding: '1px 6px' }}>{stage.weeks}</span>
                  <span style={{ fontSize: 11, color: C.faint, fontWeight: 600 }}>{colValue > 0 ? fmtMoneyShort(colValue) : '—'}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 40 }}>
                  {items.length === 0 ? (
                    <div style={{ fontSize: 12, color: C.faint, textAlign: 'center', padding: '18px 0', border: `1px dashed ${C.border}`, borderRadius: 10 }}>Empty</div>
                  ) : items.map((p) => {
                    const h = computeHealth(p);
                    return (
                      <div key={p.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${stage.color}`, borderRadius: 10, padding: '10px 11px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                          <Link href={`/app/projects/${p.id}`} style={{ fontSize: 13, fontWeight: 800, color: C.text, textDecoration: 'none', lineHeight: 1.25 }}>{p.name || 'Untitled'}</Link>
                          <SevBadge sev={h.status as Severity} label={SEV_LABEL[h.status as Severity]} />
                        </div>
                        <div style={{ fontSize: 11, color: C.dim, marginTop: 3 }}>
                          {[p.city, p.state].filter(Boolean).join(', ') || '—'}
                          {num(p.contract_value) ? ` · ${fmtMoneyShort(num(p.contract_value))}` : ''}
                        </div>
                        {/* progress */}
                        <div style={{ height: 4, borderRadius: 2, background: '#1c1c1e', overflow: 'hidden', margin: '8px 0 9px' }}>
                          <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, num(p.percent_complete) || 0))}%`, background: stage.color }} />
                        </div>
                        {/* stage controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button onClick={() => shift(p, -1)} disabled={busy[p.id] || STAGE_META[stageOf(p)].order === 0}
                            style={arrowStyle(busy[p.id] || STAGE_META[stageOf(p)].order === 0)}><ArrowLeft size={13} weight="regular" style={{ verticalAlign: 'middle' }} /></button>
                          <button onClick={() => shift(p, 1)} disabled={busy[p.id] || STAGE_META[stageOf(p)].order === STAGE_IDS.length - 1}
                            style={arrowStyle(busy[p.id] || STAGE_META[stageOf(p)].order === STAGE_IDS.length - 1)}>Advance <ArrowRight size={13} weight="regular" style={{ verticalAlign: 'middle' }} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {launching && <LaunchModal onClose={() => setLaunching(false)} />}
    </div>
  );
}

function arrowStyle(disabled: boolean): React.CSSProperties {
  return {
    flex: 1, padding: '5px 8px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: disabled ? 'default' : 'pointer',
    border: `1px solid ${C.border}`, background: disabled ? '#0a0a0a' : '#1c1c1e', color: disabled ? C.faint : C.text,
  };
}

function LaunchModal({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState<Record<string, any>>({ state: 'AZ' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<any>(null);
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const inp: React.CSSProperties = { padding: '9px 11px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', background: '#1c1c1e', width: '100%' };
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4, display: 'block' };

  async function submit() {
    if (!f.name) { setErr('Site name is required.'); return; }
    setBusy(true); setErr('');
    try { const r = await launchSite(f); setDone(r); }
    catch (e: any) { setErr(e?.message || 'Failed to launch'); }
    finally { setBusy(false); }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '8vh 16px', overflow: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.card, borderRadius: 16, padding: 24, width: 'min(560px, 100%)', boxShadow: '0 24px 80px rgba(0,0,0,0.3)', fontFamily: font }}>
        {done ? (
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 6 }}><Cactus size={22} weight="fill" color={C.gold} style={{ verticalAlign: 'middle', marginRight: 6 }} />{f.name} launched</div>
            <p style={{ fontSize: 14, color: C.dim, lineHeight: 1.6, margin: '0 0 16px' }}>
              Created from the <b>{GOLF_TEMPLATE.name}</b> playbook and pre-loaded with{' '}
              <b>{done.seeded?.phases ?? 0}</b> phases, <b>{done.seeded?.milestones ?? 0}</b> milestones,{' '}
              <b>{done.seeded?.longLead ?? 0}</b> long-lead items, <b>{done.seeded?.risks ?? 0}</b> standard risks,
              and the standard <b>01–12 document folders</b>. It enters the pipeline at <b>Site Selection</b>.
            </p>
            {done.warnings?.length > 0 && (
              <div style={{ fontSize: 12, color: C.yellow, marginBottom: 12 }}>Note: {done.warnings.join('; ')}</div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <Link href={`/app/projects/${done.project?.id}`} style={{ padding: '10px 18px', borderRadius: 10, background: C.gold, color: '#fff', fontWeight: 800, textDecoration: 'none', fontSize: 14 }}>Open site</Link>
              <button onClick={onClose} style={{ padding: '10px 18px', borderRadius: 10, border: `1px solid ${C.border}`, background: '#1c1c1e', color: C.dim, fontWeight: 700, cursor: 'pointer' }}>Done</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 19, fontWeight: 900, marginBottom: 4 }}>Launch New Site</div>
            <p style={{ fontSize: 13, color: C.dim, margin: '0 0 16px', lineHeight: 1.5 }}>
              Spins up a new location and pre-loads the standardized golf-franchise playbook — phases, milestones, long-lead procurement, and the standard risk register.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Site name *</label><input style={inp} placeholder="e.g. Back Nine Tempe" value={f.name || ''} onChange={(e) => set('name', e.target.value)} /></div>
              <div><label style={lbl}>City</label><input style={inp} value={f.city || ''} onChange={(e) => set('city', e.target.value)} /></div>
              <div><label style={lbl}>State</label><input style={inp} value={f.state || ''} onChange={(e) => set('state', e.target.value)} /></div>
              <div><label style={lbl}>Contract value</label><input type="number" style={inp} placeholder="e.g. 4200000" value={f.contract_value || ''} onChange={(e) => set('contract_value', e.target.value)} /></div>
              <div><label style={lbl}>Target start date</label><input type="date" style={inp} value={f.start_date || ''} onChange={(e) => set('start_date', e.target.value)} /></div>
            </div>
            {err && <div style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={submit} disabled={busy} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: busy ? C.dim : C.gold, color: '#fff', fontWeight: 800, cursor: busy ? 'default' : 'pointer' }}>{busy ? 'Launching…' : 'Launch site'}</button>
              <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, border: `1px solid ${C.border}`, background: '#1c1c1e', color: C.dim, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
