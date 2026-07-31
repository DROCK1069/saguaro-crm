'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { T, Badge, Table } from '@/components/ui/shell';
import {
  PremiumSurface, ModuleHero, StatCard, SectionCard, PremiumEmpty,
  goldButtonStyle, ghostButtonStyle,
} from '@/components/ui/premium';
import { Users, CheckCircle, Clock, XCircle, FileText, PaperPlaneTilt, Plus } from '@phosphor-icons/react';

interface W9Sub {
  id: string;
  name: string;
  email: string;
  w9_status: string;
  requested_date: string | null;
  received_date: string | null;
}

const STATUS_BADGE: Record<string, 'green' | 'amber' | 'muted'> = {
  received: 'green',
  pending: 'amber',
  not_requested: 'muted',
};

const STATUS_LABEL: Record<string, string> = {
  received: 'Received',
  submitted: 'Received',
  pending: 'Pending',
  not_requested: 'Not Requested',
};

// Semantic accents tuned to the cinematic dark surface (match the dashboard).
const GOLD = '#F59E0B';
const GREEN = '#45B37D';
const AMBER = '#F0A63C';
const RED = '#E0644E';

const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.border}`, borderRadius: 10, color: T.white, fontSize: 13, outline: 'none', boxSizing: 'border-box' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.62)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 };
// Compact on-brand action button for in-table row actions.
const rowActionStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '6px 13px', borderRadius: 8, cursor: 'pointer',
  background: 'rgba(245,158,11,0.10)', color: '#FBBF24',
  border: `1px solid rgba(245,158,11,0.35)`, fontWeight: 700, fontSize: 12,
  whiteSpace: 'nowrap',
};

export default function W9Page() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [subs, setSubs] = useState<W9Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [requestingId, setRequestingId] = useState<string | null>(null);

  const fetchSubs = useCallback(async () => {
    setLoading(true);
    try {
      // The project "subs" come from the contracts table (vendor_name only, no
      // w9_status columns). The real W-9 state lives in w9_requests — merge it
      // in so a sent request actually reflects as Pending/Received and survives
      // reload (the old code read a nonexistent contracts.w9_status and always
      // showed "not_requested").
      const [projRes, w9Res] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch(`/api/documents/w9-request?projectId=${projectId}`),
      ]);
      const data = await projRes.json().catch(() => ({}));
      const w9Data = await w9Res.json().catch(() => ({}));
      const subList = data.subs || data.subcontractors || [];
      const w9reqs: any[] = w9Data.w9Requests || [];

      const norm = (v: any) => String(v || '').toLowerCase().trim();
      // Requests arrive newest-first; keep the newest per key.
      const byName = new Map<string, any>();
      const byEmail = new Map<string, any>();
      for (const r of w9reqs) {
        const n = norm(r.vendor_name); const e = norm(r.vendor_email);
        if (n && !byName.has(n)) byName.set(n, r);
        if (e && !byEmail.has(e)) byEmail.set(e, r);
      }
      const statusOf = (r: any) =>
        (r.status === 'submitted' || r.status === 'received') ? 'received' : 'pending';
      const dateOnly = (v: any) => (v ? String(v).split('T')[0] : null);

      const rows: W9Sub[] = subList.map((s: any) => {
        const name = s.vendor_name || s.name || s.company_name || '';
        const email = s.vendor_email || s.email || s.contact_email || '';
        const match = (email && byEmail.get(norm(email))) || (name && byName.get(norm(name))) || null;
        return {
          id: s.id || s.sub_id || `s-${Math.random()}`,
          name,
          email,
          w9_status: match ? statusOf(match) : 'not_requested',
          requested_date: match ? dateOnly(match.created_at) : null,
          received_date: match ? dateOnly(match.submitted_at) : null,
        };
      });

      // Include standalone vendor requests (sent via the form, not tied to a
      // contract) so they are visible too.
      const seen = new Set(rows.map((r) => norm(r.email) || norm(r.name)));
      for (const r of w9reqs) {
        const key = norm(r.vendor_email) || norm(r.vendor_name);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        rows.push({
          id: r.id,
          name: r.vendor_name || '',
          email: r.vendor_email || '',
          w9_status: statusOf(r),
          requested_date: dateOnly(r.created_at),
          received_date: dateOnly(r.submitted_at),
        });
      }
      setSubs(rows);
    } catch {
      setSubs([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchSubs(); }, [fetchSubs]);

  const totalSubs = subs.length;
  const receivedCount = subs.filter(s => s.w9_status === 'received' || s.w9_status === 'submitted').length;
  const pendingCount = subs.filter(s => s.w9_status === 'pending').length;
  const missingCount = subs.filter(s => s.w9_status === 'not_requested').length;

  async function requestW9(subId: string, subName: string, subEmail: string) {
    if (!subEmail.trim()) {
      setToast(`No email on file for ${subName || 'this vendor'}. Use "Send W-9 Request" to enter one.`);
      setTimeout(() => setToast(''), 4000);
      return;
    }
    setRequestingId(subId);
    try {
      const res = await fetch('/api/documents/w9-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, subId, vendorName: subName, vendorEmail: subEmail }),
      });
      if (!res.ok) throw new Error('request failed');
      setSubs(prev => prev.map(s => s.id === subId ? { ...s, w9_status: 'pending', requested_date: new Date().toISOString().split('T')[0] } : s));
      setToast(`W-9 request sent to ${subName}.`);
    } catch {
      setToast(`Could not send the W-9 request to ${subName}. Please try again.`);
    }
    setRequestingId(null);
    setTimeout(() => setToast(''), 4000);
  }

  async function sendNewRequest() {
    if (!formName.trim() || !formEmail.trim()) return;
    setSending(true);
    try {
      const res = await fetch('/api/documents/w9-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, vendorName: formName, vendorEmail: formEmail }),
      });
      if (!res.ok) throw new Error('request failed');
      setToast(`W-9 request sent to ${formEmail}.`);
      setFormName('');
      setFormEmail('');
      setShowForm(false);
      fetchSubs();
    } catch {
      setToast('Could not send the W-9 request. Please try again.');
    }
    setSending(false);
    setTimeout(() => setToast(''), 4000);
  }

  const formValid = !!formName.trim() && !!formEmail.trim();

  return (
    <PremiumSurface maxWidth={1600}>
      {/* Header */}
      <ModuleHero
        eyebrow="W-9 Requests"
        eyebrowIcon={<FileText size={13} weight="fill" color={GOLD} />}
        title="W-9"
        accent="Requests"
        subtitle="Collect W-9 forms from vendors and subcontractors."
        actions={
          <button
            onClick={() => setShowForm(p => !p)}
            className="pmBtn"
            style={showForm ? ghostButtonStyle : goldButtonStyle}
          >
            {showForm ? 'Cancel' : <><Plus size={15} weight="bold" /> Send W-9 Request</>}
          </button>
        }
      />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard icon={<Users size={19} weight="duotone" color={GOLD} />} label="Total Subs" value={String(totalSubs)} accent={GOLD} delay={0.02} />
        <StatCard icon={<CheckCircle size={19} weight="duotone" color={GREEN} />} label="W9 Received" value={String(receivedCount)} accent={receivedCount ? GREEN : undefined} delay={0.06} />
        <StatCard icon={<Clock size={19} weight="duotone" color={AMBER} />} label="W9 Pending" value={String(pendingCount)} accent={pendingCount ? AMBER : undefined} delay={0.10} />
        <StatCard icon={<XCircle size={19} weight="duotone" color={RED} />} label="W9 Missing" value={String(missingCount)} accent={missingCount ? RED : undefined} delay={0.14} />
      </div>

      {toast && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: T.greenDim, border: `1px solid rgba(34,197,94,0.3)`, borderRadius: 10, color: T.green, fontSize: 13 }}>
          {toast}
        </div>
      )}

      {/* Send Form */}
      {showForm && (
        <SectionCard
          title="Send W-9 Request"
          icon={<PaperPlaneTilt size={17} weight="duotone" color={GOLD} />}
          style={{ marginBottom: 24 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={lbl}>Vendor / Sub Name *</label>
              <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="ABC Electrical LLC" style={inp} />
            </div>
            <div>
              <label style={lbl}>Email Address *</label>
              <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="accounting@vendor.com" style={inp} />
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.62)', marginTop: 12, padding: '10px 14px', background: T.goldDim, border: `1px solid ${T.borderGold}`, borderRadius: 10 }}>
            The vendor will receive an email with a secure link to submit their W-9 form.
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button
              onClick={sendNewRequest}
              disabled={sending || !formValid}
              className="pmBtn"
              style={{ ...goldButtonStyle, opacity: (sending || !formValid) ? 0.5 : 1, cursor: (sending || !formValid) ? 'not-allowed' : 'pointer' }}
            >
              <PaperPlaneTilt size={15} weight="fill" /> {sending ? 'Sending...' : 'Send Request'}
            </button>
            <button onClick={() => setShowForm(false)} className="pmBtn" style={ghostButtonStyle}>Cancel</button>
          </div>
        </SectionCard>
      )}

      {/* Table */}
      <SectionCard title="W-9 Status" icon={<FileText size={17} weight="duotone" color={GOLD} />} flush>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.62)' }}>Loading...</div>
        ) : subs.length === 0 ? (
          <PremiumEmpty
            icon={<FileText size={30} weight="duotone" color={GOLD} />}
            title="No subcontractors found"
            description="Send a W-9 request to get started."
            action={
              <button onClick={() => setShowForm(true)} className="pmBtn" style={goldButtonStyle}>
                <Plus size={15} weight="bold" /> Send First W-9 Request
              </button>
            }
          />
        ) : (
          <div style={{ padding: '4px 8px 8px' }}>
            <Table
              headers={['Sub Name', 'Email', 'W9 Status', 'Requested Date', 'Received Date', 'Actions']}
              rows={subs.map(s => [
                <span key="n" style={{ fontWeight: 600 }}>{s.name}</span>,
                <span key="e" style={{ color: T.muted }}>{s.email}</span>,
                <Badge key="st" label={STATUS_LABEL[s.w9_status] || s.w9_status} color={STATUS_BADGE[s.w9_status] || 'muted'} />,
                <span key="rd" style={{ color: T.muted }}>{s.requested_date || '---'}</span>,
                <span key="rv" style={{ color: s.received_date ? T.green : T.muted }}>{s.received_date || '---'}</span>,
                <div key="act">
                  {(s.w9_status === 'not_requested' || s.w9_status === 'pending') && (
                    <button
                      onClick={() => requestW9(s.id, s.name, s.email)}
                      disabled={requestingId === s.id}
                      className="pmBtn"
                      style={{ ...rowActionStyle, opacity: requestingId === s.id ? 0.5 : 1, cursor: requestingId === s.id ? 'not-allowed' : 'pointer' }}
                    >
                      {requestingId === s.id ? 'Sending...' : s.w9_status === 'pending' ? 'Resend' : 'Request W-9'}
                    </button>
                  )}
                  {(s.w9_status === 'received' || s.w9_status === 'submitted') && (
                    <span style={{ fontSize: 12, color: T.green, fontWeight: 600 }}>Submitted</span>
                  )}
                </div>,
              ])}
            />
          </div>
        )}
      </SectionCard>
    </PremiumSurface>
  );
}
