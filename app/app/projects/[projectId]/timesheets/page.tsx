'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Badge, Table, T } from '@/components/ui/shell';
import {
  PremiumSurface,
  ModuleHero,
  StatCard,
  SectionCard,
  PremiumEmpty,
  goldButtonStyle,
  ghostButtonStyle,
} from '@/components/ui/premium';
import { FileText, Clock, Hourglass, CheckCircle, Plus } from '@phosphor-icons/react';

interface TimeEntry {
  id: string;
  employee: string;
  date: string;
  regular_hrs: number;
  ot_hrs: number;
  classification: string;
  status: string;
  project_id: string;
}

type WeekFilter = 'current' | 'last' | 'all';

// Cinematic-kit accent palette (matches the dashboard) ------------------------
const GOLD = '#F59E0B';
const GREEN = '#45B37D';
const ORANGE = '#F0A63C';

const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 10, color: '#FFFFFF', fontSize: 13, outline: 'none', boxSizing: 'border-box' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.62)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 };

// Compact button + filter-chip presets derived from the kit --------------------
const goldBtnSm: React.CSSProperties = { ...goldButtonStyle, padding: '6px 14px', fontSize: 12, borderRadius: 9 };
const dangerBtnSm: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '6px 14px', borderRadius: 9, cursor: 'pointer', background: 'rgba(239,68,68,0.12)', color: '#F87171', border: '1px solid rgba(239,68,68,0.35)', fontWeight: 700, fontSize: 12 };
const chipBase: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '7px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: '1px solid', transition: 'all .16s ease' };
const chipActive: React.CSSProperties = { ...chipBase, background: `linear-gradient(135deg, ${GOLD}, #FBBF24)`, color: '#1A1206', borderColor: 'transparent', boxShadow: '0 8px 20px -10px rgba(245,158,11,0.6)' };
const chipInactive: React.CSSProperties = { ...chipBase, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.72)', borderColor: 'rgba(255,255,255,0.10)' };

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

const CLASSIFICATIONS = ['Laborer', 'Carpenter', 'Electrician', 'Plumber', 'Ironworker', 'Operator', 'Superintendent', 'Foreman'];

const EMPTY_FORM = { employee: '', date: new Date().toISOString().split('T')[0], regular_hrs: 8, ot_hrs: 0, classification: 'Laborer' };

export default function TimesheetsPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [weekFilter, setWeekFilter] = useState<WeekFilter>('current');

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/timesheets?week=${weekFilter}`);
      const json = await res.json();
      setEntries(json.entries || []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, weekFilter]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const currentWeekStart = getWeekStart(new Date());
  const lastWeekStart = (() => { const d = new Date(currentWeekStart); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0]; })();

  const filtered = entries.filter(e => {
    if (weekFilter === 'all') return true;
    if (weekFilter === 'current') return e.date >= currentWeekStart;
    if (weekFilter === 'last') return e.date >= lastWeekStart && e.date < currentWeekStart;
    return true;
  });

  const totalEntries = filtered.length;
  const totalHours = filtered.reduce((s, e) => s + e.regular_hrs + e.ot_hrs, 0);
  const pendingCount = filtered.filter(e => e.status === 'pending').length;
  const approvedCount = filtered.filter(e => e.status === 'approved').length;

  async function handleSave() {
    if (!form.employee) return;
    setSaving(true);
    try {
      const res = await fetch('/api/timesheets/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          work_date: form.date || undefined,
          status: 'pending',
          // Structured fields so the crew member, hours, and trade actually
          // persist (previously only work_description survived; hours + name
          // were dropped and the entry showed the logged-in user at 0 hrs).
          employee_name: form.employee,
          regular_hours: form.regular_hrs,
          overtime_hours: form.ot_hrs,
          trade: form.classification,
          work_description: form.classification ? `${form.employee} — ${form.classification}` : form.employee,
        }),
      });
      if (!res.ok) throw new Error('save failed');
      setShowForm(false);
      setForm(EMPTY_FORM);
      setToast('Timesheet entry added.');
      setTimeout(() => setToast(''), 4000);
      fetchEntries();
    } catch {
      setToast('Could not add the entry. Please try again.');
      setTimeout(() => setToast(''), 4000);
    } finally {
      setSaving(false);
    }
  }

  async function handleAction(id: string, action: 'approved' | 'rejected') {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, status: action } : e));
    try {
      const res = await fetch(`/api/timesheets/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action }),
      });
      if (!res.ok) throw new Error('update failed');
      setToast(`Timesheet ${action}.`);
      setTimeout(() => setToast(''), 4000);
    } catch {
      setToast('Could not update the timesheet. Please try again.');
      setTimeout(() => setToast(''), 4000);
      fetchEntries();
    }
  }

  return (
    <PremiumSurface maxWidth={1600}>
      {/* Header */}
      <ModuleHero
        eyebrow="LABOR TRACKING"
        eyebrowIcon={<Clock size={13} weight="fill" color={GOLD} />}
        title="Crew"
        accent="Timesheets"
        subtitle="Weekly crew timesheets and labor tracking"
        actions={
          <button style={goldButtonStyle} className="pmBtn" onClick={() => setShowForm(p => !p)}>
            <Plus size={15} weight="bold" /> Add Entry
          </button>
        }
      />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16, marginBottom: 28 }}>
        <StatCard icon={<FileText size={19} weight="duotone" color={GOLD} />} label="Total Entries" value={String(totalEntries)} accent={GOLD} sub="logged this period" delay={0.02} />
        <StatCard icon={<Clock size={19} weight="duotone" color={GOLD} />} label="Total Hours" value={`${totalHours.toFixed(1)}h`} accent={GOLD} sub="regular + overtime" delay={0.06} />
        <StatCard icon={<Hourglass size={19} weight="duotone" color={ORANGE} />} label="Pending Approval" value={String(pendingCount)} accent={pendingCount > 0 ? ORANGE : undefined} sub="awaiting review" delay={0.10} />
        <StatCard icon={<CheckCircle size={19} weight="duotone" color={GREEN} />} label="Approved" value={String(approvedCount)} accent={approvedCount > 0 ? GREEN : undefined} sub="this period" delay={0.14} />
      </div>

      {/* Week filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {([['current', 'Current Week'], ['last', 'Last Week'], ['all', 'All']] as [WeekFilter, string][]).map(([key, label]) => (
          <button key={key} className="pmBtn" style={weekFilter === key ? chipActive : chipInactive} onClick={() => setWeekFilter(key)}>{label}</button>
        ))}
      </div>

      {toast && (
        <div style={{ marginBottom: 16, padding: '11px 16px', background: 'rgba(52,199,89,0.12)', border: '1px solid rgba(52,199,89,0.3)', borderRadius: 10, color: GREEN, fontSize: 13, fontWeight: 600 }}>
          {toast}
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <div style={{ marginBottom: 24 }}>
          <SectionCard title="Add Timesheet Entry" icon={<Plus size={17} weight="bold" color={GOLD} />}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
              <div>
                <label style={lbl}>Employee *</label>
                <input type="text" value={form.employee} onChange={e => setForm(p => ({ ...p, employee: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>Date</label>
                <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>Classification</label>
                <select value={form.classification} onChange={e => setForm(p => ({ ...p, classification: e.target.value }))} style={inp}>
                  {CLASSIFICATIONS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Regular Hours</label>
                <input type="number" min={0} max={24} value={form.regular_hrs} onChange={e => setForm(p => ({ ...p, regular_hrs: Number(e.target.value) }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>OT Hours</label>
                <input type="number" min={0} max={24} value={form.ot_hrs} onChange={e => setForm(p => ({ ...p, ot_hrs: Number(e.target.value) }))} style={inp} />
              </div>
              <div style={{ display: 'flex', alignItems: 'end' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: GOLD }}>Total: {form.regular_hrs + form.ot_hrs}h</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button style={{ ...goldButtonStyle, opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer' }} className="pmBtn" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Entry'}</button>
              <button style={ghostButtonStyle} className="pmBtn" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </SectionCard>
        </div>
      )}

      {/* Table */}
      <SectionCard title="Time Entries" icon={<Clock size={17} weight="duotone" color={GOLD} />} flush>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 44, color: 'rgba(255,255,255,0.62)', fontSize: 13 }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '8px 8px 20px' }}>
            <PremiumEmpty
              icon={<Clock size={30} weight="duotone" color={GOLD} />}
              title="No time entries yet"
              description="Add a crew timesheet entry to start tracking labor hours for this period."
              action={<button style={goldButtonStyle} className="pmBtn" onClick={() => setShowForm(true)}><Plus size={15} weight="bold" /> Add Entry</button>}
            />
          </div>
        ) : (
          <Table
            headers={['Employee', 'Date', 'Regular Hrs', 'OT Hrs', 'Total Hrs', 'Classification', 'Status', 'Actions']}
            rows={filtered.map(e => [
              <span key="emp" style={{ fontWeight: 600 }}>{e.employee}</span>,
              <span key="dt" style={{ color: T.muted, whiteSpace: 'nowrap' }}>{e.date}</span>,
              <span key="rh" style={{ color: T.white }}>{e.regular_hrs}</span>,
              <span key="oh" style={{ color: e.ot_hrs > 0 ? T.amber : T.muted }}>{e.ot_hrs}</span>,
              <span key="th" style={{ fontWeight: 700, color: T.gold }}>{(e.regular_hrs + e.ot_hrs).toFixed(1)}h</span>,
              <span key="cl" style={{ color: T.muted }}>{e.classification}</span>,
              <Badge key="st" label={e.status} color={e.status === 'approved' ? 'green' : e.status === 'rejected' ? 'red' : 'amber'} />,
              <div key="act" style={{ display: 'flex', gap: 6 }}>
                {e.status === 'pending' && (
                  <>
                    <button style={goldBtnSm} className="pmBtn" onClick={() => handleAction(e.id, 'approved')}>Approve</button>
                    <button style={dangerBtnSm} className="pmBtn" onClick={() => handleAction(e.id, 'rejected')}>Reject</button>
                  </>
                )}
              </div>,
            ])}
          />
        )}
      </SectionCard>
    </PremiumSurface>
  );
}
