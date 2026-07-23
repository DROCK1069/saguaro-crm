'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useProjects } from '@/lib/hooks/useProjects';
import { useDailyLogs, submitDailyLog } from '@/lib/hooks/useFranchise';
import { C, font, fmtDate, useFranchiseGate, GateLoading, PageHeader, Tile, EmptyState, SevBadge } from '@/components/franchise/kit';

const ACTIVE = (p: any) => !/complete|closed|closeout|won|archiv/i.test(String(p.status || ''));

export default function DailyLogsPage() {
  const { ready, loading: gateLoading } = useFranchiseGate();
  const { logs, todayByProject, lateByProject, loading } = useDailyLogs();
  const { projects } = useProjects();
  const [submitting, setSubmitting] = useState(false);

  const activeSites = (projects as any[]).filter(ACTIVE);
  const compliance = useMemo(() => {
    const reported = activeSites.filter((p) => todayByProject[p.id]).length;
    const late = activeSites.filter((p) => todayByProject[p.id] && lateByProject[p.id]).length;
    return { reported, late, total: activeSites.length, missing: activeSites.filter((p) => !todayByProject[p.id]) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, todayByProject, lateByProject]);

  if (gateLoading) return <GateLoading />;
  if (!ready) return null;

  return (
    <div style={{ padding: '28px 24px 60px', maxWidth: 1200, margin: '0 auto', fontFamily: font, color: C.text }}>
      <PageHeader title="Daily Superintendent Reports" subtitle="Every site reports by 4 PM — photos, manpower, weather, progress, problems. You know the day without a phone call."
        right={<button onClick={() => setSubmitting((v) => !v)} style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: C.gold, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>{submitting ? 'Close' : '+ Submit Report'}</button>} />

      {submitting && <SubmitForm projects={activeSites} onDone={() => setSubmitting(false)} />}

      {/* 4 PM compliance */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 18px', marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 800 }}>Today's 4 PM Compliance</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: compliance.reported === compliance.total ? C.green : C.red }}>{compliance.reported}/{compliance.total} reported</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {activeSites.map((p) => {
            const ok = todayByProject[p.id];
            const late = ok && lateByProject[p.id];
            const bg = !ok ? 'rgba(255,59,48,0.10)' : late ? 'rgba(255,149,0,0.12)' : 'rgba(52,199,89,0.12)';
            const fg = !ok ? C.red : late ? C.yellow : C.green;
            const bd = !ok ? 'rgba(255,59,48,0.25)' : late ? 'rgba(255,149,0,0.3)' : 'rgba(52,199,89,0.3)';
            return (
              <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, padding: '5px 11px', borderRadius: 999, background: bg, color: fg, border: `1px solid ${bd}` }}>
                {!ok ? '○' : late ? '⚠' : '✓'} {p.name}{late ? ' · late' : ''}
              </span>
            );
          })}
          {activeSites.length === 0 && <span style={{ fontSize: 13, color: C.dim }}>No active sites.</span>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <Tile label="Reported Today" value={compliance.reported} color={C.green} />
        <Tile label="Awaiting" value={compliance.total - compliance.reported} color={compliance.total - compliance.reported ? C.red : C.green} />
        <Tile label="Late (after 4 PM)" value={compliance.late} color={compliance.late ? C.yellow : C.green} sub="site local time" />
        <Tile label="Reports (21d)" value={(logs as any[]).length} />
      </div>

      <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: C.dim, margin: '4px 2px 10px' }}>Recent Reports</div>
      {loading ? <div style={{ color: C.dim, padding: 40, textAlign: 'center' }}>Loading…</div>
      : (logs as any[]).length === 0 ? (
        <EmptyState icon="📋" title="No daily reports yet" body="Every superintendent submits a daily report — photos, manpower, weather, progress, and problems — by 4 PM local. They roll up here across all sites."
          action={<button onClick={() => setSubmitting(true)} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: C.gold, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>+ Submit the first</button>} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
          {(logs as any[]).map((l) => {
            const hasIssue = !!(l.issues || l.delays || l.incidents);
            return (
              <div key={l.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${hasIssue ? C.yellow : C.green}`, borderRadius: 12, padding: '13px 15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>{l.project_id ? <Link href={`/app/projects/${l.project_id}`} style={{ color: C.text, textDecoration: 'none' }}>{l.project_name || 'Site'}</Link> : 'Site'}</div>
                    <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>{fmtDate(l.log_date)}{l.superintendent_name ? ` · ${l.superintendent_name}` : ''}</div>
                  </div>
                  {hasIssue && <SevBadge sev="yellow" label="Issue" />}
                </div>
                <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 12, color: C.dim, flexWrap: 'wrap' }}>
                  {l.manpower_count != null && <span>👷 {l.manpower_count} crew</span>}
                  {l.weather && <span>🌤 {l.weather}</span>}
                  {l.photos_count != null && <span>📷 {l.photos_count}</span>}
                </div>
                {l.work_performed && <div style={{ fontSize: 13, color: C.text, marginTop: 9, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{l.work_performed}</div>}
                {(l.issues || l.delays) && <div style={{ fontSize: 12, color: C.red, marginTop: 6 }}>⚠ {l.issues || l.delays}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SubmitForm({ projects, onDone }: { projects: any[]; onDone: () => void }) {
  const [f, setF] = useState<Record<string, any>>({ log_date: new Date().toISOString().slice(0, 10) });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const inp: React.CSSProperties = { padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, outline: 'none', background: '#16243A', width: '100%' };
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4, display: 'block' };

  async function submit() {
    if (!f.project_id) { setErr('Pick a site.'); return; }
    setBusy(true); setErr('');
    try { await submitDailyLog(f); onDone(); } catch (e: any) { setErr(e?.message || 'Failed'); } finally { setBusy(false); }
  }

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, marginBottom: 18 }}>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Daily superintendent report</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
        <div><label style={lbl}>Site *</label><select style={inp} value={f.project_id || ''} onChange={(e) => set('project_id', e.target.value)}><option value="">Select…</option>{projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div><label style={lbl}>Date</label><input type="date" style={inp} value={f.log_date} onChange={(e) => set('log_date', e.target.value)} /></div>
        <div><label style={lbl}>Superintendent</label><input style={inp} value={f.superintendent_name || ''} onChange={(e) => set('superintendent_name', e.target.value)} /></div>
        <div><label style={lbl}>Manpower count</label><input type="number" style={inp} value={f.manpower_count || ''} onChange={(e) => set('manpower_count', e.target.value)} /></div>
        <div><label style={lbl}>Weather</label><input style={inp} placeholder="Clear, 104°F" value={f.weather || ''} onChange={(e) => set('weather', e.target.value)} /></div>
        <div><label style={lbl}>Photos count</label><input type="number" style={inp} value={f.photos_count || ''} onChange={(e) => set('photos_count', e.target.value)} /></div>
        <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Work performed today</label><textarea style={{ ...inp, minHeight: 54, resize: 'vertical', fontFamily: font }} value={f.work_performed || ''} onChange={(e) => set('work_performed', e.target.value)} /></div>
        <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Tomorrow's work</label><textarea style={{ ...inp, minHeight: 44, resize: 'vertical', fontFamily: font }} value={f.tomorrow || ''} onChange={(e) => set('tomorrow', e.target.value)} /></div>
        <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Problems / delays</label><input style={inp} value={f.problems || ''} onChange={(e) => set('problems', e.target.value)} /></div>
        <div><label style={lbl}>Deliveries</label><input style={inp} value={f.materials_delivered || ''} onChange={(e) => set('materials_delivered', e.target.value)} /></div>
        <div><label style={lbl}>Inspections</label><input style={inp} value={f.inspections_text || ''} onChange={(e) => set('inspections_text', e.target.value)} /></div>
        <div><label style={lbl}>Safety</label><input style={inp} value={f.safety_notes || ''} onChange={(e) => set('safety_notes', e.target.value)} /></div>
      </div>
      {err && <div style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button onClick={submit} disabled={busy} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: busy ? C.dim : C.gold, color: '#fff', fontWeight: 800, cursor: busy ? 'default' : 'pointer' }}>{busy ? 'Submitting…' : 'Submit report'}</button>
        <button onClick={onDone} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${C.border}`, background: '#0F172A', color: C.dim, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
      </div>
    </div>
  );
}
