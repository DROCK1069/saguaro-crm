'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useEscalations } from '@/lib/hooks/useFranchise';
import { escalationSeverity, escalationLevel, SEVERITY_ORDER, num, type Severity } from '@/lib/franchise';
import {
  C, font, fmtDate, useFranchiseGate, GateLoading,
  PageHeader, Tile, SevDot, SevBadge, Chip, SearchInput, EmptyState, AttentionBanner, Metric, LiftCard,
} from '@/components/franchise/kit';
import { Flag } from '@phosphor-icons/react';

const SEV_LABEL: Record<Severity, string> = { red: 'Critical', yellow: 'Watch', green: 'Resolved' };
const RESOLVED_RE = /resolved|closed/i;

interface EscHealth { severity: Severity; resolved: boolean; label: string; daysOverdue: number }

// Resolved escalations are history — always green. Otherwise days-overdue drives severity.
function computeEscalation(e: Record<string, any>): EscHealth {
  const resolved = RESOLVED_RE.test(String(e.status || ''));
  const daysOverdue = num(e.days_overdue) ?? 0;
  const severity: Severity = resolved ? 'green' : escalationSeverity(e.days_overdue);
  const label = resolved
    ? 'Resolved'
    : daysOverdue > 0 ? `${daysOverdue}d overdue`
    : daysOverdue === 0 ? 'Due today'
    : 'On time';
  return { severity, resolved, label, daysOverdue };
}

export default function EscalationsPage() {
  const { ready, loading: gateLoading } = useFranchiseGate();
  const { escalations: raw, loading } = useEscalations();
  const [filter, setFilter] = useState<'all' | Severity>('all');
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    const list = ((raw as any[]) || []).map((it) => ({ it, h: computeEscalation(it) }));
    // Worst-first by severity, then most days overdue first.
    list.sort((a, b) =>
      SEVERITY_ORDER[a.h.severity] - SEVERITY_ORDER[b.h.severity] ||
      b.h.daysOverdue - a.h.daysOverdue);
    return list;
  }, [raw]);

  const summary = useMemo(() => {
    const s = { green: 0, yellow: 0, red: 0, total: rows.length, open: 0, resolved: 0, levels: [0, 0, 0, 0] };
    rows.forEach(({ it, h }) => {
      s[h.severity]++;
      if (h.resolved) { s.resolved++; }
      else { s.open++; s.levels[escalationLevel(it.days_overdue).level - 1]++; }
    });
    return s;
  }, [rows]);

  const filtered = rows.filter(({ it, h }) =>
    (filter === 'all' || h.severity === filter) &&
    (!q || `${it.reason || ''} ${it.project_name || ''} ${it.project_city || ''} ${it.item_type || ''} ${it.assigned_to || ''}`.toLowerCase().includes(q.toLowerCase())));

  if (gateLoading) return <GateLoading />;
  if (!ready) return null;

  const pill: React.CSSProperties = { fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: '#1c1c1e', color: C.dim };

  return (
    <div style={{ padding: '28px 24px 60px', maxWidth: 1280, margin: '0 auto', fontFamily: font, color: C.text }}>
      <PageHeader
        title="Escalations"
        subtitle="Everything escalated for attention across all sites — RFIs, submittals and action items that blew past their date. Clear the red ones first."
      />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <Tile label="Escalations" value={summary.total} />
        <Tile label="Open" value={summary.open} />
        <Tile label="Critical" value={summary.red} color={C.red} sub="7d+ overdue" />
        <Tile label="Watch" value={summary.yellow} color={C.yellow} sub="1–6d overdue" />
        <Tile label="Resolved" value={summary.resolved} color={C.green} />
      </div>

      <AttentionBanner red={summary.red} yellow={summary.yellow} noun="escalation" />

      {/* 4-level escalation matrix — who owns it as it ages (Super → PM → Director → Exec). */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: C.dim, margin: '0 2px 8px' }}>Escalation Matrix · who owns it now</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          {[
            { n: 1, owner: 'Superintendent', hint: '0–2d overdue', color: '#34C759' },
            { n: 2, owner: 'Project Manager', hint: '3–6d overdue', color: '#FFCC00' },
            { n: 3, owner: 'Director of Construction', hint: '7–13d overdue', color: '#FF9500' },
            { n: 4, owner: 'Executive Leadership', hint: '14d+ overdue', color: '#FF3B30' },
          ].map((lv) => {
            const count = summary.levels[lv.n - 1];
            return (
              <div key={lv.n} style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `4px solid ${lv.color}`, borderRadius: 12, padding: '12px 14px', opacity: count ? 1 : 0.6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: lv.color, borderRadius: 6, padding: '2px 7px' }}>L{lv.n}</span>
                  <span style={{ fontSize: 22, fontWeight: 900, color: count ? lv.color : C.dim, marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{count}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 6 }}>{lv.owner}</div>
                <div style={{ fontSize: 11, color: C.faint }}>{lv.hint}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        {(['all', 'red', 'yellow', 'green'] as const).map((f) => (
          <Chip key={f} active={filter === f} color={f === 'all' ? C.text : ({ red: C.red, yellow: C.yellow, green: C.green } as any)[f]}
            onClick={() => setFilter(f)} count={f === 'all' ? summary.total : (summary as any)[f]}>
            {f !== 'all' && <SevDot sev={f as Severity} size={8} />}
            {f === 'all' ? 'All' : SEV_LABEL[f as Severity]}
          </Chip>
        ))}
        <SearchInput value={q} onChange={setQ} placeholder="Search reason, site…" />
      </div>

      {loading ? (
        <div style={{ color: C.dim, padding: 40, textAlign: 'center' }}>Loading escalations…</div>
      ) : filtered.length === 0 ? (
        rows.length === 0 ? (
          <EmptyState icon={<Flag size={34} weight="regular" color={C.dim} />} title="No escalations"
            body="Nothing has been escalated across your sites. When an RFI, submittal or action item runs past its date and gets bumped up the chain, it lands here — sorted worst-first so you always know what to chase." />
        ) : (
          <EmptyState title="Nothing matches this filter" />
        )
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
          {filtered.map(({ it, h }) => {
            const dovColor = h.resolved ? C.text : h.daysOverdue >= 7 ? C.red : h.daysOverdue >= 1 ? C.yellow : C.text;
            const lvl = h.resolved ? null : escalationLevel(it.days_overdue);
            return (
              <LiftCard key={it.id} sev={h.severity}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.reason || 'Escalation'}</div>
                    <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>
                      {it.project_id ? (
                        <Link href={`/app/projects/${it.project_id}`} style={{ color: C.blue, textDecoration: 'none' }}>{it.project_name || 'Project'}</Link>
                      ) : 'Unassigned'}
                      {it.project_city ? ` · ${it.project_city}, ${it.project_state}` : ''}
                    </div>
                  </div>
                  <SevBadge sev={h.severity} label={h.label} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 13 }}>
                  <Metric label="Type" value={it.item_type || '—'} />
                  <Metric label="Days Overdue" value={it.days_overdue != null ? `${num(it.days_overdue)}d` : '—'} color={dovColor} />
                  <Metric label="Original Due" value={fmtDate(it.original_due)} />
                  <Metric label="Assigned To" value={it.assigned_to || '—'} />
                  <Metric label="Status" value={it.status || '—'} />
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 12, alignItems: 'center' }}>
                  {lvl && <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: `${lvl.color}18`, color: lvl.color, border: `1px solid ${lvl.color}44` }}>L{lvl.level} · {lvl.owner}</span>}
                  {it.item_type && <span style={pill}>{String(it.item_type).toUpperCase()}</span>}
                  {h.resolved && it.resolved_at && <span style={pill}>Resolved {fmtDate(it.resolved_at)}</span>}
                  {!h.resolved && h.daysOverdue > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.dim, marginLeft: 'auto' }}>{h.daysOverdue}d overdue</span>
                  )}
                </div>
              </LiftCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
