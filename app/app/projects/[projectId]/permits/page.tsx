'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Badge, Table, T } from '@/components/ui/shell';
import { PremiumSurface, ModuleHero, StatCard, SectionCard, PremiumEmpty, goldButtonStyle, ghostButtonStyle } from '@/components/ui/premium';
import SaguaroDatePicker from '../../../../../components/SaguaroDatePicker';
import { Clipboard, NotePencil, CheckCircle, CurrencyDollar, Plus, X } from '@phosphor-icons/react';

interface Permit {
  id: string;
  permit_type: string;
  permit_number: string;
  issuing_authority: string;
  applied_date: string;
  issued_date: string | null;
  expiry_date: string | null;
  fee: number;
  status: string;
  project_id: string;
}

const TYPES = ['Building', 'Electrical', 'Plumbing', 'Mechanical', 'Fire', 'Grading'];

const STATUS_BADGE: Record<string, 'amber' | 'green' | 'red' | 'muted' | 'blue'> = {
  applied: 'amber',
  issued: 'green',
  expired: 'red',
  closed: 'muted',
};

const EMPTY_FORM = {
  permit_type: 'Building',
  number: '',
  authority: '',
  fee: 0,
  applied_date: '',
  issued_date: '',
  expiry_date: '',
};

export default function PermitsPage() {
  const { projectId } = useParams() as { projectId: string };
  const [permits, setPermits] = useState<Permit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const fetchPermits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/permits`);
      const json = await res.json();
      setPermits(json.permits || []);
    } catch {
      setPermits([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchPermits(); }, [fetchPermits]);

  const applied = permits.filter(p => p.status === 'applied').length;
  const issued = permits.filter(p => p.status === 'issued').length;
  const expired = permits.filter(p => p.status === 'expired' || (p.expiry_date && p.expiry_date < today)).length;
  const totalFees = permits.reduce((s, p) => s + (p.fee || 0), 0);

  async function handleSave() {
    if (!form.number || !form.authority) {
      setErrorMsg('Permit number and agency are required.');
      return;
    }
    setSaving(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/permits/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          status: 'applied',
          permit_type: form.permit_type,
          permit_number: form.number,
          issuing_authority: form.authority,
          fee: form.fee,
          applied_date: form.applied_date || null,
          issued_date: form.issued_date || null,
          expiry_date: form.expiry_date || null,
        }),
      });
      if (!res.ok) throw new Error('save failed');
      const json = await res.json();
      if (!json.permit) throw new Error('save failed');
      setPermits(prev => [...prev, json.permit as Permit]);
      setShowForm(false);
      setForm(EMPTY_FORM);
      setSuccessMsg('Permit added.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch {
      setErrorMsg('Could not save the permit. Please try again.');
    } finally {
      setSaving(false);
    }
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
        eyebrow="REGULATORY"
        eyebrowIcon={<Clipboard size={13} weight="fill" color="#F59E0B" />}
        title="Permits &"
        accent="Approvals"
        subtitle="Building permits and regulatory approvals"
        actions={
          <button
            onClick={() => { setShowForm(p => !p); setErrorMsg(''); }}
            className="pmBtn"
            style={showForm ? ghostButtonStyle : goldButtonStyle}
          >
            {showForm ? <><X size={15} weight="bold" /> Cancel</> : <><Plus size={15} weight="bold" /> Add Permit</>}
          </button>
        }
      />

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 28 }}>
        <StatCard icon={<Clipboard size={19} weight="duotone" color={T.gold} />} label="Total Permits" value={String(permits.length)} accent={T.gold} delay={0.02} />
        <StatCard icon={<NotePencil size={19} weight="duotone" color={T.amber} />} label="Applied" value={String(applied)} accent={applied > 0 ? T.amber : undefined} delay={0.06} />
        <StatCard icon={<CheckCircle size={19} weight="duotone" color={T.green} />} label="Issued" value={String(issued)} accent={issued > 0 ? T.green : undefined} delay={0.10} />
        <StatCard icon={<CurrencyDollar size={19} weight="duotone" color={T.gold} />} label="Total Fees" value={`$${totalFees.toLocaleString()}`} delay={0.14} />
      </div>

      {successMsg && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: T.greenDim, border: `1px solid rgba(34,197,94,0.4)`, borderRadius: 10, color: T.green, fontSize: 13 }}>{successMsg}</div>
      )}
      {errorMsg && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: T.redDim, border: `1px solid rgba(239,68,68,0.4)`, borderRadius: 10, color: T.red, fontSize: 13 }}>{errorMsg}</div>
      )}

      {/* Create Form */}
      {showForm && (
        <div style={{ marginBottom: 20 }}>
          <SectionCard title="Add Permit" icon={<NotePencil size={17} weight="duotone" color={T.gold} />}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              <div>
                <label style={lbl}>Permit Type</label>
                <select value={form.permit_type} onChange={e => setForm(p => ({ ...p, permit_type: e.target.value }))} style={inp}>
                  {TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Permit Number *</label>
                <input value={form.number} onChange={e => setForm(p => ({ ...p, number: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>Agency *</label>
                <input value={form.authority} onChange={e => setForm(p => ({ ...p, authority: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>Fee ($)</label>
                <input type="number" value={form.fee} onChange={e => setForm(p => ({ ...p, fee: Number(e.target.value) }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>Issue Date</label>
                <SaguaroDatePicker value={form.issued_date} onChange={v => setForm(p => ({ ...p, issued_date: v }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>Expiry Date</label>
                <SaguaroDatePicker value={form.expiry_date} onChange={v => setForm(p => ({ ...p, expiry_date: v }))} style={inp} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={handleSave} disabled={saving} className="pmBtn" style={{ ...goldButtonStyle, opacity: saving ? 0.55 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving...' : 'Save Permit'}
              </button>
              <button onClick={() => { setShowForm(false); setErrorMsg(''); }} className="pmBtn" style={ghostButtonStyle}>Cancel</button>
            </div>
          </SectionCard>
        </div>
      )}

      {/* Table */}
      <SectionCard title="Permit Register" icon={<Clipboard size={17} weight="duotone" color={T.gold} />} flush>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.muted }}>Loading...</div>
        ) : permits.length === 0 ? (
          <PremiumEmpty
            icon={<Clipboard size={30} weight="duotone" color={T.gold} />}
            title="No permits yet"
            description="Track building permits and regulatory approvals for this project. Add your first permit to get started."
            action={
              <button onClick={() => { setShowForm(true); setErrorMsg(''); }} className="pmBtn" style={goldButtonStyle}>
                <Plus size={15} weight="bold" /> Add Permit
              </button>
            }
          />
        ) : (
          <div style={{ padding: '4px 8px 8px' }}>
            <Table
              headers={['Permit #', 'Type', 'Agency', 'Status', 'Fee', 'Issue Date', 'Expiry']}
              rows={permits.map(p => {
                const status = p.expiry_date && p.expiry_date < today ? 'expired' : (p.status || 'applied');
                const badgeColor = STATUS_BADGE[status] || 'muted';
                return [
                  <span key="n" style={{ color: T.gold, fontWeight: 700 }}>{p.permit_number}</span>,
                  p.permit_type,
                  <span key="a" style={{ color: T.muted }}>{p.issuing_authority}</span>,
                  <Badge key="s" label={status} color={badgeColor} />,
                  <span key="f" style={{ fontWeight: 600 }}>${(p.fee || 0).toLocaleString()}</span>,
                  <span key="i" style={{ color: T.muted }}>{p.issued_date || '—'}</span>,
                  <span key="e" style={{ color: p.expiry_date && p.expiry_date < today ? T.red : T.muted }}>
                    {p.expiry_date || '—'}
                  </span>,
                ];
              })}
            />
          </div>
        )}
      </SectionCard>
    </PremiumSurface>
  );
}
