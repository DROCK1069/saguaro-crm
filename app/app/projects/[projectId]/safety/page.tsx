'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Badge, Table, T } from '@/components/ui/shell';
import {
  PremiumSurface, ModuleHero, StatCard, SectionCard, PremiumEmpty,
  goldButtonStyle, ghostButtonStyle,
} from '@/components/ui/premium';
import {
  ShieldCheck, ClipboardText, WarningCircle, CheckCircle, Warning,
  ClockCountdown, FilePdf, Plus, X, ArrowRight, Wrench,
} from '@phosphor-icons/react';
import SaguaroDatePicker from '../../../../../components/SaguaroDatePicker';

// Semantic accents — tuned to match the dashboard's Sonoran palette.
const GOLD = '#F59E0B';
const GREEN = '#45B37D';
const RED = '#E0644E';
const AMBER = '#F0A63C';

interface Incident {
  id: string;
  date: string;
  type: string;
  description: string;
  severity: string;
  corrective_action: string;
  status: string;
  project_id: string;
}

interface CorrectiveAction {
  id: string;
  description: string;
  assigned_to: string;
  due_date: string;
  status: string;
  verification_date?: string;
  verified_by?: string;
  incident_id?: string;
  created_at?: string;
  project_id?: string;
}

const TYPES = ['Near Miss', 'First Aid', 'Recordable', 'Lost Time'];

const SEVERITY_BADGE: Record<string, 'amber' | 'gold' | 'red' | 'muted'> = {
  'Near Miss': 'amber',
  'First Aid': 'gold',
  'Recordable': 'red',
  'Lost Time': 'red',
};

const STATUS_BADGE: Record<string, 'red' | 'green' | 'muted'> = {
  Open: 'red',
  Resolved: 'green',
};

const CA_STATUS_BADGE: Record<string, 'red' | 'amber' | 'gold' | 'green' | 'muted'> = {
  open: 'red',
  in_progress: 'amber',
  verified: 'gold',
  closed: 'green',
};

const CA_STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  verified: 'Verified',
  closed: 'Closed',
};

const CA_STATUS_FLOW: Record<string, string> = {
  open: 'in_progress',
  in_progress: 'verified',
  verified: 'closed',
};

const EMPTY_FORM = { date: '', type: 'Near Miss', description: '', severity: 'Near Miss', corrective_action: '' };

// The API returns raw safety_incidents rows (incident_date / corrective_actions)
// that don't match this page's display fields (date / corrective_action).
// Normalize so a saved incident's date renders on reload instead of going blank.
function normalizeIncident(r: Record<string, unknown>): Incident {
  return {
    id: String(r.id ?? ''),
    date: String((r.date as string) ?? (r.incident_date as string) ?? ''),
    type: String(r.type ?? ''),
    description: String(r.description ?? ''),
    severity: String(r.severity ?? ''),
    corrective_action: String((r.corrective_action as string) ?? (r.corrective_actions as string) ?? ''),
    status: String(r.status ?? 'Open'),
    project_id: String(r.project_id ?? ''),
  };
}

const EMPTY_CA_FORM = { description: '', assigned_to: '', due_date: '' };

export default function SafetyPage() {
  const { projectId } = useParams() as { projectId: string };
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Corrective Actions state
  const [actions, setActions] = useState<CorrectiveAction[]>([]);
  const [actionsLoading, setActionsLoading] = useState(true);
  const [showCAForm, setShowCAForm] = useState(false);
  const [caForm, setCaForm] = useState(EMPTY_CA_FORM);
  const [caSaving, setCaSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/safety`);
      const json = await res.json();
      setIncidents((json.incidents || []).map(normalizeIncident));
    } catch {
      setIncidents([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const fetchActions = useCallback(async () => {
    setActionsLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/safety/corrective-actions`);
      const json = await res.json();
      setActions(json.actions || []);
    } catch {
      setActions([]);
    } finally {
      setActionsLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchData(); fetchActions(); }, [fetchData, fetchActions]);

  const totalIncidents = incidents.length;
  const openCount = incidents.filter(i => i.status === 'Open').length;
  const resolvedCount = incidents.filter(i => i.status === 'Resolved').length;

  const openActionsCount = actions.filter(a => a.status === 'open' || a.status === 'in_progress').length;
  const overdueActionsCount = actions.filter(a => {
    if (a.status === 'closed' || a.status === 'verified') return false;
    if (!a.due_date) return false;
    return new Date(a.due_date) < new Date();
  }).length;

  const lastIncident = incidents
    .filter(i => i.severity !== 'Near Miss')
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const daysSinceLast = lastIncident
    ? Math.floor((Date.now() - new Date(lastIncident.date).getTime()) / 86400000)
    : incidents.length > 0
      ? Math.floor((Date.now() - new Date(incidents[0].date).getTime()) / 86400000)
      : 0;

  async function handleSave() {
    if (!form.description || !form.date) { setErrorMsg('Date and description are required.'); return; }
    setSaving(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/safety/incidents/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, status: 'Open', ...form }),
      });
      const json = await res.json();
      if (!res.ok || !json.incident) throw new Error(json.error || 'Create failed');
      const newIncident = normalizeIncident(json.incident);
      setIncidents(prev => [newIncident, ...prev]);

      // Auto-create corrective action if corrective_action text is provided.
      // Best-effort: the incident is already saved, so a CA failure doesn't fail the report.
      if (form.corrective_action && form.corrective_action.trim()) {
        try {
          const caRes = await fetch(`/api/projects/${projectId}/safety/corrective-actions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              description: form.corrective_action,
              incident_id: newIncident.id,
              due_date: '',
              assigned_to: '',
            }),
          });
          const caJson = await caRes.json();
          if (caRes.ok && caJson.action) {
            setActions(prev => [caJson.action, ...prev]);
          }
        } catch { /* incident saved; corrective action is best-effort */ }
      }

      setShowForm(false);
      setForm(EMPTY_FORM);
      setSuccessMsg('Incident reported.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch {
      setErrorMsg('Could not report the incident. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateCA() {
    if (!caForm.description) { setErrorMsg('Corrective action description is required.'); return; }
    setCaSaving(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/projects/${projectId}/safety/corrective-actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(caForm),
      });
      const json = await res.json();
      if (!res.ok || !json.action) throw new Error(json.error || 'Create failed');
      setActions(prev => [json.action as CorrectiveAction, ...prev]);
      setShowCAForm(false);
      setCaForm(EMPTY_CA_FORM);
      setSuccessMsg('Corrective action created.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch {
      setErrorMsg('Could not create the corrective action. Please try again.');
    } finally {
      setCaSaving(false);
    }
  }

  async function handleAdvanceCAStatus(action: CorrectiveAction) {
    const nextStatus = CA_STATUS_FLOW[action.status];
    if (!nextStatus) return;
    setActions(prev => prev.map(a => a.id === action.id ? { ...a, status: nextStatus } : a));
    try {
      const res = await fetch(`/api/projects/${projectId}/safety/corrective-actions/${action.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error('update failed');
      setActions(prev => prev.map(a => a.id === action.id ? { ...a, ...json.action, status: nextStatus } : a));
      setSuccessMsg(`Action updated to ${CA_STATUS_LABELS[nextStatus]}.`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch {
      setErrorMsg('Could not update the corrective action. Please try again.');
      setTimeout(() => setErrorMsg(''), 4000);
      fetchActions();
    }
  }

  async function handleGenerateJHA() {
    try {
      const res = await fetch('/api/documents/jha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      const json = await res.json().catch(() => ({}));
      const link = json.pdfUrl || json.url;
      if (!res.ok || !link) throw new Error(json.error || 'no document returned');
      window.open(link, '_blank');
    } catch {
      setErrorMsg('Could not generate the JHA. Please try again.');
      setTimeout(() => setErrorMsg(''), 4000);
    }
  }

  function isOverdue(action: CorrectiveAction): boolean {
    if (action.status === 'closed' || action.status === 'verified') return false;
    if (!action.due_date) return false;
    return new Date(action.due_date) < new Date();
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '8px 12px', background: T.surface,
    border: `1px solid ${T.border}`, borderRadius: 8, color: T.white, fontSize: 13, outline: 'none',
  };
  const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 };

  return (
    <PremiumSurface maxWidth={1600}>
      {/* Header */}
      <ModuleHero
        eyebrow="HEALTH & SAFETY"
        eyebrowIcon={<ShieldCheck size={13} weight="fill" color={GOLD} />}
        title="Safety"
        subtitle="Safety incidents, inspections, and OSHA records"
        actions={
          <>
            <button onClick={handleGenerateJHA} style={ghostButtonStyle} className="pmBtn">
              <FilePdf size={15} weight="bold" /> Generate JHA
            </button>
            <button onClick={() => { setShowForm(p => !p); setErrorMsg(''); }} style={goldButtonStyle} className="pmBtn">
              {showForm ? <><X size={15} weight="bold" /> Cancel</> : <><Plus size={15} weight="bold" /> Report Incident</>}
            </button>
          </>
        }
      />

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard
          icon={<ClipboardText size={19} weight="duotone" color={GOLD} />}
          label="Total Incidents" value={String(totalIncidents)} accent={GOLD}
          delay={0.02}
        />
        <StatCard
          icon={<WarningCircle size={19} weight="duotone" color={RED} />}
          label="Open" value={String(openCount)} accent={openCount > 0 ? RED : undefined}
          delay={0.06}
        />
        <StatCard
          icon={<CheckCircle size={19} weight="duotone" color={GREEN} />}
          label="Resolved" value={String(resolvedCount)} accent={resolvedCount > 0 ? GREEN : undefined}
          delay={0.10}
        />
        <StatCard
          icon={<ShieldCheck size={19} weight="duotone" color={GREEN} />}
          label="Days Since Last Incident"
          value={String(daysSinceLast)}
          accent={daysSinceLast > 30 ? GREEN : undefined}
          sub={daysSinceLast > 30 ? 'Excellent record' : undefined}
          delay={0.14}
        />
        <StatCard
          icon={<Warning size={19} weight="duotone" color={AMBER} />}
          label="Open Actions" value={String(openActionsCount)} accent={openActionsCount > 0 ? AMBER : undefined}
          delay={0.18}
        />
        <StatCard
          icon={<ClockCountdown size={19} weight="duotone" color={RED} />}
          label="Overdue Actions"
          value={String(overdueActionsCount)}
          accent={overdueActionsCount > 0 ? RED : undefined}
          sub={overdueActionsCount > 0 ? 'Needs attention' : undefined}
          delay={0.22}
        />
      </div>

      {successMsg && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: T.greenDim, border: `1px solid rgba(34,197,94,0.4)`, borderRadius: 10, color: T.green, fontSize: 13 }}>{successMsg}</div>
      )}
      {errorMsg && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: T.redDim, border: `1px solid rgba(239,68,68,0.4)`, borderRadius: 10, color: T.red, fontSize: 13 }}>{errorMsg}</div>
      )}

      {/* Create Incident Form */}
      {showForm && (
        <div style={{ marginBottom: 20 }}>
          <SectionCard title="Report Safety Incident" icon={<Warning size={17} weight="duotone" color={RED} />} accent={RED}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              <div>
                <label style={lbl}>Date *</label>
                <SaguaroDatePicker value={form.date} onChange={v => setForm(p => ({ ...p, date: v }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>Type</label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} style={inp}>
                  {TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Severity</label>
                <select value={form.severity} onChange={e => setForm(p => ({ ...p, severity: e.target.value }))} style={inp}>
                  {TYPES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: 'span 3' }}>
                <label style={lbl}>Description *</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} style={{ ...inp, resize: 'vertical' }} />
              </div>
              <div style={{ gridColumn: 'span 3' }}>
                <label style={lbl}>Corrective Action</label>
                <textarea value={form.corrective_action} onChange={e => setForm(p => ({ ...p, corrective_action: e.target.value }))} rows={2} style={{ ...inp, resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={handleSave} disabled={saving} className="pmBtn" style={{ ...goldButtonStyle, opacity: saving ? 0.5 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : 'Report Incident'}</button>
              <button onClick={() => { setShowForm(false); setErrorMsg(''); }} style={ghostButtonStyle} className="pmBtn">Cancel</button>
            </div>
          </SectionCard>
        </div>
      )}

      {/* Incidents Table */}
      <div style={{ marginBottom: 28 }}>
        <SectionCard
          title="Incident Log"
          subtitle="Reported safety incidents for this project"
          icon={<ClipboardText size={17} weight="duotone" color={GOLD} />}
          flush
        >
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: T.muted }}>Loading...</div>
          ) : incidents.length === 0 ? (
            <PremiumEmpty
              icon={<CheckCircle size={30} weight="duotone" color={GREEN} />}
              title="No incidents recorded"
              description="Great work — no safety incidents have been logged for this project yet."
            />
          ) : (
            <Table
              headers={['Date', 'Type', 'Description', 'Severity', 'Status']}
              rows={incidents.map(i => [
                <span key="d" style={{ color: T.muted, whiteSpace: 'nowrap' }}>{i.date}</span>,
                i.type,
                <span key="desc" style={{ maxWidth: 300, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {i.description}
                </span>,
                <Badge key="sev" label={i.severity} color={SEVERITY_BADGE[i.severity] || 'muted'} />,
                <Badge key="st" label={i.status} color={STATUS_BADGE[i.status] || 'muted'} />,
              ])}
            />
          )}
        </SectionCard>
      </div>

      {/* Corrective Actions Section */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.01em' }}>Corrective Actions</h2>
          <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'rgba(255,255,255,0.62)' }}>Track and verify corrective actions from incidents</p>
        </div>
        <button onClick={() => { setShowCAForm(p => !p); setErrorMsg(''); }} style={goldButtonStyle} className="pmBtn">
          {showCAForm ? <><X size={15} weight="bold" /> Cancel</> : <><Plus size={15} weight="bold" /> New Action</>}
        </button>
      </div>

      {/* Create Corrective Action Form */}
      {showCAForm && (
        <div style={{ marginBottom: 20 }}>
          <SectionCard title="New Corrective Action" icon={<Wrench size={17} weight="duotone" color={GOLD} />}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={lbl}>Description *</label>
                <textarea value={caForm.description} onChange={e => setCaForm(p => ({ ...p, description: e.target.value }))} rows={3} style={{ ...inp, resize: 'vertical' }} />
              </div>
              <div>
                <label style={lbl}>Assigned To</label>
                <input value={caForm.assigned_to} onChange={e => setCaForm(p => ({ ...p, assigned_to: e.target.value }))} style={inp} placeholder="Name or email" />
              </div>
              <div>
                <label style={lbl}>Due Date</label>
                <SaguaroDatePicker value={caForm.due_date} onChange={v => setCaForm(p => ({ ...p, due_date: v }))} style={inp} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={handleCreateCA} disabled={caSaving} className="pmBtn" style={{ ...goldButtonStyle, opacity: caSaving ? 0.5 : 1, cursor: caSaving ? 'not-allowed' : 'pointer' }}>{caSaving ? 'Creating...' : 'Create Action'}</button>
              <button onClick={() => { setShowCAForm(false); setErrorMsg(''); }} style={ghostButtonStyle} className="pmBtn">Cancel</button>
            </div>
          </SectionCard>
        </div>
      )}

      {/* Corrective Actions Table */}
      <div>
        <SectionCard flush>
          {actionsLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: T.muted }}>Loading corrective actions...</div>
          ) : actions.length === 0 ? (
            <PremiumEmpty
              icon={<Wrench size={30} weight="duotone" color={GOLD} />}
              title="No corrective actions"
              description="Corrective actions created from incidents will appear here."
            />
          ) : (
            <Table
              headers={['Description', 'Assigned To', 'Due Date', 'Status', 'Actions']}
              rows={actions.map(a => {
                const overdue = isOverdue(a);
                const nextStatus = CA_STATUS_FLOW[a.status];
                const nextLabel = nextStatus ? CA_STATUS_LABELS[nextStatus] : null;
                return [
                  <span key="desc" style={{ maxWidth: 280, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.description}
                  </span>,
                  <span key="assign" style={{ color: a.assigned_to ? T.white : T.muted }}>{a.assigned_to || 'Unassigned'}</span>,
                  <span key="due" style={{ color: overdue ? T.red : T.muted, fontWeight: overdue ? 700 : 400, whiteSpace: 'nowrap' }}>
                    {a.due_date || 'No date'}
                    {overdue && <span style={{ display: 'block', fontSize: 10, color: T.red }}>OVERDUE</span>}
                  </span>,
                  <Badge key="st" label={CA_STATUS_LABELS[a.status] || a.status} color={CA_STATUS_BADGE[a.status] || 'muted'} />,
                  <span key="action">
                    {nextLabel ? (
                      <button
                        onClick={() => handleAdvanceCAStatus(a)}
                        className="pmBtn"
                        style={{ ...ghostButtonStyle, padding: '5px 12px', fontSize: 11.5, borderRadius: 9, gap: 6 }}
                      >
                        <ArrowRight size={12} weight="bold" /> {nextLabel}
                      </button>
                    ) : (
                      <span style={{ fontSize: 11, color: GREEN, fontWeight: 700 }}>Complete</span>
                    )}
                  </span>,
                ];
              })}
            />
          )}
        </SectionCard>
      </div>
    </PremiumSurface>
  );
}
