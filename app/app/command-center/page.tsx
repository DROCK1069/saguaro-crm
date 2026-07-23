'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useProjects } from '@/lib/hooks/useProjects';
import { useFeature } from '@/lib/hooks/useEntitlements';
import { computeHealth, TRIAGE_ORDER, type HealthStatus } from '@/lib/portfolio-health';

const C = {
  gold: '#F59E0B', green: '#34C759', yellow: '#FF9500', red: '#FF3B30', blue: '#007AFF',
  bg: '#0d1117', card: '#0F172A', border: 'rgba(255,255,255,0.12)', dim: '#CBD5E1', text: '#FFFFFF',
};
const STATUS_COLOR: Record<HealthStatus, string> = { green: C.green, yellow: C.yellow, red: C.red };
const STATUS_LABEL: Record<HealthStatus, string> = { green: 'On Track', yellow: 'Watch', red: 'Escalate' };
const font = "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";

const fmtMoney = (n: number | null) => (n == null ? '—' : '$' + Math.round(n).toLocaleString());
const fmtDate = (s: string | null) => {
  if (!s) return '—';
  const t = Date.parse(s);
  return isNaN(t) ? '—' : new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
};

function Tile({ label, value, color, sub }: { label: string; value: string | number; color?: string; sub?: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 18px', minWidth: 120, flex: '1 1 130px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: C.dim }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: color || C.text, lineHeight: 1.1, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function HealthDot({ status, size = 10 }: { status: HealthStatus; size?: number }) {
  return <span style={{ width: size, height: size, borderRadius: '50%', background: STATUS_COLOR[status], display: 'inline-block', boxShadow: `0 0 0 3px ${STATUS_COLOR[status]}22` }} />;
}

export default function CommandCenterPage() {
  const router = useRouter();
  const { enabled, loading: gateLoading } = useFeature('command_center');
  // Fail-closed entitlement gate: only tenants with the flag on can reach this,
  // even by typing the URL. Everyone else is bounced back to the dashboard.
  useEffect(() => {
    if (!gateLoading && !enabled) router.replace('/app');
  }, [gateLoading, enabled, router]);

  const { projects: raw, loading: isLoading } = useProjects();
  const [filter, setFilter] = useState<'all' | HealthStatus>('all');
  const [q, setQ] = useState('');

  // Per-site inspection status (passed / failed / pending) for the dashboard card.
  const [inspByProj, setInspByProj] = useState<Record<string, { passed: number; failed: number; pending: number; total: number }>>({});
  useEffect(() => {
    let alive = true;
    fetch('/api/inspections/list').then((r) => r.json()).then((j) => {
      if (!alive) return;
      const map: Record<string, { passed: number; failed: number; pending: number; total: number }> = {};
      (j.inspections || []).forEach((i: any) => {
        const pid = i.project_id; if (!pid) return;
        const m = map[pid] || (map[pid] = { passed: 0, failed: 0, pending: 0, total: 0 });
        const v = String(i.result || i.status || '').toLowerCase();
        m.total++;
        if (/pass|approv|complete/.test(v)) m.passed++;
        else if (/fail|reject|deficien/.test(v)) m.failed++;
        else m.pending++;
      });
      setInspByProj(map);
    }).catch(() => { /* non-fatal */ });
    return () => { alive = false; };
  }, []);

  const rows = useMemo(() => {
    const list = ((raw as any[]) || []).map((p) => ({ p, h: computeHealth(p) }));
    list.sort((a, b) => TRIAGE_ORDER[a.h.status] - TRIAGE_ORDER[b.h.status] || a.h.score - b.h.score);
    return list;
  }, [raw]);

  const summary = useMemo(() => {
    const s = { green: 0, yellow: 0, red: 0, contract: 0, cSum: 0, cN: 0 };
    rows.forEach(({ h }) => {
      s[h.status]++;
      s.contract += h.budget || 0;
      if (h.percentComplete != null) { s.cSum += h.percentComplete; s.cN++; }
    });
    return { ...s, avg: s.cN ? Math.round(s.cSum / s.cN) : 0, total: rows.length };
  }, [rows]);

  const filtered = rows.filter(({ p, h }) =>
    (filter === 'all' || h.status === filter) &&
    (!q || `${p.name || ''} ${p.city || ''} ${p.state || ''} ${p.project_number || ''}`.toLowerCase().includes(q.toLowerCase())),
  );

  const needsAttention = summary.red + summary.yellow;

  // Gate: while checking, show nothing heavy; if not entitled, we're redirecting.
  if (gateLoading) return <div style={{ padding: 48, textAlign: 'center', color: C.dim, fontFamily: font }}>Loading…</div>;
  if (!enabled) return null;

  return (
    <div style={{ padding: '28px 24px 60px', maxWidth: 1280, margin: '0 auto', fontFamily: font, color: C.text }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, margin: '0 0 4px', letterSpacing: -0.4 }}>Command Center</h1>
          <p style={{ fontSize: 14, color: C.dim, margin: 0 }}>Every project, one screen. Worst-first — handle red and yellow before anything else.</p>
        </div>
        <div style={{ fontSize: 12, color: C.dim }}>{summary.total} active {summary.total === 1 ? 'project' : 'projects'}</div>
      </div>

      {/* Summary tiles */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <Tile label="Projects" value={summary.total} />
        <Tile label="On Track" value={summary.green} color={C.green} />
        <Tile label="Watch" value={summary.yellow} color={C.yellow} />
        <Tile label="Escalate" value={summary.red} color={C.red} />
        <Tile label="Portfolio Value" value={fmtMoney(summary.contract)} />
        <Tile label="Avg Complete" value={`${summary.avg}%`} color={C.blue} />
      </div>

      {/* Needs-attention banner */}
      {needsAttention > 0 && (
        <div style={{ background: summary.red > 0 ? 'rgba(255,59,48,0.08)' : 'rgba(255,149,0,0.08)', border: `1px solid ${summary.red > 0 ? 'rgba(255,59,48,0.25)' : 'rgba(255,149,0,0.25)'}`, borderRadius: 12, padding: '13px 16px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
          <span style={{ fontSize: 18 }}>{summary.red > 0 ? '🔴' : '🟡'}</span>
          <span style={{ color: C.text }}>
            <b>{needsAttention}</b> {needsAttention === 1 ? 'project needs' : 'projects need'} attention today
            {summary.red > 0 && <> — <b style={{ color: C.red }}>{summary.red} to escalate</b></>}. Review these first.
          </span>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        {(['all', 'red', 'yellow', 'green'] as const).map((f) => {
          const on = filter === f;
          const col = f === 'all' ? C.text : STATUS_COLOR[f as HealthStatus];
          const count = f === 'all' ? summary.total : (summary as any)[f];
          return (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '7px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              border: `1px solid ${on ? col : C.border}`, background: on ? `${col}14` : C.card, color: on ? col : C.dim,
              display: 'inline-flex', alignItems: 'center', gap: 7,
            }}>
              {f !== 'all' && <HealthDot status={f as HealthStatus} size={8} />}
              {f === 'all' ? 'All' : f === 'red' ? 'Escalate' : f === 'yellow' ? 'Watch' : 'On Track'}
              <span style={{ opacity: 0.7 }}>{count}</span>
            </button>
          );
        })}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search project or location…"
          style={{ marginLeft: 'auto', flex: '1 1 220px', maxWidth: 300, padding: '8px 12px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', background: C.card }} />
      </div>

      {/* Cards */}
      {isLoading ? (
        <div style={{ color: C.dim, padding: 40, textAlign: 'center' }}>Loading portfolio…</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: C.dim, padding: 48, textAlign: 'center', background: C.card, border: `1px solid ${C.border}`, borderRadius: 14 }}>
          {rows.length === 0 ? 'No active projects yet.' : 'Nothing matches this filter.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
          {filtered.map(({ p, h }) => (
            <Link key={p.id} href={`/app/projects/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `4px solid ${STATUS_COLOR[h.status]}`, borderRadius: 14, padding: '15px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'box-shadow .15s, transform .15s', height: '100%' }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.10)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)'; e.currentTarget.style.transform = 'none'; }}>
                {/* header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name || 'Untitled Project'}</div>
                    <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>
                      {[p.city, p.state].filter(Boolean).join(', ') || p.address || '—'}{p.phase ? ` · ${p.phase}` : ''}
                    </div>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${STATUS_COLOR[h.status]}14`, color: STATUS_COLOR[h.status], fontSize: 11, fontWeight: 800, padding: '4px 9px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                    <HealthDot status={h.status} size={7} />{STATUS_LABEL[h.status]}
                  </span>
                </div>

                {/* progress */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.dim, marginBottom: 4 }}>
                    <span>Complete</span><span style={{ fontWeight: 700, color: C.text }}>{h.percentComplete != null ? `${Math.round(h.percentComplete)}%` : '—'}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: '#16243A', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, h.percentComplete || 0))}%`, background: STATUS_COLOR[h.status], borderRadius: 3 }} />
                  </div>
                </div>

                {/* metrics grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 13 }}>
                  <Metric label="Budget" value={h.variancePct != null ? `${h.variancePct > 0 ? '+' : ''}${h.variancePct.toFixed(0)}%` : fmtMoney(h.budget)} color={h.variancePct != null && h.variancePct > 5 ? C.red : h.variancePct != null && h.variancePct > 1 ? C.yellow : C.text} />
                  <Metric label="Open RFIs" value={h.openRfis != null ? String(h.openRfis) : '—'} />
                  <Metric label="Change Orders" value={h.openCos != null ? String(h.openCos) : '—'} />
                  <Metric label="Punch" value={h.openPunch != null ? String(h.openPunch) : '—'} />
                  {(() => {
                    const ins = inspByProj[p.id];
                    const val = ins && ins.total ? `${ins.passed}/${ins.total}` : '—';
                    const col = !ins || !ins.total ? C.text : ins.failed > 0 ? C.red : ins.pending > 0 ? C.yellow : C.green;
                    return <Metric label="Inspections" value={val} color={col} />;
                  })()}
                  <Metric label="Finish" value={fmtDate(h.finishDate)} color={h.daysToFinish != null && h.daysToFinish < 0 ? C.red : C.text} />
                  <Metric label="Updated" value={h.daysSinceUpdate != null ? (h.daysSinceUpdate === 0 ? 'Today' : `${h.daysSinceUpdate}d ago`) : '—'} color={h.daysSinceUpdate != null && h.daysSinceUpdate > 7 ? C.yellow : C.text} />
                </div>

                {/* flags */}
                {h.flags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 12 }}>
                    {h.flags.map((f, i) => (
                      <span key={i} style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: `${STATUS_COLOR[f.severity]}12`, color: STATUS_COLOR[f.severity], border: `1px solid ${STATUS_COLOR[f.severity]}30` }}>{f.label}</span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color: '#CBD5E1' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: color || '#FFFFFF', marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}
