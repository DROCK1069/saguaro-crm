'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { humanError } from '@/lib/errors';
import { useParams } from 'next/navigation';
import SaguaroDatePicker from '../../../../../components/SaguaroDatePicker';
import { toCents, toDollars, sumCents } from '@/lib/calc';
import { PremiumSurface, ModuleHero, SectionCard, StatCard, PremiumEmpty, goldButtonStyle, ghostButtonStyle } from '@/components/ui/premium';
import { FileText, CurrencyDollar, Plus, FilePlus, FileArrowUp, Eye, FileDashed } from '@phosphor-icons/react';

const GOLD='#F59E0B', DARK='#0a0a0a', RAISED='#141416', BORDER='rgba(255,255,255,0.12)', DIM='#CBD5E1', TEXT='#FFFFFF', GREEN='#3dd68c', RED='#ef4444';

interface Contract {
  id: string;
  sub_name: string;
  trade: string;
  amount: number;
  status: string;
  execution_date: string | null;
  scope: string;
  start_date: string;
  end_date: string;
  retainage_pct: number;
  pdf_url: string | null;
  project_id: string;
}

const EMPTY_FORM = { sub_name: '', trade: '', amount: 0, scope: '', start_date: '', end_date: '', retainage_pct: 10 };

// The `contracts` table stores party_name / scope_of_work / executed_date /
// amount — NOT the sub_name / scope / execution_date this UI was reading, so
// rows came back blank. Map the real DB columns onto the shape the page renders.
function normalizeContract(r: any): Contract {
  return {
    id: r.id,
    sub_name: r.party_name ?? r.vendor_name ?? r.counterparty_name ?? '',
    trade: r.trade ?? '',
    amount: Number(r.amount ?? r.contract_amount ?? 0),
    status: r.status ?? 'Draft',
    execution_date: r.executed_date ?? (r.executed_at ? String(r.executed_at).slice(0, 10) : null),
    scope: r.scope_of_work ?? r.scope_summary ?? '',
    start_date: r.start_date ?? '',
    end_date: r.end_date ?? '',
    retainage_pct: Number(r.retainage_pct ?? 0),
    pdf_url: r.pdf_url ?? r.file_url ?? null,
    project_id: r.project_id,
  };
}

function statusBadge(status: string) {
  const map: Record<string, { bg: string; color: string }> = {
    Draft: { bg: 'rgba(143,163,192,.2)', color: DIM },
    Sent: { bg: 'rgba(245,158,11,.2)', color: '#FBBF24' },
    Executed: { bg: 'rgba(61,214,140,.2)', color: GREEN },
    Complete: { bg: 'rgba(245, 158, 11,.2)', color: GOLD },
  };
  const s = map[status] || { bg: 'rgba(143,163,192,.2)', color: DIM };
  return <span style={{ padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color, fontSize: 11, fontWeight: 700 }}>{status}</span>;
}

export default function ContractsPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/contracts`);
      const json = await res.json();
      setContracts((json.contracts || []).map(normalizeContract));
    } catch {
      setContracts([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchContracts(); }, [fetchContracts]);

  async function handleSave() {
    if (!form.sub_name || !form.trade || !form.amount) {
      setErrorMsg('Subcontractor name, trade, and amount are required.');
      return;
    }
    setSaving(true);
    setErrorMsg('');
    try {
      // The create route reads snake_case and requires project_id + title +
      // party_name (both NOT NULL). This form's fields are sub_name/scope, so the
      // old `{ projectId, ...form }` body left all three unset and the route 400'd
      // every time — no contract ever persisted. Map to the real column names.
      const res = await fetch('/api/contracts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          title: form.sub_name,
          party_name: form.sub_name,
          trade: form.trade,
          amount: form.amount,
          scope_of_work: form.scope,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          retainage_pct: form.retainage_pct,
          status: 'Draft',
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.contract) throw new Error(json.error || 'Failed to save contract');
      setContracts(prev => [normalizeContract(json.contract), ...prev]);
      setShowForm(false);
      setForm(EMPTY_FORM);
      setSuccessMsg('Contract created successfully.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error(err); setErrorMsg(humanError(err, 'Failed to save the contract. Please try again.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(id: string, file: File) {
    setUploadingId(id);
    setErrorMsg('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/contracts/${id}/upload`, { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to upload the signed contract.');
      // Attach the freshly signed url to this contract so "View PDF" appears now.
      const signedUrl: string | null = json.pdf_url || json.file_url || json.url || null;
      setContracts(prev => prev.map(c => (c.id === id ? { ...c, pdf_url: signedUrl } : c)));
      setSuccessMsg('Signed contract uploaded.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error(err); setErrorMsg(humanError(err, 'Failed to upload the signed contract. Please try again.'));
    } finally {
      setUploadingId(null);
    }
  }

  const total = toDollars(sumCents(contracts.map(c => toCents(c.amount || 0))));
  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', background: '#1c1c1e', border: '1px solid ' + BORDER, borderRadius: 6, color: TEXT, fontSize: 13 };
  const label: React.CSSProperties = { fontSize: 12, color: DIM, marginBottom: 4, display: 'block' };
  // Compact ghost action buttons for in-row actions (View PDF / Upload Signed).
  const rowBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', background: 'rgba(255,255,255,0.05)', border: '1px solid ' + BORDER, borderRadius: 8, color: 'rgba(255,255,255,0.82)', fontSize: 12, fontWeight: 700, cursor: 'pointer' };

  return (
    <PremiumSurface maxWidth={1600}>
      {/* Header */}
      <ModuleHero
        eyebrow="Contracts"
        eyebrowIcon={<FileText size={13} weight="fill" color={GOLD} />}
        title="Contract"
        accent="Ledger"
        subtitle="Subcontractor and vendor contracts"
        actions={
          <button onClick={() => { setShowForm(p => !p); setErrorMsg(''); }} style={goldButtonStyle} className="pmBtn">
            <Plus size={15} weight="bold" /> New Contract
          </button>
        }
      />

      {successMsg && <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(61,214,140,.15)', border: '1px solid rgba(61,214,140,.4)', borderRadius: 10, color: GREEN, fontSize: 13 }}>{successMsg}</div>}
      {errorMsg && <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.4)', borderRadius: 10, color: RED, fontSize: 13 }}>{errorMsg}</div>}

      {showForm && (
        <div style={{ marginBottom: 24 }}>
          <SectionCard title="New Contract" icon={<FilePlus size={17} weight="duotone" color={GOLD} />}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              <div><label style={label}>Subcontractor Name *</label><input type="text" value={form.sub_name} onChange={e => setForm(p => ({ ...p, sub_name: e.target.value }))} style={inp} /></div>
              <div><label style={label}>Trade *</label><input type="text" value={form.trade} onChange={e => setForm(p => ({ ...p, trade: e.target.value }))} style={inp} /></div>
              <div><label style={label}>Contract Amount ($) *</label><input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: Number(e.target.value) }))} style={inp} /></div>
              <div><label style={label}>Start Date</label><SaguaroDatePicker value={form.start_date} onChange={v => setForm(p => ({ ...p, start_date: v }))} style={inp} /></div>
              <div><label style={label}>End Date</label><SaguaroDatePicker value={form.end_date} onChange={v => setForm(p => ({ ...p, end_date: v }))} style={inp} /></div>
              <div><label style={label}>Retainage %</label><input type="number" value={form.retainage_pct} onChange={e => setForm(p => ({ ...p, retainage_pct: Number(e.target.value) }))} style={inp} /></div>
              <div style={{ gridColumn: 'span 3' }}><label style={label}>Scope of Work</label><textarea value={form.scope} onChange={e => setForm(p => ({ ...p, scope: e.target.value }))} rows={3} style={{ ...inp, resize: 'vertical' }} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={handleSave} disabled={saving} style={{ ...goldButtonStyle, opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer' }} className="pmBtn">
                {saving ? 'Saving...' : 'Save Contract'}
              </button>
              <button onClick={() => { setShowForm(false); setErrorMsg(''); }} style={ghostButtonStyle} className="pmBtn">Cancel</button>
            </div>
          </SectionCard>
        </div>
      )}

      {/* KPI stats */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
          <StatCard
            icon={<FileText size={19} weight="duotone" color={GOLD} />}
            label="Total Contracts"
            value={String(contracts.length)}
            accent={GOLD}
            sub="on this project"
          />
          <StatCard
            icon={<CurrencyDollar size={19} weight="duotone" color={GOLD} />}
            label="Total Value"
            value={`$${total.toLocaleString()}`}
            accent={GOLD}
            sub="combined contract value"
          />
        </div>
      )}

      {/* Contract table */}
      <SectionCard title="Contracts" subtitle="Subcontractor and vendor contracts" icon={<FileText size={17} weight="duotone" color={GOLD} />}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: DIM }}>Loading...</div>
        ) : contracts.length === 0 ? (
          <PremiumEmpty
            icon={<FileDashed size={30} weight="duotone" color={GOLD} />}
            title="No contracts yet"
            description="Create your first subcontractor or vendor contract to start tracking scope, amounts, and signed documents."
            action={
              <button onClick={() => { setShowForm(true); setErrorMsg(''); }} style={goldButtonStyle} className="pmBtn">
                <Plus size={15} weight="bold" /> New Contract
              </button>
            }
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Sub / Vendor','Trade','Contract Amount','Status','Execution Date','Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: DIM, borderBottom: '1px solid ' + BORDER, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contracts.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <td style={{ padding: '10px 14px', color: TEXT, fontWeight: 600 }}>{c.sub_name}</td>
                    <td style={{ padding: '10px 14px', color: DIM }}>{c.trade}</td>
                    <td style={{ padding: '10px 14px', color: GOLD, fontWeight: 700 }}>${c.amount?.toLocaleString()}</td>
                    <td style={{ padding: '10px 14px' }}>{statusBadge(c.status)}</td>
                    <td style={{ padding: '10px 14px', color: DIM }}>{c.execution_date || '—'}</td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                      {c.pdf_url && (
                        <button onClick={() => window.open(c.pdf_url!, '_blank')} style={{ ...rowBtn, marginRight: 6 }}><Eye size={13} weight="bold" /> View PDF</button>
                      )}
                      <label style={rowBtn}>
                        <FileArrowUp size={13} weight="bold" /> {uploadingId === c.id ? 'Uploading...' : 'Upload Signed'}
                        <input type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) handleUpload(c.id, e.target.files[0]); }} />
                      </label>
                    </td>
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
