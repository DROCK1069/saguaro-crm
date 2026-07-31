'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Badge, Btn, Table, T } from '@/components/ui/shell';
import {
  PremiumSurface, ModuleHero, StatCard, SectionCard, PremiumEmpty,
  goldButtonStyle, ghostButtonStyle,
} from '@/components/ui/premium';
import { FileText, NotePencil, Export, CheckCircle, Plus } from '@phosphor-icons/react';

interface Spec {
  id: string;
  division: string;
  section: string;
  title: string;
  status: string;
  last_updated: string;
  url: string | null;
  related_submittals: string[];
  project_id: string;
}

const STATUS_BADGE: Record<string, 'muted' | 'blue' | 'amber' | 'green'> = {
  draft: 'muted',
  issued: 'blue',
  revised: 'amber',
  approved: 'green',
};

const EMPTY_FORM = { division: '', section: '', title: '' };

// The API returns raw `specifications` rows (section_number / updated_at /
// file_url) whose names don't match this page's display fields. Normalize so a
// saved spec's section number and file link actually render on reload.
function normalizeSpec(r: Record<string, unknown>): Spec {
  return {
    id: String(r.id ?? ''),
    division: String(r.division ?? ''),
    section: String(r.section ?? r.section_number ?? ''),
    title: String(r.title ?? ''),
    status: String(r.status ?? 'draft'),
    last_updated: String(r.last_updated ?? r.updated_at ?? r.created_at ?? ''),
    url: (r.url as string | null) ?? (r.file_url as string | null) ?? (r.pdf_url as string | null) ?? null,
    related_submittals: Array.isArray(r.related_submittals) ? (r.related_submittals as string[]) : [],
    project_id: String(r.project_id ?? ''),
  };
}

export default function SpecsPage() {
  const { projectId } = useParams() as { projectId: string };
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState<string | null>(null);

  const fetchSpecs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/specs`);
      const json = await res.json();
      setSpecs((json.specs || []).map(normalizeSpec));
    } catch {
      setSpecs([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchSpecs(); }, [fetchSpecs]);

  const filtered = specs.filter(s =>
    !search || s.title.toLowerCase().includes(search.toLowerCase()) || s.section.includes(search) || s.division.includes(search)
  );

  const draftCount = specs.filter(s => s.status === 'draft').length;
  const issuedCount = specs.filter(s => s.status === 'issued').length;
  const approvedCount = specs.filter(s => s.status === 'approved').length;

  async function handleSave() {
    if (!form.section || !form.title) { setErrorMsg('Section number and title are required.'); return; }
    setSaving(true);
    setErrorMsg('');
    const today = new Date().toISOString().split('T')[0];
    try {
      const res = await fetch('/api/specs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, status: 'draft', last_updated: today, ...form }),
      });
      const json = await res.json();
      if (!res.ok || !json.spec) throw new Error(json.error || 'Create failed');
      setSpecs(prev => [...prev, normalizeSpec(json.spec)].sort((a, b) => a.section.localeCompare(b.section)));
      setShowForm(false);
      setForm(EMPTY_FORM);
      setSuccessMsg('Spec section added.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch {
      setErrorMsg('Could not add the spec section. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadSpec(specId: string, file: File) {
    setUploading(specId);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('specId', specId);
      const res = await fetch(`/api/specs/${specId}/upload`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error('upload failed');
      setSuccessMsg('Spec file uploaded.');
      fetchSpecs();
    } catch {
      setErrorMsg('Could not upload the spec file. Please try again.');
    } finally {
      setUploading(null);
      setTimeout(() => { setSuccessMsg(''); setErrorMsg(''); }, 4000);
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${T.border}`, borderRadius: 10, color: T.white, fontSize: 13, outline: 'none',
  };
  const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 };

  return (
    <PremiumSurface maxWidth={1600}>

      {/* Header */}
      <ModuleHero
        eyebrow="SPECIFICATIONS"
        eyebrowIcon={<FileText size={13} weight="fill" color="#F59E0B" />}
        title="Spec"
        accent="Sections"
        subtitle="Project specifications organized by CSI division."
        actions={
          <button
            onClick={() => { setShowForm(p => !p); setErrorMsg(''); }}
            className="pmBtn"
            style={showForm ? ghostButtonStyle : goldButtonStyle}
          >
            {showForm ? 'Cancel' : (<><Plus size={15} weight="bold" /> Add Section</>)}
          </button>
        }
      />

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16, marginBottom: 28 }}>
        <StatCard
          icon={<FileText size={19} weight="duotone" color={T.gold} />}
          label="Total Sections" value={String(specs.length)} accent={T.gold}
          sub="across all divisions" delay={0.02}
        />
        <StatCard
          icon={<NotePencil size={19} weight="duotone" color={T.gold} />}
          label="Draft" value={String(draftCount)}
          sub="not yet issued" delay={0.06}
        />
        <StatCard
          icon={<Export size={19} weight="duotone" color={T.gold} />}
          label="Issued" value={String(issuedCount)} accent={T.gold}
          sub="out for review" delay={0.10}
        />
        <StatCard
          icon={<CheckCircle size={19} weight="duotone" color={T.green} />}
          label="Approved" value={String(approvedCount)} accent={T.green}
          sub="finalized" delay={0.14}
        />
      </div>

      {successMsg && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: T.greenDim, border: `1px solid rgba(34,197,94,0.4)`, borderRadius: 10, color: T.green, fontSize: 13 }}>{successMsg}</div>
      )}
      {errorMsg && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: T.redDim, border: `1px solid rgba(239,68,68,0.4)`, borderRadius: 10, color: T.red, fontSize: 13 }}>{errorMsg}</div>
      )}

      {/* Create Form */}
      {showForm && (
        <SectionCard
          icon={<Plus size={17} weight="bold" color={T.gold} />}
          title="Add Spec Section"
          style={{ marginBottom: 24 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            <div>
              <label style={lbl}>Division #</label>
              <input value={form.division} onChange={e => setForm(p => ({ ...p, division: e.target.value }))} placeholder="e.g. 03" style={inp} />
            </div>
            <div>
              <label style={lbl}>Section # *</label>
              <input value={form.section} onChange={e => setForm(p => ({ ...p, section: e.target.value }))} placeholder="e.g. 03 31 00" style={inp} />
            </div>
            <div>
              <label style={lbl}>Title *</label>
              <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} style={inp} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              className="pmBtn"
              style={{ ...goldButtonStyle, opacity: saving ? 0.5 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
            >
              {saving ? 'Saving...' : 'Save Section'}
            </button>
            <button
              onClick={() => { setShowForm(false); setErrorMsg(''); }}
              className="pmBtn"
              style={ghostButtonStyle}
            >
              Cancel
            </button>
          </div>
        </SectionCard>
      )}

      {/* Table */}
      <SectionCard
        icon={<FileText size={17} weight="duotone" color={T.gold} />}
        title="Sections"
        action={
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search sections..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.border}`, borderRadius: 10, color: T.white, fontSize: 13, width: 220, outline: 'none' }}
            />
            <span style={{ fontSize: 12, color: T.muted, whiteSpace: 'nowrap' }}>{filtered.length} section{filtered.length !== 1 ? 's' : ''}</span>
          </div>
        }
        flush
      >
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: T.muted, fontSize: 13 }}>Loading specifications…</div>
        ) : specs.length === 0 ? (
          <div style={{ padding: '12px 8px' }}>
            <PremiumEmpty
              icon={<FileText size={30} weight="duotone" color={T.gold} />}
              title="No spec sections yet"
              description="Add your first spec section to organize project specifications by CSI division."
              action={
                <button onClick={() => { setShowForm(true); setErrorMsg(''); }} className="pmBtn" style={goldButtonStyle}>
                  <Plus size={15} weight="bold" /> Add Section
                </button>
              }
            />
          </div>
        ) : (
          <Table
            headers={['Section #', 'Title', 'Division', 'Status', 'Last Updated', 'Submittals', 'Actions']}
            rows={filtered.map(s => [
              <span key="sec" style={{ color: T.gold, fontWeight: 700 }}>{s.section}</span>,
              s.title,
              <span key="div" style={{ color: T.muted }}>{s.division || '—'}</span>,
              <Badge key="st" label={s.status} color={STATUS_BADGE[s.status] || 'muted'} />,
              <span key="upd" style={{ color: T.muted, whiteSpace: 'nowrap' }}>{s.last_updated || '—'}</span>,
              <span key="sub" style={{ color: T.muted, fontSize: 12 }}>
                {s.related_submittals && s.related_submittals.length > 0
                  ? s.related_submittals.join(', ')
                  : '—'}
              </span>,
              <div key="act" style={{ display: 'flex', gap: 6 }}>
                {s.url && (
                  <Btn size="sm" variant="ghost" onClick={() => window.open(s.url!, '_blank')}>View</Btn>
                )}
                <label style={{ cursor: 'pointer' }}>
                  <Btn size="sm" variant="ghost" disabled={uploading === s.id}>
                    {uploading === s.id ? 'Uploading...' : 'Upload'}
                  </Btn>
                  <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) handleUploadSpec(s.id, e.target.files[0]); }} />
                </label>
              </div>,
            ])}
          />
        )}
      </SectionCard>
    </PremiumSurface>
  );
}
