'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChartLineUp, ChartBar, SquaresFour, Warning, Heartbeat, Selection } from '@phosphor-icons/react';
import { PremiumSurface, ModuleHero, SectionCard, PremiumEmpty, goldButtonStyle } from '@/components/ui/premium';

const GOLD = '#F59E0B', RAISED = '#141416', BORDER = 'rgba(255,255,255,0.12)', DIM = '#CBD5E1', TEXT = '#FFFFFF';
// Desert-dusk semantic palette — harmonized with the dashboard (muted emerald,
// terracotta, warm amber) so the risk/health accents sit on the aurora bg.
const GREEN = '#45B37D', RED = '#E0644E', AMBER = '#F0A63C';
// Nested surfaces layered on the PremiumSurface aurora: NEST = a lifted dark
// panel inside a SectionCard, TILE = the innermost metric wells.
const NEST = 'rgba(20,20,22,0.55)', NEST_BORDER = 'rgba(255,255,255,0.08)';
const TILE = 'rgba(0,0,0,0.28)', TILE_BORDER = 'rgba(255,255,255,0.06)';

const fmt = (n: number) => '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtK = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n < 0 ? '-' : '') + '$' + (abs / 1_000_000).toFixed(1) + 'M';
  if (abs >= 1_000) return (n < 0 ? '-' : '') + '$' + (abs / 1_000).toFixed(0) + 'K';
  return fmt(n);
};
const pct = (a: number, b: number) => b > 0 ? ((a / b) * 100).toFixed(1) : '0.0';

interface Project {
  id: string;
  name: string;
  status: string;
  contract_amount: number;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

interface ProjectDetail {
  project: any;
  payApps: any[];
  changeOrders: any[];
  rfis: any[];
  subs: any[];
  budgetLines: any[];
}

interface ProjectMetrics {
  id: string;
  name: string;
  status: string;
  contractAmount: number;
  totalBilled: number;
  burnRate: number;
  schedulePct: number;
  expectedPct: number;
  coCount: number;
  coTotal: number;
  coPctOfContract: number;
  coRisk: 'green' | 'amber' | 'red';
  coApprovedCount: number;
  coDecidedCount: number;
  coApprovalRate: number;
  openRfis: number;
  retainageHeld: number;
  subCount: number;
  activeSubs: number;
  subHealthScore: number;
}

export default function IntelligencePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [metricsMap, setMetricsMap] = useState<Record<string, ProjectMetrics>>({});
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);

  // Load all projects
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/projects/list');
        const d = await r.json();
        const all: Project[] = (d.projects || []).filter((p: any) => p.status !== 'archived');
        setProjects(all);
        // Auto-select first 3
        const initial = all.slice(0, 3).map((p: Project) => p.id);
        setSelectedIds(new Set(initial));
      } catch {
        setProjects([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load metrics whenever selection changes
  useEffect(() => {
    if (selectedIds.size === 0) return;
    loadMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds]);

  async function loadMetrics() {
    setLoadingMetrics(true);
    const newMetrics: Record<string, ProjectMetrics> = {};

    const fetches = Array.from(selectedIds).map(async (pid) => {
      try {
        const r = await fetch(`/api/projects/${pid}`);
        const d: ProjectDetail = await r.json();
        const p = d.project || {};
        const payApps = d.payApps || [];
        const cos = d.changeOrders || [];
        const rfis = d.rfis || [];
        const subs = d.subs || [];

        const contractAmount = p.contract_amount || 0;
        const approvedCOs = cos.filter((c: any) => c.status === 'approved');
        const coTotal = approvedCOs.reduce((s: number, co: any) => s + (co.amount || 0), 0);

        // Historical CO approval rate — real signal from this project's decided change
        // orders (approved vs. approved+rejected). Not a forecast; only shown when the
        // project actually has decided COs to base a rate on.
        const rejectedCOs = cos.filter((c: any) => ['rejected', 'denied', 'declined'].includes(c.status));
        const coApprovedCount = approvedCOs.length;
        const coDecidedCount = coApprovedCount + rejectedCOs.length;
        const coApprovalRate = coDecidedCount > 0 ? Math.round((coApprovedCount / coDecidedCount) * 100) : 0;
        const adjustedContract = contractAmount + coTotal;
        const totalBilled = payApps.length > 0 ? (payApps[0].total_completed_stored || 0) : 0;
        const burnRate = adjustedContract > 0 ? (totalBilled / adjustedContract) * 100 : 0;

        // Schedule performance estimate
        const startDate = p.start_date ? new Date(p.start_date) : null;
        const endDate = p.end_date ? new Date(p.end_date) : null;
        const now = new Date();
        let expectedPct = 0;
        let schedulePct = burnRate; // Use billing as proxy for % complete
        if (startDate && endDate && endDate > startDate) {
          const totalDays = (endDate.getTime() - startDate.getTime()) / 86400000;
          const elapsed = Math.max(0, (now.getTime() - startDate.getTime()) / 86400000);
          expectedPct = Math.min(100, (elapsed / totalDays) * 100);
        }

        // Change order risk
        const coPct = adjustedContract > 0 ? (coTotal / (contractAmount || 1)) * 100 : 0;
        const coRisk: 'green' | 'amber' | 'red' = coPct > 20 ? 'red' : coPct > 10 ? 'amber' : 'green';

        // RFIs
        const openRfis = rfis.filter((r: any) => r.status === 'open' || r.status === 'pending').length;

        // Retainage
        const retainageHeld = payApps.reduce((s: number, pa: any) => s + (pa.retainage_held || 0), 0);

        // Sub health
        const activeSubs = subs.filter((s: any) => s.status === 'active' || s.status === 'approved').length;
        const subHealthScore = subs.length > 0 ? Math.round((activeSubs / subs.length) * 100) : 100;

        newMetrics[pid] = {
          id: pid,
          name: p.name || 'Untitled Project',
          status: p.status || 'active',
          contractAmount: adjustedContract,
          totalBilled,
          burnRate: Math.round(burnRate * 10) / 10,
          schedulePct: Math.round(schedulePct * 10) / 10,
          expectedPct: Math.round(expectedPct * 10) / 10,
          coCount: cos.length,
          coTotal,
          coPctOfContract: Math.round(coPct * 10) / 10,
          coRisk,
          coApprovedCount,
          coDecidedCount,
          coApprovalRate,
          openRfis,
          retainageHeld,
          subCount: subs.length,
          activeSubs,
          subHealthScore,
        };
      } catch {
        // skip failed projects
      }
    });

    await Promise.all(fetches);
    setMetricsMap(newMetrics);
    setLoadingMetrics(false);
  }

  function toggleProject(pid: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(pid)) {
        next.delete(pid);
      } else {
        if (next.size >= 5) return prev; // max 5
        next.add(pid);
      }
      return next;
    });
  }

  const selected = Array.from(selectedIds).map(id => metricsMap[id]).filter(Boolean);

  // Chart max for bar comparisons
  const maxContract = Math.max(...selected.map(m => m.contractAmount), 1);
  const maxBilled = Math.max(...selected.map(m => m.totalBilled), 1);
  const maxCO = Math.max(...selected.map(m => m.coTotal), 1);
  const maxRfi = Math.max(...selected.map(m => m.openRfis), 1);
  const maxRet = Math.max(...selected.map(m => m.retainageHeld), 1);

  const barColors = ['#F59E0B', '#3dd68c', '#5ba3f5', '#e06be0', '#ff7070'];

  if (loading) {
    return (
      <PremiumSurface maxWidth={1600}>
        <div style={{ padding: 40, textAlign: 'center' as const, color: DIM }}>
          <div style={{ width: 32, height: 32, border: `3px solid ${BORDER}`, borderTopColor: GOLD, borderRadius: '50%', animation: 'intSpin 0.8s linear infinite', margin: '0 auto 12px' }} />
          Loading projects...
          <style>{`@keyframes intSpin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </PremiumSurface>
    );
  }

  return (
    <PremiumSurface maxWidth={1600}>
      <style>{`@keyframes intSpin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <ModuleHero
        eyebrow="Cross-Project Analytics"
        eyebrowIcon={<ChartLineUp size={13} weight="fill" color={GOLD} />}
        title="Project"
        accent="Intelligence"
        subtitle={`Compare ${selected.length} project${selected.length !== 1 ? 's' : ''} side by side.`}
        actions={
          <div style={{ position: 'relative' as const }}>
            <button
              onClick={() => setSelectorOpen(!selectorOpen)}
              style={goldButtonStyle}
              className="pmBtn"
            >
              Select Projects ({selectedIds.size})
            </button>

            {/* Project selector dropdown */}
            {selectorOpen && (
              <div style={{
                position: 'absolute' as const, top: '100%', right: 0, marginTop: 8,
                background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 14,
                padding: 12, minWidth: 320, maxHeight: 400, overflowY: 'auto' as const,
                zIndex: 100, boxShadow: '0 24px 60px -20px rgba(0,0,0,.7)',
              }}>
                <div style={{ fontSize: 11, color: DIM, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 8 }}>
                  Select up to 5 projects
                </div>
                {projects.map((p) => (
                  <label
                    key={p.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                      borderRadius: 8, cursor: 'pointer',
                      background: selectedIds.has(p.id) ? 'rgba(245, 158, 11,0.1)' : 'transparent',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = selectedIds.has(p.id) ? 'rgba(245, 158, 11,0.15)' : 'rgba(255,255,255,0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = selectedIds.has(p.id) ? 'rgba(245, 158, 11,0.1)' : 'transparent'}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={() => toggleProject(p.id)}
                      style={{ accentColor: GOLD, width: 16, height: 16 }}
                    />
                    <div>
                      <div style={{ fontSize: 13, color: TEXT, fontWeight: 600 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: DIM }}>
                        {fmt(p.contract_amount)} &middot; {p.status}
                      </div>
                    </div>
                  </label>
                ))}
                <button
                  onClick={() => setSelectorOpen(false)}
                  style={{ ...goldButtonStyle, width: '100%', padding: '9px 0', marginTop: 8 }}
                  className="pmBtn"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        }
      />

      {loadingMetrics && (
        <div style={{
          textAlign: 'center' as const, padding: '14px 16px', color: DIM, fontSize: 13,
          background: NEST, borderRadius: 12, border: `1px solid ${NEST_BORDER}`, marginBottom: 20,
        }}>
          <span style={{ display: 'inline-block', width: 14, height: 14, border: `2px solid ${BORDER}`, borderTopColor: GOLD, borderRadius: '50%', animation: 'intSpin 0.6s linear infinite', marginRight: 8, verticalAlign: 'middle' }} />
          Loading project metrics...
        </div>
      )}

      {selected.length === 0 && !loadingMetrics && (
        <SectionCard>
          <PremiumEmpty
            icon={<Selection size={30} weight="duotone" color={GOLD} />}
            title="No projects selected"
            description='Click "Select Projects" to choose projects for comparison.'
            action={<button onClick={() => setSelectorOpen(true)} style={goldButtonStyle} className="pmBtn">Select Projects</button>}
          />
        </SectionCard>
      )}

      {selected.length > 0 && (
        <>
          {/* Comparison Cards */}
          <SectionCard
            title="Project Comparison"
            subtitle="Key performance metrics at a glance"
            icon={<SquaresFour size={17} weight="duotone" color={GOLD} />}
            style={{ marginBottom: 24 }}
          >
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.min(selected.length, 3)}, 1fr)`,
              gap: 16,
            }}>
              {selected.map((m) => (
                <div key={m.id} style={{
                  background: NEST, borderRadius: 14, border: `1px solid ${NEST_BORDER}`,
                  padding: '18px', overflow: 'hidden',
                }}>
                  {/* Project header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <Link href={`/app/projects/${m.id}`} style={{ fontSize: 15, fontWeight: 700, color: TEXT, textDecoration: 'none' }}>
                        {m.name}
                      </Link>
                      <div style={{ fontSize: 11, color: DIM, marginTop: 2 }}>{fmtK(m.contractAmount)}</div>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                      background: m.status === 'active' ? 'rgba(69,179,125,0.15)' : 'rgba(203,213,225,0.1)',
                      color: m.status === 'active' ? GREEN : DIM,
                      textTransform: 'uppercase' as const,
                    }}>
                      {m.status}
                    </span>
                  </div>

                  {/* Metrics grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {/* Burn rate */}
                    <div style={{ background: TILE, border: `1px solid ${TILE_BORDER}`, borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 10, color: DIM, fontWeight: 600, textTransform: 'uppercase' as const, marginBottom: 4 }}>
                        Budget Burn
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: m.burnRate > 90 ? RED : m.burnRate > 70 ? AMBER : TEXT }}>
                        {m.burnRate}%
                      </div>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, marginTop: 6 }}>
                        <div style={{ height: '100%', width: `${Math.min(m.burnRate, 100)}%`, borderRadius: 2, background: m.burnRate > 90 ? RED : m.burnRate > 70 ? AMBER : GREEN }} />
                      </div>
                    </div>

                    {/* Schedule */}
                    <div style={{ background: TILE, border: `1px solid ${TILE_BORDER}`, borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 10, color: DIM, fontWeight: 600, textTransform: 'uppercase' as const, marginBottom: 4 }}>
                        Schedule
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: m.schedulePct < m.expectedPct - 10 ? RED : TEXT }}>
                        {m.schedulePct}%
                      </div>
                      <div style={{ fontSize: 10, color: DIM, marginTop: 4 }}>
                        Expected: {m.expectedPct}%
                      </div>
                    </div>

                    {/* Change orders */}
                    <div style={{ background: TILE, border: `1px solid ${TILE_BORDER}`, borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 10, color: DIM, fontWeight: 600, textTransform: 'uppercase' as const, marginBottom: 4 }}>
                        Change Orders
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: m.coRisk === 'red' ? RED : m.coRisk === 'amber' ? AMBER : TEXT }}>
                        {m.coCount}
                      </div>
                      <div style={{ fontSize: 10, color: DIM, marginTop: 4 }}>
                        {fmtK(m.coTotal)} ({m.coPctOfContract}%)
                      </div>
                    </div>

                    {/* Open RFIs */}
                    <div style={{ background: TILE, border: `1px solid ${TILE_BORDER}`, borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 10, color: DIM, fontWeight: 600, textTransform: 'uppercase' as const, marginBottom: 4 }}>
                        Open RFIs
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: m.openRfis > 10 ? RED : m.openRfis > 5 ? AMBER : TEXT }}>
                        {m.openRfis}
                      </div>
                    </div>

                    {/* Retainage */}
                    <div style={{ background: TILE, border: `1px solid ${TILE_BORDER}`, borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 10, color: DIM, fontWeight: 600, textTransform: 'uppercase' as const, marginBottom: 4 }}>
                        Retainage Held
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: GOLD }}>
                        {fmtK(m.retainageHeld)}
                      </div>
                    </div>

                    {/* Sub health */}
                    <div style={{ background: TILE, border: `1px solid ${TILE_BORDER}`, borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 10, color: DIM, fontWeight: 600, textTransform: 'uppercase' as const, marginBottom: 4 }}>
                        Sub Health
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: m.subHealthScore >= 80 ? GREEN : m.subHealthScore >= 50 ? AMBER : RED }}>
                        {m.subHealthScore}%
                      </div>
                      <div style={{ fontSize: 10, color: DIM, marginTop: 4 }}>
                        {m.activeSubs}/{m.subCount} active
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Side-by-Side Bar Chart Comparison */}
          <SectionCard
            title="Metric Comparison"
            subtitle="Side-by-side visualization across selected projects"
            icon={<ChartBar size={17} weight="duotone" color={GOLD} />}
            style={{ marginBottom: 24 }}
          >
            {/* Legend */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' as const }}>
              {selected.map((m, idx) => (
                <span key={m.id} style={{ fontSize: 11, color: DIM, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: barColors[idx % barColors.length] }} />
                  {m.name}
                </span>
              ))}
            </div>

            {/* Chart rows */}
            {[
              { label: 'Contract Value', values: selected.map(m => m.contractAmount), max: maxContract, formatter: fmtK },
              { label: 'Total Billed', values: selected.map(m => m.totalBilled), max: maxBilled, formatter: fmtK },
              { label: 'Change Orders', values: selected.map(m => m.coTotal), max: maxCO > 0 ? maxCO : 1, formatter: fmtK },
              { label: 'Open RFIs', values: selected.map(m => m.openRfis), max: maxRfi > 0 ? maxRfi : 1, formatter: (n: number) => String(n) },
              { label: 'Retainage Held', values: selected.map(m => m.retainageHeld), max: maxRet > 0 ? maxRet : 1, formatter: fmtK },
            ].map((row) => (
              <div key={row.label} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: DIM, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
                  {row.label}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {row.values.map((val, idx) => {
                    const widthPct = row.max > 0 ? (val / row.max) * 100 : 0;
                    return (
                      <div key={idx} style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 20, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', width: `${Math.max(widthPct, 2)}%`,
                              background: barColors[idx % barColors.length],
                              borderRadius: 4, transition: 'width 0.5s ease',
                              opacity: 0.8,
                            }} />
                          </div>
                          <span style={{ fontSize: 11, color: TEXT, fontWeight: 600, minWidth: 60, textAlign: 'right' as const }}>
                            {row.formatter(val)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </SectionCard>

          {/* AI Change Order Risk Scoring */}
          <SectionCard
            title="Change Order Risk Assessment"
            subtitle="AI-analyzed risk based on change order volume as percentage of original contract"
            icon={<Warning size={17} weight="duotone" color={GOLD} />}
            style={{ marginBottom: 24 }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(selected.length, 3)}, 1fr)`, gap: 16 }}>
              {selected.map((m) => {
                const riskColor = m.coRisk === 'red' ? RED : m.coRisk === 'amber' ? AMBER : GREEN;
                const riskLabel = m.coRisk === 'red' ? 'HIGH RISK' : m.coRisk === 'amber' ? 'MODERATE RISK' : 'LOW RISK';
                const rateColor = m.coApprovalRate >= 70 ? GREEN : m.coApprovalRate >= 50 ? AMBER : RED;

                return (
                  <div key={m.id} style={{
                    background: NEST, borderRadius: 12, padding: '16px',
                    border: `1px solid ${m.coRisk === 'red' ? 'rgba(224,100,78,0.3)' : m.coRisk === 'amber' ? 'rgba(240,166,60,0.3)' : NEST_BORDER}`,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 10 }}>{m.name}</div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 4,
                        background: `${riskColor}22`, color: riskColor, letterSpacing: 0.5,
                      }}>
                        {riskLabel}
                      </span>
                      <span style={{ fontSize: 20, fontWeight: 800, color: riskColor }}>{m.coPctOfContract}%</span>
                    </div>

                    <div style={{ fontSize: 11, color: DIM, marginBottom: 8 }}>
                      {m.coCount} change order{m.coCount !== 1 ? 's' : ''} totaling {fmtK(m.coTotal)}
                    </div>

                    {/* Risk gauge */}
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, marginBottom: 10, position: 'relative' as const }}>
                      {/* Threshold markers */}
                      <div style={{ position: 'absolute' as const, left: '50%', top: -2, width: 1, height: 10, background: AMBER, opacity: 0.5 }} title="10% threshold" />
                      <div style={{ position: 'absolute' as const, left: '100%', top: -2, width: 1, height: 10, background: RED, opacity: 0.5 }} title="20% threshold" />
                      <div style={{
                        height: '100%', width: `${Math.min((m.coPctOfContract / 25) * 100, 100)}%`,
                        background: riskColor, borderRadius: 3,
                      }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: DIM }}>
                      <span>0%</span>
                      <span style={{ color: AMBER }}>10%</span>
                      <span style={{ color: RED }}>20%+</span>
                    </div>

                    {/* Historical CO approval rate — only rendered when the project has
                        decided change orders to compute a real rate from. No decided COs
                        ⇒ no meter (rather than a fabricated number). */}
                    {m.coDecidedCount > 0 && (
                      <div style={{
                        marginTop: 12, background: 'rgba(245, 158, 11,0.06)', borderRadius: 8,
                        padding: '10px 12px', border: '1px solid rgba(245, 158, 11,0.15)',
                      }}>
                        <div style={{ fontSize: 10, color: DIM, fontWeight: 600, textTransform: 'uppercase' as const, marginBottom: 4 }}>
                          Historical CO Approval Rate
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3 }}>
                            <div style={{
                              height: '100%', width: `${m.coApprovalRate}%`,
                              background: rateColor,
                              borderRadius: 3,
                            }} />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: rateColor }}>
                            {m.coApprovalRate}%
                          </span>
                        </div>
                        <div style={{ fontSize: 10, color: DIM, marginTop: 6 }}>
                          {m.coApprovedCount} of {m.coDecidedCount} decided change order{m.coDecidedCount !== 1 ? 's' : ''} approved
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* Sub Health Scorecard Summary */}
          <SectionCard
            title="Subcontractor Health Summary"
            subtitle="Active vs total subcontractor engagement across projects"
            icon={<Heartbeat size={17} weight="duotone" color={GOLD} />}
          >
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(selected.length, 5)}, 1fr)`, gap: 12 }}>
              {selected.map((m) => {
                const healthColor = m.subHealthScore >= 80 ? GREEN : m.subHealthScore >= 50 ? AMBER : RED;
                return (
                  <div key={m.id} style={{ background: TILE, border: `1px solid ${TILE_BORDER}`, borderRadius: 12, padding: '16px', textAlign: 'center' as const }}>
                    {/* Circular gauge */}
                    <div style={{ position: 'relative' as const, width: 80, height: 80, margin: '0 auto 10px' }}>
                      <svg width="80" height="80" viewBox="0 0 80 80">
                        <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                        <circle
                          cx="40" cy="40" r="34" fill="none"
                          stroke={healthColor} strokeWidth="8"
                          strokeDasharray={`${(m.subHealthScore / 100) * 213.6} 213.6`}
                          strokeLinecap="round"
                          transform="rotate(-90 40 40)"
                        />
                      </svg>
                      <div style={{
                        position: 'absolute' as const, top: '50%', left: '50%',
                        transform: 'translate(-50%, -50%)',
                        fontSize: 18, fontWeight: 800, color: healthColor,
                      }}>
                        {m.subHealthScore}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: TEXT, marginBottom: 4 }}>{m.name}</div>
                    <div style={{ fontSize: 11, color: DIM }}>
                      {m.activeSubs} active / {m.subCount} total
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </>
      )}
    </PremiumSurface>
  );
}
