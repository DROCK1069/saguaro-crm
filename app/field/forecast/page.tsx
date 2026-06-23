'use client';
/**
 * Saguaro Field — Cost & Schedule Forecast (predictive analytics)
 * Earned-Value forecast: CPI/SPI, EAC, cost-to-complete, projected overrun,
 * and a composite project-risk gauge. Reads /api/projects/[id]/forecast.
 */
import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

const GOLD = '#C8881C', BASE = '#F2F2F7', CARD = '#FFFFFF', BORDER = '#E5E5EA';
const TEXT = '#1C1C1E', DIM = '#6E6E73', GREEN = '#22C55E', RED = '#EF4444', AMBER = '#F59E0B', BLUE = '#3B82F6';

const RISK_COLOR: Record<string, string> = { low: GREEN, moderate: AMBER, high: '#F97316', critical: RED };
const money = (n: number) => '$' + Math.round(n).toLocaleString();

interface Forecast {
  inputs: { bac: number; pv: number; ev: number; ac: number; percent_complete_weighted: number };
  forecast: { cpi: number; spi: number; cv: number; sv: number; eac_cpi: number; etc: number; vac: number; cost_status: string; schedule_status: string; risk_score: number; risk_level: string; projected_duration: number | null };
  cost_to_complete: number; estimate_at_completion: number; projected_overrun: number;
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, flex: 1 }}>
      <div style={{ fontSize: 11, color: DIM, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || TEXT, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function ForecastInner() {
  const sp = useSearchParams();
  const [projectId, setProjectId] = useState(sp.get('projectId') || '');
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [data, setData] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/projects/list').then(r => r.json()).then(d => {
      const list = d.projects || d || [];
      setProjects(list);
      if (!projectId && list[0]) setProjectId(list[0].id);
    }).catch(() => {});
  }, []); // eslint-disable-line

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true); setErr('');
    try {
      const r = await fetch(`/api/projects/${projectId}/forecast`);
      if (!r.ok) throw new Error('Failed to load forecast');
      setData(await r.json());
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const f = data?.forecast;
  return (
    <div style={{ minHeight: '100vh', background: BASE, padding: 16, paddingBottom: 80 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: TEXT, margin: '8px 0 16px' }}>Forecast</h1>
      {projects.length > 0 && (
        <select value={projectId} onChange={e => setProjectId(e.target.value)}
          style={{ width: '100%', padding: 12, borderRadius: 10, border: `1px solid ${BORDER}`, marginBottom: 16, fontSize: 15, background: CARD }}>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}
      {loading && <div style={{ color: DIM }}>Calculating earned value…</div>}
      {err && <div style={{ color: RED }}>{err}</div>}
      {data && f && (
        <>
          {/* Risk gauge */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, color: DIM, textTransform: 'uppercase' }}>Project Risk</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: RISK_COLOR[f.risk_level] }}>{f.risk_level.toUpperCase()}</div>
              </div>
              <div style={{ fontSize: 40, fontWeight: 900, color: RISK_COLOR[f.risk_level] }}>{f.risk_score}</div>
            </div>
            <div style={{ height: 8, background: BORDER, borderRadius: 4, marginTop: 10, overflow: 'hidden' }}>
              <div style={{ width: `${f.risk_score}%`, height: '100%', background: RISK_COLOR[f.risk_level] }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <Stat label="CPI" value={f.cpi.toFixed(2)} color={f.cpi >= 1 ? GREEN : RED} />
            <Stat label="SPI" value={f.spi.toFixed(2)} color={f.spi >= 1 ? GREEN : RED} />
            <Stat label="% Complete" value={`${data.inputs.percent_complete_weighted}%`} color={BLUE} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <Stat label="Budget (BAC)" value={money(data.inputs.bac)} />
            <Stat label="Spent (AC)" value={money(data.inputs.ac)} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <Stat label="Est. at Completion" value={money(data.estimate_at_completion)} color={data.estimate_at_completion > data.inputs.bac ? RED : GREEN} />
            <Stat label="Cost to Complete" value={money(data.cost_to_complete)} />
          </div>
          <Stat label="Projected Overrun" value={data.projected_overrun > 0 ? money(data.projected_overrun) : 'None'} color={data.projected_overrun > 0 ? RED : GREEN} />
          <div style={{ marginTop: 12, padding: 14, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, fontSize: 14, color: DIM }}>
            Cost: <b style={{ color: f.cost_status === 'over' ? RED : GREEN }}>{f.cost_status}</b> budget · Schedule: <b style={{ color: f.schedule_status === 'behind' ? RED : GREEN }}>{f.schedule_status}</b>
            {f.projected_duration ? <> · Projected duration: <b style={{ color: TEXT }}>{f.projected_duration}d</b></> : null}
          </div>
        </>
      )}
    </div>
  );
}

export default function ForecastPage() {
  return <Suspense fallback={<div style={{ padding: 16 }}>Loading…</div>}><ForecastInner /></Suspense>;
}
