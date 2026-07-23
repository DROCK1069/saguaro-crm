'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMilestones } from '@/lib/hooks/useFranchise';
import { milestoneSlip, SEVERITY_ORDER, type Severity } from '@/lib/franchise';
import {
  C, font, fmtDate, useFranchiseGate, GateLoading,
  PageHeader, Tile, SevDot, SevBadge, Chip, SearchInput, EmptyState, AttentionBanner, Metric, LiftCard,
} from '@/components/franchise/kit';

const SEV_LABEL: Record<Severity, string> = { red: 'Critical Slip', yellow: 'Slipping', green: 'On Track' };

// Slip badge/metric text: "+12d" later than baseline, "On time" when not slipping, "—" when unknown.
const slipLabel = (slip: number | null) => (slip == null ? '—' : slip > 0 ? `+${slip}d` : 'On time');

export default function MilestonesPage() {
  const { ready, loading: gateLoading } = useFranchiseGate();
  const { milestones: raw, loading } = useMilestones();
  const [filter, setFilter] = useState<'all' | Severity>('all');
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    const list = ((raw as any[]) || []).map((it) => ({
      it,
      h: milestoneSlip(it.baseline_date, it.current_date, it.actual_date, it.float_days),
    }));
    // Worst-first, then biggest slip first.
    list.sort((a, b) =>
      SEVERITY_ORDER[a.h.severity] - SEVERITY_ORDER[b.h.severity] ||
      (b.h.slip ?? -Infinity) - (a.h.slip ?? -Infinity));
    return list;
  }, [raw]);

  const summary = useMemo(() => {
    const s = { green: 0, yellow: 0, red: 0, critical: 0, total: rows.length };
    rows.forEach(({ it, h }) => {
      s[h.severity]++;
      if (it.is_critical_path) s.critical++;
    });
    return s;
  }, [rows]);

  const filtered = rows.filter(({ it, h }) =>
    (filter === 'all' || h.severity === filter) &&
    (!q || `${it.title || it.name || ''} ${it.project_name || ''}`.toLowerCase().includes(q.toLowerCase())));

  if (gateLoading) return <GateLoading />;
  if (!ready) return null;

  return (
    <div style={{ padding: '28px 24px 60px', maxWidth: 1280, margin: '0 auto', fontFamily: font, color: C.text }}>
      <PageHeader
        title="Milestone Variance"
        subtitle="Schedule slippage across all sites, measured against each milestone's baseline. Worst slips first — recover the red ones."
      />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <Tile label="Total Milestones" value={summary.total} />
        <Tile label="On Track" value={summary.green} color={C.green} />
        <Tile label="Slipping" value={summary.yellow} color={C.yellow} />
        <Tile label="Critical Slip" value={summary.red} color={C.red} />
        <Tile label="Critical Path" value={summary.critical} />
      </div>

      <AttentionBanner red={summary.red} yellow={summary.yellow} noun="milestone" />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        {(['all', 'red', 'yellow', 'green'] as const).map((f) => (
          <Chip key={f} active={filter === f} color={f === 'all' ? C.text : ({ red: C.red, yellow: C.yellow, green: C.green } as any)[f]}
            onClick={() => setFilter(f)} count={f === 'all' ? summary.total : (summary as any)[f]}>
            {f !== 'all' && <SevDot sev={f as Severity} size={8} />}
            {f === 'all' ? 'All' : SEV_LABEL[f as Severity]}
          </Chip>
        ))}
        <SearchInput value={q} onChange={setQ} placeholder="Search milestone, site…" />
      </div>

      {loading ? (
        <div style={{ color: C.dim, padding: 40, textAlign: 'center' }}>Loading milestones…</div>
      ) : filtered.length === 0 ? (
        rows.length === 0 ? (
          <EmptyState icon="🏁" title="No milestones yet"
            body="Milestones roll up here from every site's schedule. Once baseline and forecast dates are set, the tracker computes each one's slip against baseline and surfaces what's blowing the schedule." />
        ) : (
          <EmptyState title="Nothing matches this filter" />
        )
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
          {filtered.map(({ it, h }) => (
            <LiftCard key={it.id} sev={h.severity}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.title || it.name || 'Untitled milestone'}</div>
                  <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>
                    {it.project_id ? (
                      <Link href={`/app/projects/${it.project_id}`} style={{ color: C.blue, textDecoration: 'none' }}>{it.project_name || 'Project'}</Link>
                    ) : 'Unassigned'}
                    {it.project_city ? ` · ${it.project_city}, ${it.project_state}` : ''}
                  </div>
                </div>
                <SevBadge sev={h.severity} label={slipLabel(h.slip)} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 13 }}>
                <Metric label="Baseline" value={fmtDate(it.baseline_date)} />
                <Metric label="Forecast / Actual" value={fmtDate(it.actual_date || it.current_date)} />
                <Metric label="Slip" value={slipLabel(h.slip)} color={h.severity === 'red' ? C.red : h.severity === 'yellow' ? C.yellow : C.text} />
                <Metric label="Float" value={it.float_days != null ? `${it.float_days}d` : '—'} />
                <Metric label="Status" value={it.status || '—'} />
                <Metric label="Owner" value={it.responsible_name || it.responsible_party || '—'} />
              </div>

              {it.is_critical_path && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: `${C.red}14`, color: C.red }}>Critical Path</span>
                </div>
              )}
            </LiftCard>
          ))}
        </div>
      )}
    </div>
  );
}