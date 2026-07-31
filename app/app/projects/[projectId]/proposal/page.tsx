'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import MarkOutcomeModal from '@/components/bids/MarkOutcomeModal';
import { PremiumSurface, ModuleHero, SectionCard, StatCard, PremiumEmpty, goldButtonStyle, ghostButtonStyle } from '@/components/ui/premium';
import { FileText, FilePlus, ClockCounterClockwise, SealCheck, Plus } from '@phosphor-icons/react';

const GOLD='#F59E0B', RAISED='#141416', BORDER='rgba(255,255,255,0.12)', DIM='#CBD5E1', TEXT='#FFFFFF', GREEN='#3dd68c', RED='#ef4444';

interface Proposal {
  id: string;
  version: string;
  created_date: string;
  amount: number;
  status: string;
  notes: string;
  pdf_url: string | null;
  project_id: string;
}

const STATUS_MAP: Record<string, { bg: string; color: string }> = {
  Draft: { bg: 'rgba(143,163,192,.2)', color: DIM },
  Sent: { bg: 'rgba(245,158,11,.2)', color: '#FBBF24' },
  Under_Review: { bg: 'rgba(245,158,11,.2)', color: '#f59e0b' },
  Accepted: { bg: 'rgba(61,214,140,.2)', color: GREEN },
  Superseded: { bg: 'rgba(143,163,192,.2)', color: DIM },
  Rejected: { bg: 'rgba(239,68,68,.2)', color: RED },
};

const EMPTY_FORM = { amount: 0, notes: '' };

// The API returns raw `proposals` rows (proposal_number / created_at /
// description) that don't match this page's display fields (version /
// created_date / notes). Normalize so a saved proposal's version, date, and
// notes actually render on reload.
function normalizeProposal(r: Record<string, any>): Proposal {
  return {
    id: String(r.id ?? ''),
    version: String(r.version ?? r.proposal_number ?? ''),
    created_date: String(r.created_date ?? r.created_at ?? '').split('T')[0],
    amount: Number(r.amount ?? r.total_amount ?? 0),
    status: String(r.status ?? 'Draft'),
    notes: String(r.notes ?? r.description ?? ''),
    pdf_url: (r.pdf_url as string | null) ?? null,
    project_id: String(r.project_id ?? ''),
  };
}

export default function ProposalPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  // Win/Loss capture: after flipping accept/decline we open the universal outcome modal.
  const [outcomeModal, setOutcomeModal] = useState<{ proposalId: string; defaultOutcome: 'won' | 'lost'; ourAmount: number } | null>(null);

  const fetchProposals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/proposals`);
      const json = await res.json();
      setProposals((json.proposals || []).map(normalizeProposal));
    } catch {
      setProposals([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchProposals(); }, [fetchProposals]);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}`)
      .then(r => r.json())
      .then(d => { if (d?.project?.name) setProjectName(d.project.name); })
      .catch(() => {});
  }, [projectId]);

  const accepted = proposals.find(p => p.status === 'Accepted');
  const latestVersion = proposals.length ? `v${proposals.length + 1}.0` : 'v1.0';

  async function handleSave() {
    if (!form.amount) { setErrorMsg('Amount is required.'); return; }
    setSaving(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/proposals/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, version: latestVersion, status: 'Draft', ...form }) });
      const json = await res.json();
      if (!res.ok || !json.proposal) throw new Error(json.error || 'Create failed');
      setProposals(prev => [...prev.map(p => p.status !== 'Accepted' ? { ...p, status: 'Superseded' } : p), normalizeProposal(json.proposal)]);
      setShowForm(false);
      setForm(EMPTY_FORM);
      setSuccessMsg('Proposal version created.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch {
      setErrorMsg('Could not create the proposal. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSend(id: string) {
    try {
      const res = await fetch(`/api/proposals/${id}/send`, { method: 'POST' });
      if (!res.ok) throw new Error('send failed');
      setProposals(prev => prev.map(p => p.id === id ? { ...p, status: 'Sent' } : p));
      setSuccessMsg('Proposal marked as sent.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch {
      setErrorMsg('Could not mark the proposal as sent. Please try again.');
      setTimeout(() => setErrorMsg(''), 4000);
    }
  }

  async function handleUpload(id: string, file: File) {
    setUploadingId(id);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/proposals/${id}/upload`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error('upload failed');
      setSuccessMsg('PDF uploaded.');
      fetchProposals();
    } catch {
      setErrorMsg('Could not upload the PDF. Please try again.');
    } finally {
      setUploadingId(null);
      setTimeout(() => { setSuccessMsg(''); setErrorMsg(''); }, 4000);
    }
  }

  // Flip the proposal's status, then open the universal win/loss capture modal.
  async function handleMarkOutcome(p: Proposal, accepted: boolean) {
    try {
      const res = await fetch(`/api/proposals/${p.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: accepted ? 'accepted' : 'declined' }),
      });
      if (!res.ok) throw new Error('status failed');
      setSuccessMsg(accepted ? 'Proposal marked accepted.' : 'Proposal marked declined.');
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchProposals();
      setOutcomeModal({ proposalId: p.id, defaultOutcome: accepted ? 'won' : 'lost', ourAmount: p.amount });
    } catch {
      setErrorMsg(accepted ? 'Could not mark the proposal accepted. Please try again.' : 'Could not mark the proposal declined. Please try again.');
      setTimeout(() => setErrorMsg(''), 4000);
    }
  }

  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', background: '#1c1c1e', border: '1px solid ' + BORDER, borderRadius: 6, color: TEXT, fontSize: 13 };
  const label: React.CSSProperties = { fontSize: 12, color: DIM, marginBottom: 4, display: 'block' };

  return (
    <PremiumSurface maxWidth={1600}>
      {/* Header */}
      <ModuleHero
        eyebrow="Proposal"
        eyebrowIcon={<FileText size={13} weight="fill" color="#F59E0B" />}
        title="Proposals &"
        accent="Contract Amounts"
        subtitle="Version your project proposals, track contract amounts, and capture win/loss outcomes."
        actions={
          <button onClick={() => { setShowForm(p => !p); setErrorMsg(''); }} style={goldButtonStyle} className="pmBtn">
            <Plus size={15} weight="bold" /> New Version
          </button>
        }
      />

      {/* Accepted proposal callout — the headline KPI */}
      {accepted && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
          <StatCard
            icon={<SealCheck size={19} weight="duotone" color={GREEN} />}
            label="Accepted Proposal"
            value={`$${accepted.amount.toLocaleString()}`}
            accent={GREEN}
            sub={accepted.notes ? `${accepted.version} — ${accepted.notes}` : accepted.version}
          />
        </div>
      )}

      {successMsg && <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(61,214,140,.15)', border: '1px solid rgba(61,214,140,.4)', borderRadius: 10, color: GREEN, fontSize: 13 }}>{successMsg}</div>}
      {errorMsg && <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.4)', borderRadius: 10, color: RED, fontSize: 13 }}>{errorMsg}</div>}

      {showForm && (
        <div style={{ marginBottom: 24 }}>
          <SectionCard title={`New Proposal Version (${latestVersion})`} icon={<FilePlus size={17} weight="duotone" color={GOLD} />}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14 }}>
              <div><label style={label}>Amount ($) *</label><input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: Number(e.target.value) }))} style={inp} /></div>
              <div><label style={label}>Notes</label><input type="text" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="e.g. Revised after value engineering" style={inp} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={handleSave} disabled={saving} style={{ ...goldButtonStyle, opacity: saving ? 0.7 : 1 }} className="pmBtn">
                {saving ? 'Saving...' : 'Create Version'}
              </button>
              <button onClick={() => { setShowForm(false); setErrorMsg(''); }} style={ghostButtonStyle} className="pmBtn">Cancel</button>
            </div>
          </SectionCard>
        </div>
      )}

      {/* Version history */}
      <SectionCard title="Proposal Versions" icon={<ClockCounterClockwise size={17} weight="duotone" color={GOLD} />} flush>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: DIM }}>Loading...</div>
        ) : proposals.length === 0 ? (
          <PremiumEmpty
            icon={<FileText size={30} weight="duotone" color={GOLD} />}
            title="No proposals yet"
            description="Create your first proposal version to start tracking contract amounts and outcomes."
            action={
              <button onClick={() => { setShowForm(true); setErrorMsg(''); }} style={goldButtonStyle} className="pmBtn">
                <Plus size={15} weight="bold" /> New Version
              </button>
            }
          />
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' as const }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {['Version','Created','Amount','Status','Notes','Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: DIM, borderBottom: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {proposals.map(p => {
                  const sc = STATUS_MAP[p.status.replace(' ', '_')] || STATUS_MAP[p.status] || { bg: 'rgba(143,163,192,.2)', color: DIM };
                  const s = p.status.toLowerCase();
                  const outcomeSet = s === 'accepted' || s === 'declined' || s === 'rejected';
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: p.status === 'Accepted' ? 'rgba(61,214,140,.06)' : 'transparent' }}>
                      <td style={{ padding: '10px 16px', color: GOLD, fontWeight: 700 }}>{p.version}</td>
                      <td style={{ padding: '10px 16px', color: DIM }}>{p.created_date}</td>
                      <td style={{ padding: '10px 16px', color: TEXT, fontWeight: 800, fontSize: 14 }}>${p.amount?.toLocaleString()}</td>
                      <td style={{ padding: '10px 16px' }}><span style={{ padding: '3px 10px', borderRadius: 20, background: sc.bg, color: sc.color, fontSize: 11, fontWeight: 700 }}>{p.status}</span></td>
                      <td style={{ padding: '10px 16px', color: DIM }}>{p.notes}</td>
                      <td style={{ padding: '10px 16px', whiteSpace: 'nowrap', display: 'flex', gap: 6, alignItems: 'center' }}>
                        {p.pdf_url && <button onClick={() => window.open(p.pdf_url!, '_blank')} style={{ padding: '4px 10px', background: RAISED, border: '1px solid ' + BORDER, borderRadius: 5, color: DIM, fontSize: 12, cursor: 'pointer' }}>View PDF</button>}
                        {p.status === 'Draft' && <button onClick={() => handleSend(p.id)} style={{ padding: '4px 10px', background: 'rgba(245,158,11,.2)', border: '1px solid rgba(245,158,11,.4)', borderRadius: 5, color: '#FBBF24', fontSize: 12, cursor: 'pointer' }}>Send</button>}
                        {!outcomeSet && <button onClick={() => handleMarkOutcome(p, true)} style={{ padding: '4px 10px', background: 'rgba(61,214,140,.2)', border: '1px solid rgba(61,214,140,.4)', borderRadius: 5, color: GREEN, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>Mark Accepted</button>}
                        {!outcomeSet && <button onClick={() => handleMarkOutcome(p, false)} style={{ padding: '4px 10px', background: 'rgba(239,68,68,.2)', border: '1px solid rgba(239,68,68,.4)', borderRadius: 5, color: RED, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>Mark Declined</button>}
                        <label style={{ padding: '4px 10px', background: RAISED, border: '1px solid ' + BORDER, borderRadius: 5, color: DIM, fontSize: 12, cursor: 'pointer' }}>
                          {uploadingId === p.id ? 'Uploading...' : 'Upload PDF'}
                          <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) handleUpload(p.id, e.target.files[0]); }} />
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {outcomeModal && (
        <MarkOutcomeModal
          open
          onClose={() => setOutcomeModal(null)}
          source="proposal"
          sourceId={outcomeModal.proposalId}
          defaultOutcome={outcomeModal.defaultOutcome}
          projectName={projectName || undefined}
          ourAmount={outcomeModal.ourAmount || undefined}
          onRecorded={() => fetchProposals()}
        />
      )}
    </PremiumSurface>
  );
}
