'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Skeleton } from '../../../components/ui/Skeleton';
import { WarningCircle } from '@phosphor-icons/react';

const GOLD = '#D4A017';
const DARK = '#0d1117';
const RAISED = '#1f2c3e';
const BORDER = '#263347';
const DIM = '#8fa3c0';
const TEXT = '#e8edf8';
const GREEN = '#3dd68c';
const RED = '#ef4444';

const fmt = (n: number | null | undefined) =>
  '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Badge({ label, color = '#94a3b8', bg = 'rgba(148,163,184,.12)' }: { label: string; color?: string; bg?: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px',
      borderRadius: 4, background: bg, color,
      textTransform: 'uppercase', letterSpacing: 0.3,
    }}>{label}</span>
  );
}

// In-table error row: a clear failure state with a Retry action, visually
// distinct from the genuine empty state. Used when a list fetch fails or 404s.
function ErrorRow({ colSpan, message, onRetry }: { colSpan: number; message: string; onRetry: () => void }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ padding: '40px 16px', textAlign: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <WarningCircle size={32} weight="duotone" color={RED} />
          <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{message}</div>
          <button
            onClick={onRetry}
            style={{
              padding: '7px 18px',
              background: `linear-gradient(135deg,${GOLD},#F0C040)`,
              border: 'none', borderRadius: 7,
              color: '#0d1117', fontSize: 12, fontWeight: 800, cursor: 'pointer',
            }}
          >Retry</button>
        </div>
      </td>
    </tr>
  );
}

// Skeleton placeholder rows shown while a list fetch is in flight — never
// computed zeros or an empty state during loading.
function SkeletonRows({ rows = 4, cols }: { rows?: number; cols: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} style={{ borderBottom: `1px solid rgba(38,51,71,.5)` }}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} style={{ padding: '12px 16px' }}>
              <Skeleton height={14} width={c === 0 ? '50%' : '70%'} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

const TABS = ['Pay Applications', 'Lien Waivers', 'Bonds & Forms', 'Payroll', 'Closeout'] as const;
type Tab = typeof TABS[number];

const BOND_CARDS = [
  { code: 'A310', name: 'Bid Bond', desc: 'AIA A310 – Bid bond for proposal phase', icon: '📋' },
  { code: 'A312-P', name: 'Performance Bond', desc: 'AIA A312 – Performance bond for contract execution', icon: '🛡️' },
  { code: 'A312-L', name: 'Labor & Material Bond', desc: 'AIA A312 – Payment bond for labor and materials', icon: '⚒️' },
  { code: 'G704', name: 'Certificate of Substantial Completion', desc: 'AIA G704 – Substantial completion certification', icon: '🏗️' },
  { code: 'G706', name: "Contractor's Affidavit of Payment", desc: "AIA G706 – Contractor's affidavit of release of liens", icon: '📝' },
  { code: 'G707', name: "Consent of Surety", desc: 'AIA G707 – Consent of surety to final payment', icon: '✅' },
];

const CLOSEOUT_CHECKLIST = [
  { label: 'Substantial Completion Inspection', done: true },
  { label: 'Punch List Completed (100%)', done: false },
  { label: 'Certificate of Occupancy', done: false },
  { label: 'As-Built Drawings Submitted', done: true },
  { label: "Owner's Manuals & Warranties", done: false },
  { label: 'Final Lien Waivers (All Subs)', done: false },
  { label: "Contractor's Affidavit (G706)", done: false },
  { label: 'Consent of Surety (G707)', done: false },
  { label: 'Final Pay Application Certified', done: false },
  { label: 'Retainage Released', done: false },
];

const statusConfig: Record<string, { color: string; bg: string }> = {
  paid:      { color: GREEN,   bg: 'rgba(61,214,140,.12)' },
  approved:  { color: '#4a9de8', bg: 'rgba(26,95,168,.12)' },
  draft:     { color: GOLD,    bg: 'rgba(212,160,23,.12)' },
  executed:  { color: GREEN,   bg: 'rgba(61,214,140,.12)' },
  pending:   { color: GOLD,    bg: 'rgba(212,160,23,.12)' },
  submitted: { color: '#4a9de8', bg: 'rgba(26,95,168,.12)' },
};

// AIA bond/form card code -> { route, body } using existing /api/documents/* generators.
const BOND_ROUTES: Record<string, { path: string; body: (projectId: string) => Record<string, unknown> }> = {
  'A310':   { path: '/api/documents/a310', body: (projectId) => ({ projectId }) },
  'A312-P': { path: '/api/documents/a312', body: (projectId) => ({ projectId, bondType: 'performance' }) },
  'A312-L': { path: '/api/documents/a312', body: (projectId) => ({ projectId, bondType: 'payment' }) },
  'G704':   { path: '/api/documents/g704', body: (projectId) => ({ projectId }) },
  'G706':   { path: '/api/documents/g706', body: (projectId) => ({ projectId }) },
  'G707':   { path: '/api/documents/g707', body: (projectId) => ({ projectId }) },
};

export default function DocumentsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Pay Applications');
  const [payApps, setPayApps] = useState<any[]>([]);
  const [lienWaivers, setLienWaivers] = useState<any[]>([]);
  const [payroll, setPayroll] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [loadingPayApps, setLoadingPayApps] = useState(true);
  const [loadingLienWaivers, setLoadingLienWaivers] = useState(true);
  const [loadingPayroll, setLoadingPayroll] = useState(true);
  const [errorPayApps, setErrorPayApps] = useState(false);
  const [errorLienWaivers, setErrorLienWaivers] = useState(false);
  const [errorPayroll, setErrorPayroll] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const loadPayApps = useCallback(() => {
    setLoadingPayApps(true);
    setErrorPayApps(false);
    fetch('/api/pay-apps/list')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => setPayApps(d.payApps ?? d.items ?? []))
      .catch(() => setErrorPayApps(true))
      .finally(() => setLoadingPayApps(false));
  }, []);

  const loadLienWaivers = useCallback(() => {
    setLoadingLienWaivers(true);
    setErrorLienWaivers(false);
    fetch('/api/lien-waivers/list')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => setLienWaivers(d.lienWaivers ?? d.items ?? []))
      .catch(() => setErrorLienWaivers(true))
      .finally(() => setLoadingLienWaivers(false));
  }, []);

  const loadPayroll = useCallback(() => {
    setLoadingPayroll(true);
    setErrorPayroll(false);
    fetch('/api/documents/list?type=payroll')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => setPayroll(d.payroll ?? d.documents ?? d.items ?? []))
      .catch(() => setErrorPayroll(true))
      .finally(() => setLoadingPayroll(false));
  }, []);

  useEffect(() => { loadPayApps(); }, [loadPayApps]);
  useEffect(() => { loadLienWaivers(); }, [loadLienWaivers]);
  useEffect(() => { loadPayroll(); }, [loadPayroll]);

  useEffect(() => {
    fetch('/api/projects/list')
      .then(r => r.json())
      .then(d => {
        const list = d.projects ?? d.items ?? [];
        setProjects(list);
        if (list.length) setSelectedProject(list[0].id);
      })
      .catch(() => setProjects([]));
  }, []);

  // Open an already-saved PDF, or POST to a generator route and open the returned URL.
  async function openOrGenerate(
    key: string,
    existingUrl: string | null | undefined,
    gen: { path: string; body: Record<string, unknown>; urlField?: string } | null,
  ) {
    if (existingUrl) { window.open(existingUrl, '_blank'); return; }
    if (!gen) { alert('No document available to download.'); return; }
    setBusyKey(key);
    try {
      const res = await fetch(gen.path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gen.body),
      });
      const data = await res.json();
      const url = data[gen.urlField ?? 'pdfUrl'] ?? data.pdfUrl ?? data.g702Url;
      if (!res.ok || !url) { alert(data.error || 'Document generation failed.'); return; }
      window.open(url, '_blank');
    } catch {
      alert('Document generation failed.');
    } finally {
      setBusyKey(null);
    }
  }

  function requireProject(): string | null {
    if (selectedProject) return selectedProject;
    alert('Select a project first.');
    return null;
  }

  const projectSelectStyle: React.CSSProperties = {
    background: '#0a1117', border: `1px solid ${BORDER}`, borderRadius: 7,
    color: TEXT, fontSize: 13, fontWeight: 600, padding: '8px 12px', cursor: 'pointer',
  };

  return (
    <div style={{ background: DARK, minHeight: '100%' }}>

      {/* Page Header */}
      <div style={{
        padding: '18px 28px', borderBottom: `1px solid ${BORDER}`,
        background: DARK,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: TEXT }}>Documents</h2>
          <div style={{ fontSize: 12, color: DIM, marginTop: 3 }}>Generated contracts, forms, and compliance documents across all projects</div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 0,
        borderBottom: `1px solid ${BORDER}`,
        background: '#0a1117', paddingLeft: 24,
        overflowX: 'auto',
      }}>
        {TABS.map(tab => {
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '12px 20px',
                background: 'none',
                border: 'none',
                borderBottom: `2px solid ${active ? GOLD : 'transparent'}`,
                color: active ? GOLD : DIM,
                fontSize: 13, fontWeight: active ? 700 : 500,
                cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'all .15s',
              }}
            >{tab}</button>
          );
        })}
      </div>

      {/* Tab content */}
      <div style={{ padding: 24 }}>

        {/* ── Pay Applications ──────────────────────────────────────── */}
        {activeTab === 'Pay Applications' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Pay Applications (AIA G702 / G703)</div>
              <Link href="/app/projects" style={{
                padding: '8px 16px',
                background: `linear-gradient(135deg,${GOLD},#F0C040)`,
                borderRadius: 7, color: '#0d1117', fontSize: 13, fontWeight: 800,
                textDecoration: 'none',
              }}>+ Generate New</Link>
            </div>
            <div style={{ background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#0a1117' }}>
                    {['Application #', 'Period', 'Amount Due', 'Status', 'Download'].map(h => (
                      <th key={h} style={{
                        padding: '10px 16px', textAlign: 'left',
                        fontSize: 11, fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: 0.5,
                        color: DIM, borderBottom: `1px solid ${BORDER}`,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loadingPayApps ? (
                    <SkeletonRows cols={5} />
                  ) : errorPayApps ? (
                    <ErrorRow colSpan={5} message="Couldn't load pay applications" onRetry={loadPayApps} />
                  ) : payApps.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: '48px 16px', textAlign: 'center', color: DIM, fontSize: 13 }}>No pay applications yet.</td></tr>
                  ) : payApps.map(pa => {
                    const sc = statusConfig[pa.status] || statusConfig.draft;
                    return (
                      <tr key={pa.id} style={{ borderBottom: `1px solid rgba(38,51,71,.5)` }}>
                        <td style={{ padding: '12px 16px', color: GOLD, fontWeight: 700 }}>#{(pa.appNo ?? pa.app_no ?? '').toString().padStart(3, '0')}</td>
                        <td style={{ padding: '12px 16px', color: DIM }}>{pa.period}</td>
                        <td style={{ padding: '12px 16px', color: TEXT, fontWeight: 600 }}>{fmt(pa.amount)}</td>
                        <td style={{ padding: '12px 16px' }}><Badge label={pa.status} color={sc.color} bg={sc.bg} /></td>
                        <td style={{ padding: '12px 16px' }}>
                          <button
                            disabled={busyKey === `payapp-${pa.id}`}
                            onClick={() => openOrGenerate(
                              `payapp-${pa.id}`,
                              pa.g702_pdf_url ?? pa.g702Url,
                              { path: '/api/documents/pay-application', body: { payAppId: pa.id, projectId: pa.project_id ?? pa.projectId }, urlField: 'g702Url' },
                            )}
                            style={{
                              background: 'none', border: `1px solid ${BORDER}`,
                              borderRadius: 5, color: GOLD, fontSize: 11,
                              padding: '3px 10px', cursor: 'pointer',
                              opacity: busyKey === `payapp-${pa.id}` ? 0.5 : 1,
                            }}>{busyKey === `payapp-${pa.id}` ? '…' : '📄 G702 PDF'}</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Lien Waivers ──────────────────────────────────────────── */}
        {activeTab === 'Lien Waivers' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Lien Waivers</div>
              <Link href="/app/projects" style={{
                padding: '8px 16px',
                background: `linear-gradient(135deg,${GOLD},#F0C040)`,
                borderRadius: 7, color: '#0d1117', fontSize: 13, fontWeight: 800,
                textDecoration: 'none',
              }}>+ Generate New</Link>
            </div>
            <div style={{ background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#0a1117' }}>
                    {['Sub Name', 'Type', 'Amount', 'Through Date', 'Status', 'Download'].map(h => (
                      <th key={h} style={{
                        padding: '10px 16px', textAlign: 'left',
                        fontSize: 11, fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: 0.5,
                        color: DIM, borderBottom: `1px solid ${BORDER}`,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loadingLienWaivers ? (
                    <SkeletonRows cols={6} />
                  ) : errorLienWaivers ? (
                    <ErrorRow colSpan={6} message="Couldn't load lien waivers" onRetry={loadLienWaivers} />
                  ) : lienWaivers.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: '48px 16px', textAlign: 'center', color: DIM, fontSize: 13 }}>No lien waivers yet.</td></tr>
                  ) : lienWaivers.map(lw => {
                    const sc = statusConfig[lw.status] || statusConfig.pending;
                    return (
                      <tr key={lw.id} style={{ borderBottom: `1px solid rgba(38,51,71,.5)` }}>
                        <td style={{ padding: '12px 16px', color: TEXT, fontWeight: 600 }}>{lw.subName ?? lw.sub_name}</td>
                        <td style={{ padding: '12px 16px', color: DIM }}>{lw.type}</td>
                        <td style={{ padding: '12px 16px', color: TEXT }}>{fmt(lw.amount)}</td>
                        <td style={{ padding: '12px 16px', color: DIM }}>{lw.throughDate ?? lw.through_date}</td>
                        <td style={{ padding: '12px 16px' }}><Badge label={lw.status} color={sc.color} bg={sc.bg} /></td>
                        <td style={{ padding: '12px 16px' }}>
                          <button
                            disabled={busyKey === `lw-${lw.id}`}
                            onClick={() => openOrGenerate(
                              `lw-${lw.id}`,
                              lw.signed_pdf_url ?? lw.pdf_url ?? lw.pdfUrl,
                              {
                                path: '/api/lien-waivers/generate',
                                body: {
                                  projectId: lw.project_id ?? lw.projectId,
                                  waiverType: lw.waiver_type ?? lw.type,
                                  claimantName: lw.claimant_name ?? lw.subName ?? lw.sub_name,
                                  amount: lw.amount,
                                  throughDate: lw.through_date ?? lw.throughDate,
                                  state: lw.state,
                                },
                              },
                            )}
                            style={{
                              background: 'none', border: `1px solid ${BORDER}`,
                              borderRadius: 5, color: GOLD, fontSize: 11,
                              padding: '3px 10px', cursor: 'pointer',
                              opacity: busyKey === `lw-${lw.id}` ? 0.5 : 1,
                            }}>{busyKey === `lw-${lw.id}` ? '…' : '📄 Download'}</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Bonds & Forms ─────────────────────────────────────────── */}
        {activeTab === 'Bonds & Forms' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>AIA Bonds & Standard Forms</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <select
                  value={selectedProject}
                  onChange={e => setSelectedProject(e.target.value)}
                  style={projectSelectStyle}
                >
                  {projects.length === 0 && <option value="">No projects</option>}
                  {projects.map(pr => (
                    <option key={pr.id} value={pr.id}>{pr.name ?? pr.project_number ?? pr.id}</option>
                  ))}
                </select>
                <button
                  disabled={busyKey === 'bond-new'}
                  onClick={() => {
                    const projectId = requireProject();
                    if (!projectId) return;
                    openOrGenerate('bond-new', null, { ...BOND_ROUTES['A312-P'], body: BOND_ROUTES['A312-P'].body(projectId) });
                  }}
                  style={{
                    padding: '8px 16px',
                    background: `linear-gradient(135deg,${GOLD},#F0C040)`,
                    border: 'none', borderRadius: 7,
                    color: '#0d1117', fontSize: 13, fontWeight: 800, cursor: 'pointer',
                    opacity: busyKey === 'bond-new' ? 0.6 : 1,
                  }}>{busyKey === 'bond-new' ? 'Generating…' : '+ Generate New'}</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {BOND_CARDS.map(card => (
                <div key={card.code} style={{
                  background: RAISED, border: `1px solid ${BORDER}`,
                  borderRadius: 10, padding: 20,
                  display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 28 }}>{card.icon}</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 13, color: TEXT }}>{card.name}</div>
                      <div style={{ fontSize: 11, color: GOLD, fontWeight: 700 }}>{card.code}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: DIM, lineHeight: 1.5 }}>{card.desc}</div>
                  <button
                    disabled={busyKey === `bond-${card.code}` || !BOND_ROUTES[card.code]}
                    onClick={() => {
                      const route = BOND_ROUTES[card.code];
                      if (!route) { alert(`No generator for ${card.code}.`); return; }
                      const projectId = requireProject();
                      if (!projectId) return;
                      openOrGenerate(`bond-${card.code}`, null, { ...route, body: route.body(projectId) });
                    }}
                    style={{
                      marginTop: 4, padding: '8px 0', width: '100%',
                      background: `linear-gradient(135deg,${GOLD},#F0C040)`,
                      border: 'none', borderRadius: 7,
                      color: '#0d1117', fontSize: 12, fontWeight: 800, cursor: 'pointer',
                      opacity: busyKey === `bond-${card.code}` ? 0.6 : 1,
                    }}>{busyKey === `bond-${card.code}` ? 'Generating…' : `Generate ${card.code}`}</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Payroll ───────────────────────────────────────────────── */}
        {activeTab === 'Payroll' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Certified Payroll (WH-347)</div>
              <Link href="/app/projects" style={{
                padding: '8px 16px',
                background: `linear-gradient(135deg,${GOLD},#F0C040)`,
                borderRadius: 7, color: '#0d1117', fontSize: 13, fontWeight: 800,
                textDecoration: 'none',
              }}>+ Generate WH-347</Link>
            </div>
            <div style={{ background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#0a1117' }}>
                    {['Week Ending', '# Employees', 'Total Gross', 'Status', 'Download'].map(h => (
                      <th key={h} style={{
                        padding: '10px 16px', textAlign: 'left',
                        fontSize: 11, fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: 0.5,
                        color: DIM, borderBottom: `1px solid ${BORDER}`,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loadingPayroll ? (
                    <SkeletonRows cols={5} />
                  ) : errorPayroll ? (
                    <ErrorRow colSpan={5} message="Couldn't load certified payroll" onRetry={loadPayroll} />
                  ) : payroll.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: '48px 16px', textAlign: 'center', color: DIM, fontSize: 13 }}>No certified payroll records yet.</td></tr>
                  ) : payroll.map(pr => {
                    const sc = statusConfig[pr.status] || statusConfig.draft;
                    return (
                      <tr key={pr.id} style={{ borderBottom: `1px solid rgba(38,51,71,.5)` }}>
                        <td style={{ padding: '12px 16px', color: TEXT, fontWeight: 600 }}>{pr.weekEnding ?? pr.week_ending}</td>
                        <td style={{ padding: '12px 16px', color: DIM }}>{pr.employees}</td>
                        <td style={{ padding: '12px 16px', color: TEXT }}>{fmt(pr.totalGross ?? pr.total_gross ?? 0)}</td>
                        <td style={{ padding: '12px 16px' }}><Badge label={pr.status} color={sc.color} bg={sc.bg} /></td>
                        <td style={{ padding: '12px 16px' }}>
                          <button
                            onClick={() => openOrGenerate(
                              `pr-${pr.id}`,
                              pr.pdf_url ?? pr.pdfUrl ?? pr.url ?? pr.file_url,
                              null,
                            )}
                            style={{
                              background: 'none', border: `1px solid ${BORDER}`,
                              borderRadius: 5, color: GOLD, fontSize: 11,
                              padding: '3px 10px', cursor: 'pointer',
                            }}>📄 WH-347</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Closeout ──────────────────────────────────────────────── */}
        {activeTab === 'Closeout' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Closeout Checklist</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <select
                  value={selectedProject}
                  onChange={e => setSelectedProject(e.target.value)}
                  style={projectSelectStyle}
                >
                  {projects.length === 0 && <option value="">No projects</option>}
                  {projects.map(pr => (
                    <option key={pr.id} value={pr.id}>{pr.name ?? pr.project_number ?? pr.id}</option>
                  ))}
                </select>
                <button
                  disabled={busyKey === 'closeout'}
                  onClick={() => {
                    const projectId = requireProject();
                    if (!projectId) return;
                    openOrGenerate('closeout', null, { path: '/api/documents/closeout', body: { projectId } });
                  }}
                  style={{
                    padding: '8px 16px',
                    background: `linear-gradient(135deg,${GOLD},#F0C040)`,
                    border: 'none', borderRadius: 7,
                    color: '#0d1117', fontSize: 13, fontWeight: 800, cursor: 'pointer',
                    opacity: busyKey === 'closeout' ? 0.6 : 1,
                  }}>{busyKey === 'closeout' ? 'Generating…' : '+ Export Closeout Package'}</button>
              </div>
            </div>

            {/* Progress bar */}
            {(() => {
              const done = CLOSEOUT_CHECKLIST.filter(i => i.done).length;
              const pct = Math.round((done / CLOSEOUT_CHECKLIST.length) * 100);
              return (
                <div style={{
                  background: RAISED, border: `1px solid ${BORDER}`,
                  borderRadius: 10, padding: 20, marginBottom: 20,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>Closeout Progress</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: GOLD }}>{done} / {CLOSEOUT_CHECKLIST.length} items ({pct}%)</span>
                  </div>
                  <div style={{ height: 8, background: 'rgba(255,255,255,.06)', borderRadius: 4 }}>
                    <div style={{
                      height: '100%', width: `${pct}%`,
                      background: `linear-gradient(90deg,${GOLD},#F0C040)`,
                      borderRadius: 4, transition: 'width .3s',
                    }} />
                  </div>
                </div>
              );
            })()}

            <div style={{ background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
              {CLOSEOUT_CHECKLIST.map((item, idx) => (
                <div
                  key={item.label}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 20px',
                    borderBottom: idx < CLOSEOUT_CHECKLIST.length - 1 ? `1px solid rgba(38,51,71,.5)` : 'none',
                    background: item.done ? 'rgba(61,214,140,.03)' : 'transparent',
                  }}
                >
                  <span style={{ fontSize: 18 }}>{item.done ? '✅' : '⬜'}</span>
                  <span style={{
                    fontSize: 13, fontWeight: 500,
                    color: item.done ? TEXT : DIM,
                    textDecoration: item.done ? 'none' : 'none',
                  }}>{item.label}</span>
                  <div style={{ marginLeft: 'auto' }}>
                    <Badge
                      label={item.done ? 'Complete' : 'Pending'}
                      color={item.done ? GREEN : GOLD}
                      bg={item.done ? 'rgba(61,214,140,.12)' : 'rgba(212,160,23,.1)'}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
