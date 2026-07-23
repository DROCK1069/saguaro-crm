'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { EmptyState } from '../../../components/EmptyState';
import { SkeletonRow } from '../../../components/ui/Skeleton';
import { UsersThree, WarningCircle } from '@phosphor-icons/react';
import { useToast } from '@/components/Toast';

/* ─── Palette ─── */
const BG = '#0d1117', CARD = '#0F172A', GOLD = '#F59E0B', GREEN = '#34C759';
const BORDER = 'rgba(255,255,255,0.12)', TEXT = '#FFFFFF', DIM = '#CBD5E1', DARK = '#0d1117';
const RED = '#FF3B30', AMBER = '#FF9500', BLUE = '#007AFF', PURPLE = '#AF52DE';

const glass: React.CSSProperties = {
  background: `${CARD}CC`, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
  border: `1px solid ${BORDER}`, borderRadius: 16,
};

/* ─── Types ─── */
type CustomerStatus = 'lead' | 'qualified' | 'proposal' | 'customer' | 'lost';
type Customer = {
  id: string; name: string; email: string; phone: string; state: string;
  city: string; climate_zone: string; utility_rate: number;
  status: CustomerStatus; lead_score: number; source: string;
  created_at: string; updated_at: string;
  discovery_answers?: Record<string, string>;
  recommendations?: { id: string; title: string; status: 'accepted' | 'rejected' | 'pending' }[];
  design_sessions?: { id: string; room: string; style: string; date: string }[];
  material_selections?: { name: string; qty: number; cost: number }[];
  conversations?: { date: string; preview: string }[];
  score_breakdown?: { engagement: number; budget: number; timeline: number; fit: number };
};

const STATUS_COLORS: Record<CustomerStatus, string> = {
  lead: BLUE, qualified: AMBER, proposal: GOLD, customer: GREEN, lost: RED,
};
const STATUSES: CustomerStatus[] = ['lead', 'qualified', 'proposal', 'customer', 'lost'];
const SOURCES = ['Website', 'Design Studio', 'Referral', 'Social Media', 'Sage Chat', 'ROI Calculator', 'Direct'];
const STATES_LIST = ['AZ', 'CA', 'CO', 'FL', 'GA', 'IL', 'MA', 'MI', 'MN', 'NC', 'NJ', 'NV', 'NY', 'OH', 'OR', 'PA', 'TX', 'VA', 'WA', 'WI'];

/* ─── Helpers ─── */
const fmt = (n: number | null | undefined) => '$' + (n ?? 0).toLocaleString();
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '\u2014';

export default function CustomersPage() {
  const { showToast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterState, setFilterState] = useState<string>('all');
  const [selected, setSelected] = useState<Customer | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'discovery' | 'recommendations' | 'designs' | 'materials' | 'conversations'>('overview');

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/customers/profiles');
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = await res.json();
      setCustomers(Array.isArray(data?.customers) ? data.customers : []);
    } catch {
      setError(true);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    let list = customers;
    if (filterStatus !== 'all') list = list.filter(c => c.status === filterStatus);
    if (filterSource !== 'all') list = list.filter(c => c.source === filterSource);
    if (filterState !== 'all') list = list.filter(c => c.state === filterState);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => b.lead_score - a.lead_score);
  }, [customers, filterStatus, filterSource, filterState, search]);

  const exportCSV = useCallback(() => {
    const headers = ['Name', 'Email', 'Phone', 'State', 'City', 'Status', 'Lead Score', 'Source', 'Created'];
    const rows = filtered.map(c => [
      c.name, c.email, c.phone, c.state, c.city, c.status, c.lead_score, c.source, c.created_at,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `saguaro_leads_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }, [filtered]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: customers.length };
    STATUSES.forEach(s => { counts[s] = customers.filter(c => c.status === s).length; });
    return counts;
  }, [customers]);

  /* ─── Score Color ─── */
  const scoreColor = (s: number) => s >= 80 ? GREEN : s >= 50 ? AMBER : RED;

  /* ─── Assign customer to a new project ─── */
  const assignToProject = useCallback(async (c: Customer) => {
    if (assigning) return;
    setAssigning(true);
    try {
      const res = await fetch('/api/projects/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: c.id, name: `${c.name} Project` }),
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      showToast(`Project created for ${c.name}`, 'success');
      await load();
    } catch {
      showToast('Could not create project. Please try again.', 'error');
    } finally {
      setAssigning(false);
    }
  }, [assigning, load, showToast]);

  /* ─── Detail View ─── */
  if (selected) {
    const c = selected;
    const sb = c.score_breakdown || { engagement: 0, budget: 0, timeline: 0, fit: 0 };
    return (
      <div style={{ minHeight: '100vh', background: BG, color: TEXT, padding: 20 }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          {/* Back button */}
          <button onClick={() => setSelected(null)} style={{
            padding: '8px 16px', background: 'transparent', border: `1px solid ${BORDER}`,
            borderRadius: 8, color: DIM, cursor: 'pointer', fontSize: 13, marginBottom: 20,
          }}>
            &larr; Back to Customers
          </button>

          {/* Header Card */}
          <div style={{ ...glass, padding: 24, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{c.name}</h1>
                <div style={{ color: DIM, fontSize: 14 }}>{c.email} | {c.phone}</div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{
                  padding: '4px 14px', borderRadius: 99, fontSize: 12, fontWeight: 700,
                  background: `${STATUS_COLORS[c.status]}20`, color: STATUS_COLORS[c.status],
                  border: `1px solid ${STATUS_COLORS[c.status]}40`, textTransform: 'capitalize',
                }}>{c.status}</div>
                <div style={{
                  width: 48, height: 48, borderRadius: 12, background: `${scoreColor(c.lead_score)}15`,
                  border: `2px solid ${scoreColor(c.lead_score)}`, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 800, color: scoreColor(c.lead_score),
                }}>{c.lead_score}</div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
            {(['overview', 'discovery', 'recommendations', 'designs', 'materials', 'conversations'] as const).map(tab => (
              <button key={tab} onClick={() => setDetailTab(tab)} style={{
                padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                border: `1px solid ${detailTab === tab ? GOLD : BORDER}`,
                background: detailTab === tab ? `${GOLD}18` : 'transparent',
                color: detailTab === tab ? GOLD : DIM,
                cursor: 'pointer', textTransform: 'capitalize', whiteSpace: 'nowrap',
              }}>{tab}</button>
            ))}
          </div>

          {/* Tab Content */}
          {detailTab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {/* Geo Info */}
              <div style={{ ...glass, padding: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: GOLD }}>Location & Geo</h3>
                <div style={{ display: 'grid', gap: 10 }}>
                  {[
                    ['City', c.city || '\u2014'],
                    ['State', c.state],
                    ['Climate Zone', c.climate_zone || '\u2014'],
                    ['Utility Rate', c.utility_rate ? `$${c.utility_rate}/kWh` : '\u2014'],
                    ['Source', c.source],
                    ['Created', fmtDate(c.created_at)],
                  ].map(([label, val]) => (
                    <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, color: DIM }}>{label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lead Score Breakdown */}
              <div style={{ ...glass, padding: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: GOLD }}>Lead Score Breakdown</h3>
                {Object.entries(sb).map(([key, val]) => (
                  <div key={key} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, textTransform: 'capitalize', color: DIM }}>{key}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor(val) }}>{val}%</span>
                    </div>
                    <div style={{ height: 6, background: BORDER, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        width: `${val}%`, height: '100%', background: scoreColor(val),
                        borderRadius: 3, transition: 'width .5s ease',
                      }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div style={{ ...glass, padding: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: GOLD }}>Actions</h3>
                <div style={{ display: 'grid', gap: 10 }}>
                  <button onClick={() => { assignToProject(c); }} disabled={assigning} style={{
                    padding: '12px 16px', background: `${GOLD}20`, border: `1px solid ${GOLD}40`,
                    borderRadius: 10, color: GOLD, fontWeight: 700, fontSize: 13,
                    cursor: assigning ? 'wait' : 'pointer', opacity: assigning ? 0.6 : 1,
                    textAlign: 'left',
                  }}>
                    {assigning ? 'Assigning…' : 'Assign to Project'}
                  </button>
                  <button onClick={() => {
                    window.open(`mailto:${c.email}`, '_blank');
                  }} style={{
                    padding: '12px 16px', background: `${BLUE}20`, border: `1px solid ${BLUE}40`,
                    borderRadius: 10, color: BLUE, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                    textAlign: 'left',
                  }}>
                    Send Email
                  </button>
                </div>
              </div>
            </div>
          )}

          {detailTab === 'discovery' && (
            <div style={{ ...glass, padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Discovery Answers</h3>
              {c.discovery_answers && Object.keys(c.discovery_answers).length > 0 ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  {Object.entries(c.discovery_answers).map(([key, val]) => (
                    <div key={key} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                      background: `${BG}60`, borderRadius: 10, border: `1px solid ${BORDER}`,
                    }}>
                      <span style={{ fontSize: 20 }}>
                        {key === 'project_type' ? '🏗️' : key === 'budget' ? '💰' : key === 'priorities' ? '🎯' :
                         key === 'timeline' ? '📅' : key === 'smart_interest' ? '🤖' : '📋'}
                      </span>
                      <div>
                        <div style={{ fontSize: 12, color: DIM, textTransform: 'capitalize' }}>
                          {key.replace(/_/g, ' ')}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, textTransform: 'capitalize' }}>
                          {val.replace(/_/g, ' ')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: DIM, textAlign: 'center', padding: 40 }}>
                  No discovery data yet. Customer has not completed the discovery flow.
                </p>
              )}
            </div>
          )}

          {detailTab === 'recommendations' && (
            <div style={{ ...glass, padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Recommendations</h3>
              {c.recommendations && c.recommendations.length > 0 ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  {c.recommendations.map(rec => (
                    <div key={rec.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                      background: `${BG}60`, borderRadius: 10, border: `1px solid ${BORDER}`,
                    }}>
                      <span style={{
                        fontSize: 18,
                        color: rec.status === 'accepted' ? GREEN : rec.status === 'rejected' ? RED : AMBER,
                      }}>
                        {rec.status === 'accepted' ? '✓' : rec.status === 'rejected' ? '✗' : '⏳'}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{rec.title}</div>
                      </div>
                      <span style={{
                        fontSize: 12, fontWeight: 700, textTransform: 'capitalize',
                        color: rec.status === 'accepted' ? GREEN : rec.status === 'rejected' ? RED : AMBER,
                      }}>{rec.status}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: DIM, textAlign: 'center', padding: 40 }}>No recommendations generated yet.</p>
              )}
            </div>
          )}

          {detailTab === 'designs' && (
            <div style={{ ...glass, padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Design Sessions</h3>
              {c.design_sessions && c.design_sessions.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
                  {c.design_sessions.map(ds => (
                    <div key={ds.id} style={{
                      padding: 16, background: `${BG}60`, borderRadius: 12,
                      border: `1px solid ${BORDER}`, textAlign: 'center',
                    }}>
                      <div style={{
                        height: 80, background: `linear-gradient(135deg, ${GOLD}20, ${CARD})`,
                        borderRadius: 8, marginBottom: 10, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontSize: 30,
                      }}>🏠</div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{ds.room}</div>
                      <div style={{ fontSize: 12, color: DIM }}>{ds.style} | {ds.date}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: DIM, textAlign: 'center', padding: 40 }}>No design sessions recorded.</p>
              )}
            </div>
          )}

          {detailTab === 'materials' && (
            <div style={{ ...glass, padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Material Selections</h3>
              {c.material_selections && c.material_selections.length > 0 ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  {c.material_selections.map((ms, i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', padding: '12px 16px',
                      background: `${BG}60`, borderRadius: 10, border: `1px solid ${BORDER}`,
                    }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{ms.name}</div>
                        <div style={{ fontSize: 12, color: DIM }}>Qty: {ms.qty}</div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: GOLD }}>{fmt(ms.cost)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: DIM, textAlign: 'center', padding: 40 }}>No materials selected.</p>
              )}
            </div>
          )}

          {detailTab === 'conversations' && (
            <div style={{ ...glass, padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Sage Conversations</h3>
              {c.conversations && c.conversations.length > 0 ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  {c.conversations.map((cv, i) => (
                    <div key={i} style={{
                      display: 'flex', gap: 12, padding: '12px 16px',
                      background: `${BG}60`, borderRadius: 10, border: `1px solid ${BORDER}`,
                    }}>
                      <span style={{ fontSize: 20 }}>🌵</span>
                      <div>
                        <div style={{ fontSize: 12, color: DIM, marginBottom: 2 }}>{cv.date}</div>
                        <div style={{ fontSize: 13 }}>{cv.preview}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: DIM, textAlign: 'center', padding: 40 }}>No conversation history.</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ─── Main Table View ─── */
  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, padding: 20 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>
              Customer <span style={{ color: GOLD }}>CRM</span>
            </h1>
            <p style={{ fontSize: 14, color: DIM }}>
              {loading ? 'Loading profiles…' : error ? 'Unable to load profiles' : `${customers.length} total profiles`}
            </p>
          </div>
          <button onClick={exportCSV} style={{
            padding: '10px 20px', background: `${GREEN}20`, border: `1px solid ${GREEN}40`,
            borderRadius: 10, color: GREEN, fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}>
            Export Leads (CSV)
          </button>
        </div>

        {/* Status pills */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
          <button onClick={() => setFilterStatus('all')} style={{
            padding: '6px 14px', borderRadius: 99, fontSize: 12, fontWeight: 700,
            border: `1px solid ${filterStatus === 'all' ? GOLD : BORDER}`,
            background: filterStatus === 'all' ? `${GOLD}18` : 'transparent',
            color: filterStatus === 'all' ? GOLD : DIM, cursor: 'pointer',
          }}>All ({statusCounts.all})</button>
          {STATUSES.map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              padding: '6px 14px', borderRadius: 99, fontSize: 12, fontWeight: 700,
              border: `1px solid ${filterStatus === s ? STATUS_COLORS[s] : BORDER}`,
              background: filterStatus === s ? `${STATUS_COLORS[s]}18` : 'transparent',
              color: filterStatus === s ? STATUS_COLORS[s] : DIM, cursor: 'pointer',
              textTransform: 'capitalize',
            }}>{s} ({statusCounts[s] || 0})</button>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <input
            type="text" placeholder="Search by name or email..." value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, minWidth: 200, padding: '10px 16px', background: `${CARD}CC`,
              border: `1px solid ${BORDER}`, borderRadius: 10, color: TEXT,
              fontSize: 14, outline: 'none',
            }}
          />
          <select value={filterSource} onChange={e => setFilterSource(e.target.value)} style={{
            padding: '10px 14px', background: CARD, border: `1px solid ${BORDER}`,
            borderRadius: 10, color: TEXT, fontSize: 13, outline: 'none',
          }}>
            <option value="all">All Sources</option>
            {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterState} onChange={e => setFilterState(e.target.value)} style={{
            padding: '10px 14px', background: CARD, border: `1px solid ${BORDER}`,
            borderRadius: 10, color: TEXT, fontSize: 13, outline: 'none',
          }}>
            <option value="all">All States</option>
            {STATES_LIST.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Table */}
        {error ? (
          <EmptyState
            icon={<WarningCircle size={32} weight="duotone" />}
            title="Couldn't load customers"
            description="Something went wrong while loading customer profiles. Check your connection and try again."
            actionLabel="Retry"
            onAction={load}
          />
        ) : !loading && customers.length === 0 ? (
          <EmptyState
            icon={<UsersThree size={32} weight="duotone" />}
            title="No customers yet"
            description="Customer profiles will appear here as leads come in through your design studio, Sage chat, and other sources."
          />
        ) : (
        <div style={{ ...glass, overflow: 'auto', padding: 0 }}>
          {loading ? (
            <div style={{ padding: 8 }}>
              {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: DIM }}>No customers match your filters.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  {['Name', 'Email', 'State', 'Status', 'Score', 'Source', 'Created'].map(h => (
                    <th key={h} style={{
                      padding: '12px 14px', textAlign: 'left', fontSize: 12,
                      color: DIM, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, idx) => (
                  <tr
                    key={c.id}
                    onClick={() => { setSelected(c); setDetailTab('overview'); }}
                    style={{
                      borderBottom: `1px solid ${BORDER}`,
                      background: idx % 2 === 0 ? 'transparent' : `${BG}30`,
                      cursor: 'pointer', transition: 'background .15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = `${GOLD}08`)}
                    onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : `${BG}30`)}
                  >
                    <td style={{ padding: '12px 14px', fontSize: 14, fontWeight: 600 }}>{c.name}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: DIM }}>{c.email}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600 }}>{c.state}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                        background: `${STATUS_COLORS[c.status]}20`, color: STATUS_COLORS[c.status],
                        textTransform: 'capitalize',
                      }}>{c.status}</span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        fontSize: 14, fontWeight: 800, color: scoreColor(c.lead_score),
                      }}>{c.lead_score}</span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: DIM }}>{c.source}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: DIM }}>{fmtDate(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
