'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import SaguaroDatePicker from '../../../../../components/SaguaroDatePicker';
import { ClipboardText, CheckCircle, XCircle, CalendarCheck, Plus } from '@phosphor-icons/react';
import { PremiumSurface, ModuleHero, StatCard, SectionCard, PremiumEmpty, goldButtonStyle, ghostButtonStyle } from '@/components/ui/premium';

const GOLD='#F59E0B', BORDER='rgba(255,255,255,0.12)', DIM='#CBD5E1', TEXT='#FFFFFF', GREEN='#3dd68c', RED='#ef4444';

interface Inspection {
  id: string;
  type: string;
  date: string;
  inspector: string;
  agency: string;
  result: string;
  notes: string;
  status: string;
  re_inspection_date: string | null;
  project_id: string;
}

const INSPECTION_TYPES = ['Foundation','Framing','Rough Electrical','Rough Plumbing','Rough HVAC','Insulation','Drywall','Final Electrical','Final Plumbing','Final Building'];
const EMPTY_FORM = { type: 'Framing', date: '', inspector: '', agency: '', notes: '' };

// The API returns raw `inspections` rows whose columns don't match this page's
// display fields (scheduled_date/inspection_type/inspector_name). Normalize so
// the user's saved date + inspector actually render on reload.
function normalizeInspection(r: Record<string, unknown>): Inspection {
  return {
    id: String(r.id ?? ''),
    type: String(r.type ?? r.inspection_type ?? ''),
    date: String(r.date ?? r.scheduled_date ?? ''),
    inspector: String(r.inspector ?? r.inspector_name ?? ''),
    agency: String(r.agency ?? r.inspector_agency ?? ''),
    result: String(r.result ?? ''),
    notes: String(r.notes ?? ''),
    status: String(r.status ?? ''),
    re_inspection_date: (r.re_inspection_date as string | null) ?? null,
    project_id: String(r.project_id ?? ''),
  };
}

function resultBadge(result: string) {
  const map: Record<string, { bg: string; color: string }> = {
    Passed: { bg: 'rgba(61,214,140,.2)', color: GREEN },
    Failed: { bg: 'rgba(239,68,68,.2)', color: RED },
    Pending: { bg: 'rgba(245,158,11,.2)', color: '#f59e0b' },
    'Conditional Pass': { bg: 'rgba(245, 158, 11,.2)', color: GOLD },
  };
  const s = map[result] || { bg: 'rgba(143,163,192,.2)', color: DIM };
  return <span style={{ padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color, fontSize: 11, fontWeight: 700 }}>{result}</span>;
}

export default function InspectionsPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchInspections = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/inspections`);
      const json = await res.json();
      setInspections((json.inspections ?? []).map(normalizeInspection));
    } catch {
      setInspections([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchInspections(); }, [fetchInspections]);

  const passed = inspections.filter(i => i.result === 'Passed').length;
  const failed = inspections.filter(i => i.result === 'Failed').length;
  const scheduled = inspections.filter(i => i.status === 'Scheduled').length;

  async function handleSave() {
    if (!form.type || !form.date || !form.inspector) { setErrorMsg('Type, date, and inspector are required.'); return; }
    setSaving(true);
    setErrorMsg('');
    const payload = { projectId, result: 'Pending', status: 'Scheduled', ...form };
    try {
      let res = await fetch('/api/inspections/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      // QC-before-inspections gate (franchise sites): allow an explicit override.
      if (res.status === 409) {
        const g = await res.json().catch(() => ({}));
        if (g?.requiresQcOverride && typeof window !== 'undefined' &&
            window.confirm(`${g.error || 'QC is not complete for this site.'}\n\nSchedule the inspection anyway?`)) {
          res = await fetch('/api/inspections/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, override: true }) });
        } else if (g?.requiresQcOverride) {
          setErrorMsg(g.error || 'QC not complete for this site.'); setSaving(false); return;
        }
      }
      const json = await res.json();
      if (!res.ok || !json.inspection) throw new Error(json.error || 'Create failed');
      setInspections(prev => [...prev, normalizeInspection(json.inspection)]);
      setShowForm(false);
      setForm(EMPTY_FORM);
      setSuccessMsg('Inspection scheduled.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch {
      setErrorMsg('Could not schedule the inspection. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', background: '#1c1c1e', border: '1px solid ' + BORDER, borderRadius: 6, color: TEXT, fontSize: 13 };
  const label: React.CSSProperties = { fontSize: 12, color: DIM, marginBottom: 4, display: 'block' };

  return (
    <PremiumSurface maxWidth={1600}>
      {/* Header */}
      <ModuleHero
        eyebrow="Quality Assurance"
        eyebrowIcon={<ClipboardText size={13} weight="fill" color={GOLD} />}
        title="Inspections"
        subtitle="Building inspections and approval records"
        actions={
          <button onClick={() => { setShowForm(p => !p); setErrorMsg(''); }} style={goldButtonStyle} className="pmBtn">
            <Plus size={15} weight="bold" /> Schedule Inspection
          </button>
        }
      />

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard icon={<CheckCircle size={19} weight="duotone" color={GREEN} />} label="Passed" value={String(passed)} accent={GREEN} delay={0.02} />
        <StatCard icon={<XCircle size={19} weight="duotone" color={RED} />} label="Failed" value={String(failed)} accent={failed > 0 ? RED : undefined} delay={0.06} />
        <StatCard icon={<CalendarCheck size={19} weight="duotone" color={GOLD} />} label="Scheduled" value={String(scheduled)} accent={GOLD} delay={0.10} />
        <StatCard icon={<ClipboardText size={19} weight="duotone" color={GOLD} />} label="Total" value={String(inspections.length)} delay={0.14} />
      </div>

      {successMsg && <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(61,214,140,.15)', border: '1px solid rgba(61,214,140,.4)', borderRadius: 10, color: GREEN, fontSize: 13 }}>{successMsg}</div>}
      {errorMsg && <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.4)', borderRadius: 10, color: RED, fontSize: 13 }}>{errorMsg}</div>}

      {showForm && (
        <div style={{ marginBottom: 24 }}>
          <SectionCard title="Schedule Inspection" icon={<CalendarCheck size={17} weight="duotone" color={GOLD} />}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              <div><label style={label}>Inspection Type *</label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} style={inp}>
                  {INSPECTION_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div><label style={label}>Date *</label><SaguaroDatePicker value={form.date} onChange={v => setForm(p => ({ ...p, date: v }))} style={inp} /></div>
              <div><label style={label}>Inspector *</label><input type="text" value={form.inspector} onChange={e => setForm(p => ({ ...p, inspector: e.target.value }))} style={inp} /></div>
              <div><label style={label}>Agency</label><input type="text" value={form.agency} onChange={e => setForm(p => ({ ...p, agency: e.target.value }))} placeholder="e.g. City of Phoenix" style={inp} /></div>
              <div style={{ gridColumn: 'span 2' }}><label style={label}>Notes</label><input type="text" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={inp} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={handleSave} disabled={saving} style={{ ...goldButtonStyle, opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer' }} className="pmBtn">
                {saving ? 'Saving...' : 'Schedule Inspection'}
              </button>
              <button onClick={() => { setShowForm(false); setErrorMsg(''); }} style={ghostButtonStyle} className="pmBtn">Cancel</button>
            </div>
          </SectionCard>
        </div>
      )}

      {/* Records */}
      <SectionCard title="Inspection Records" icon={<ClipboardText size={17} weight="duotone" color={GOLD} />} flush>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: DIM }}>Loading...</div>
        ) : inspections.length === 0 ? (
          <PremiumEmpty
            icon={<ClipboardText size={30} weight="duotone" color={GOLD} />}
            title="No inspections scheduled yet"
            description="Schedule your first inspection to start tracking building inspections and approval records."
            action={<button onClick={() => { setShowForm(true); setErrorMsg(''); }} style={goldButtonStyle} className="pmBtn"><Plus size={15} weight="bold" /> Schedule Inspection</button>}
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {['Type','Date','Inspector','Agency','Result','Notes','Status'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: DIM, borderBottom: '1px solid ' + BORDER, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inspections.map(i => (
                  <tr key={i.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <td style={{ padding: '10px 14px', color: TEXT, fontWeight: 600 }}>{i.type}</td>
                    <td style={{ padding: '10px 14px', color: DIM, whiteSpace: 'nowrap' }}>{i.date}</td>
                    <td style={{ padding: '10px 14px', color: DIM }}>{i.inspector}</td>
                    <td style={{ padding: '10px 14px', color: DIM }}>{i.agency}</td>
                    <td style={{ padding: '10px 14px' }}>{resultBadge(i.result)}</td>
                    <td style={{ padding: '10px 14px', color: DIM }}>{i.notes || '—'}</td>
                    <td style={{ padding: '10px 14px', color: i.status === 'Complete' ? GREEN : '#f59e0b' }}>{i.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </PremiumSurface>
  );
}
