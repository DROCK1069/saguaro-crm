'use client';
/**
 * Invoicing Page — Fully wired to /api/invoices/list and /api/invoices/create.
 * Uses DataTable with sorting, filtering, pagination.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useProjectContext } from '@/lib/hooks/useProjectContext';
import SaguaroDatePicker from '@/components/SaguaroDatePicker';
import { humanError } from '@/lib/errors';
import { useRouter } from 'next/navigation';
import { createColumnHelper } from '@tanstack/react-table';
import { Plus, CurrencyDollar, PaperPlaneTilt, Eye, Trash, Warning } from '@phosphor-icons/react';
import DataTable from '../../../components/DataTable';
import { colors, font, radius } from '../../../lib/design-tokens';
import { PremiumSurface, ModuleHero, SectionCard, StatStrip, FlowSteps, InsightRow, AutoChip, goldButtonStyle, ghostButtonStyle } from '@/components/ui/premium';

interface Invoice {
  id: string;
  project_id: string;
  vendor_name: string;
  invoice_number: string | null;
  vendor_email: string | null;
  description: string | null;
  category: string | null;
  cost_code: string | null;
  amount: number | null;
  tax: number | null;
  total: number | null;
  due_date: string | null;
  status: string | null;
  notes: string | null;
  created_at: string;
}

interface Project { id: string; name: string; }

const columnHelper = createColumnHelper<Invoice>();

const STATUS_COLORS: Record<string, string> = {
  draft: colors.textDim,
  pending: colors.orange,
  sent: colors.blue,
  paid: colors.green,
  overdue: colors.red,
};

export default function InvoicingPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  // Create form state — matches API schema
  const [form, setForm] = useState({
    project_id: '',
    vendor_name: '',
    invoice_number: '',
    vendor_email: '',
    description: '',
    category: '',
    cost_code: '',
    amount: '',
    tax: '',
    due_date: '',
    status: 'draft',
    notes: '',
  });
  const [creating, setCreating] = useState(false);

  // Project intelligence — once a project is picked, the form walks in knowing it.
  const { ctx } = useProjectContext(form.project_id || null);
  const [auto, setAuto] = useState<{ num?: boolean; due?: boolean }>({});
  useEffect(() => {
    if (!form.project_id) setAuto({});
  }, [form.project_id]);
  useEffect(() => {
    if (!ctx) return;
    const n = Number(ctx.defaults?.nextInvoiceNumber) || 1;
    const due = new Date(Date.now() + 30 * 86400000);
    const dueIso = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
    setForm(f => {
      const seedNum = !f.invoice_number;
      const seedDue = !f.due_date;
      setAuto(a => ({ num: a.num || seedNum, due: a.due || seedDue }));
      return {
        ...f,
        invoice_number: f.invoice_number || `INV-${String(n).padStart(3, '0')}`,
        due_date: f.due_date || dueIso,
      };
    });
  }, [ctx]);

  const money = ctx?.money;
  const cOriginal = Number(money?.originalContract) || 0;
  const cCoTotal = Number(money?.approvedCoTotal) || 0;
  const cRevised = Number(money?.revisedContract) || (cOriginal + cCoTotal);
  const cBilled = Number(money?.billedToDate) || 0;
  const cPaid = Number(money?.paidToDate) || 0;
  const ctxVendors = (ctx?.vendors || []) as string[];
  const ctxCodes = (ctx?.costCodes || []) as { division: string; costCode: string; description: string }[];
  const fmtUsd = (n: number) => '$' + ((Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }));
  const liveTotal = (parseFloat(form.amount) || 0) + (parseFloat(form.tax) || 0);

  const pageBilled = invoices.reduce((s, i) => s + (Number(i.total ?? i.amount) || 0), 0);
  const pagePaid = invoices.filter(i => (i.status || '').toLowerCase() === 'paid').reduce((s, i) => s + (Number(i.total ?? i.amount) || 0), 0);
  const pageOutstanding = invoices.filter(i => { const st = (i.status || '').toLowerCase(); return st !== 'paid' && st !== 'draft'; }).reduce((s, i) => s + (Number(i.total ?? i.amount) || 0), 0);
  const pageOverdue = invoices.filter(i => i.due_date && new Date(i.due_date) < new Date() && (i.status || '').toLowerCase() !== 'paid').length;
  const pageDrafts = invoices.filter(i => (i.status || 'draft').toLowerCase() === 'draft').length;

  const fetchInvoices = useCallback(async () => {
    try {
      const res = await fetch('/api/invoices/list');
      if (!res.ok) throw new Error('Failed to load invoices');
      const data = await res.json();
      setInvoices(Array.isArray(data) ? data : data.invoices ?? []);
    } catch (e: any) {
      console.error(e);
      setError(humanError(e, "Couldn't load invoices. Please try again."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
    fetch('/api/projects?limit=100&fields=id,name')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setProjects(Array.isArray(d) ? d : d.projects ?? []); })
      .catch(() => {});
  }, [fetchInvoices]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.project_id || !form.vendor_name) return;
    setCreating(true);
    try {
      const res = await fetch('/api/invoices/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: form.project_id,
          vendor_name: form.vendor_name,
          invoice_number: form.invoice_number || null,
          vendor_email: form.vendor_email || null,
          description: form.description || null,
          category: form.category || null,
          cost_code: form.cost_code || null,
          amount: form.amount ? parseFloat(form.amount) : null,
          tax: form.tax ? parseFloat(form.tax) : null,
          total: form.amount ? parseFloat(form.amount) + (form.tax ? parseFloat(form.tax) : 0) : null,
          due_date: form.due_date || null,
          status: form.status || null,
          notes: form.notes || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to create invoice');
      setShowCreate(false);
      setForm({ project_id: '', vendor_name: '', invoice_number: '', vendor_email: '', description: '', category: '', cost_code: '', amount: '', tax: '', due_date: '', status: 'draft', notes: '' });
      await fetchInvoices();
    } catch (e: any) {
      console.error(e);
      setError(humanError(e, "Couldn't create the invoice. Please try again."));
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this invoice?')) return;
    try {
      await fetch(`/api/invoices/${id}/delete`, { method: 'DELETE' });
      await fetchInvoices();
    } catch {}
  }

  async function handleSend(id: string) {
    try {
      await fetch(`/api/invoices/${id}/send`, { method: 'POST' });
      await fetchInvoices();
    } catch {}
  }

  const columns = useMemo(() => [
    columnHelper.accessor('invoice_number', {
      header: 'Invoice #',
      cell: (info) => <span style={{ fontWeight: font.weight.semibold }}>{info.getValue() || '—'}</span>,
    }),
    columnHelper.accessor('vendor_name', {
      header: 'Vendor',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('description', {
      header: 'Description',
      cell: (info) => <span style={{ color: colors.textMuted, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block' }}>{info.getValue() || '—'}</span>,
    }),
    columnHelper.accessor('amount', {
      header: 'Amount',
      cell: (info) => {
        const v = info.getValue();
        return v != null ? `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—';
      },
    }),
    columnHelper.accessor('total', {
      header: 'Total',
      cell: (info) => {
        const v = info.getValue();
        return v != null ? <span style={{ fontWeight: font.weight.bold, color: colors.gold }}>${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span> : '—';
      },
    }),
    columnHelper.accessor('due_date', {
      header: 'Due Date',
      cell: (info) => {
        const v = info.getValue();
        if (!v) return '—';
        const d = new Date(v);
        const overdue = d < new Date() && info.row.original.status !== 'paid';
        return <span style={{ color: overdue ? colors.red : colors.text }}>{d.toLocaleDateString()}</span>;
      },
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => {
        const s = info.getValue() ?? 'draft';
        return (
          <span style={{
            padding: '3px 10px', borderRadius: 999, fontSize: font.size.xs, fontWeight: font.weight.bold,
            textTransform: 'uppercase', letterSpacing: 0.5,
            background: `${STATUS_COLORS[s] ?? colors.textDim}20`,
            color: STATUS_COLORS[s] ?? colors.textDim,
          }}>
            {s}
          </span>
        );
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: (info) => (
        <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => handleSend(info.row.original.id)} title="Send" style={actionBtnStyle}><PaperPlaneTilt size={14} /></button>
          <button onClick={() => handleDelete(info.row.original.id)} title="Delete" style={{ ...actionBtnStyle, color: colors.red }}><Trash size={14} /></button>
        </div>
      ),
    }),
  ], []);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', background: colors.raised,
    border: `1px solid ${colors.border}`, borderRadius: radius.md,
    color: colors.text, fontSize: font.size.md, outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: colors.textMuted, marginBottom: 6, display: 'block',
  };

  const hintStyle: React.CSSProperties = {
    fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 5, lineHeight: 1.45,
  };

  return (
    <>
    <PremiumSurface maxWidth={1600}>
      {/* Header */}
      <ModuleHero
        eyebrow="Finance"
        eyebrowIcon={<CurrencyDollar size={13} weight="fill" color="#F59E0B" />}
        title="Invoicing"
        subtitle="Manage invoices, track payments, and send to vendors."
        actions={
          <button onClick={() => setShowCreate(true)} style={goldButtonStyle} className="pmBtn">
            <Plus size={15} weight="bold" /> New Invoice
          </button>
        }
      />

      {!loading && invoices.length > 0 && (
        <StatStrip items={[
          { label: 'Total Billed', value: fmtUsd(pageBilled), sub: `across ${invoices.length} invoice${invoices.length === 1 ? '' : 's'}` },
          { label: 'Collected', value: fmtUsd(pagePaid), accent: '#3dd68c', sub: 'marked paid' },
          { label: 'Outstanding', value: fmtUsd(pageOutstanding), accent: pageOutstanding > 0 ? '#F59E0B' : undefined, sub: 'sent, awaiting payment' },
          { label: 'Overdue', value: String(pageOverdue), accent: pageOverdue > 0 ? colors.red : undefined, sub: pageOverdue > 0 ? 'past due date' : 'nothing past due' },
          { label: 'Drafts', value: String(pageDrafts), sub: 'not yet sent' },
        ]} />
      )}

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,.1)', border: `1px solid rgba(239,68,68,.3)`, borderRadius: radius.md, color: colors.red, fontSize: font.size.md, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Warning size={16} /> {error}
        </div>
      )}

      <SectionCard title="All Invoices" icon={<CurrencyDollar size={17} weight="duotone" color="#F59E0B" />}>
        <DataTable
          data={invoices}
          columns={columns}
          loading={loading}
          searchPlaceholder="Search invoices..."
          emptyMessage="No invoices yet. Create your first invoice to get started."
          onRowClick={(row) => router.push(`/app/invoicing/${row.id}`)}
        />
      </SectionCard>
    </PremiumSurface>

      {/* ── Create Modal ─────────────────────────────────────────────── */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}>
          <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 960, maxHeight: '80vh', overflow: 'auto', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: colors.surface, zIndex: 1 }}>
              <h2 style={{ margin: 0, fontSize: font.size.xl, fontWeight: font.weight.black, color: colors.text }}>New Invoice</h2>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', fontSize: 22 }}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px' }}>
            <form onSubmit={handleCreate} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
              {ctx && (
                <StatStrip items={[
                  { label: 'Original Contract', value: fmtUsd(cOriginal) },
                  { label: 'Approved COs', value: (cCoTotal >= 0 ? '+' : '') + fmtUsd(cCoTotal), accent: cCoTotal > 0 ? '#3dd68c' : undefined },
                  { label: 'Revised', value: fmtUsd(cRevised) },
                  { label: 'Billed to Date', value: fmtUsd(cBilled) },
                  { label: 'Outstanding', value: fmtUsd(Math.max(0, cBilled - cPaid)), accent: '#F59E0B' },
                ]} />
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={labelStyle}>Project *</label>
                  <select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} required style={inputStyle}>
                    <option value="">Select project...</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <div style={hintStyle}>{ctx ? 'Snapshot loaded — fields below pre-fill from it.' : 'Pick one to pre-fill the rest.'}</div>
                </div>
                <div>
                  <label style={labelStyle}>Vendor Name *</label>
                  <input value={form.vendor_name} onChange={(e) => setForm({ ...form, vendor_name: e.target.value })} required style={inputStyle} placeholder="Vendor name" list="sagGlobalVendors" />
                  <datalist id="sagGlobalVendors">
                    {ctxVendors.map(v => <option key={v} value={v} />)}
                  </datalist>
                  <div style={hintStyle}>{ctxVendors.length > 0 ? `${ctxVendors.length} known vendor${ctxVendors.length === 1 ? '' : 's'} on this project — start typing.` : 'Vendors suggest once a project is picked.'}</div>
                </div>
                <div>
                  <label style={labelStyle}>Invoice #{auto.num && <AutoChip />}</label>
                  <input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} style={inputStyle} placeholder="INV-001" />
                  <div style={hintStyle}>{auto.num ? 'Next in sequence on this project.' : 'Auto-suggested when you pick a project.'}</div>
                </div>
                <div>
                  <label style={labelStyle}>Vendor Email</label>
                  <input type="email" value={form.vendor_email} onChange={(e) => setForm({ ...form, vendor_email: e.target.value })} style={inputStyle} placeholder="vendor@email.com" />
                  <div style={hintStyle}>Needed to send the invoice by email.</div>
                </div>
                <div>
                  <label style={labelStyle}>Amount</label>
                  <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} style={inputStyle} placeholder="0.00" />
                </div>
                <div>
                  <label style={labelStyle}>Tax</label>
                  <input type="number" step="0.01" value={form.tax} onChange={(e) => setForm({ ...form, tax: e.target.value })} style={inputStyle} placeholder="0.00" />
                </div>
                <div>
                  <label style={labelStyle}>Invoice Total</label>
                  <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', fontWeight: 800, color: colors.gold, background: 'rgba(245,158,11,0.07)', borderColor: 'rgba(245,158,11,0.35)' }}>
                    {'$' + liveTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={hintStyle}>Amount + tax — computed live.</div>
                </div>
                <div>
                  <label style={labelStyle}>Issue Date<AutoChip /></label>
                  <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', color: colors.textMuted }}>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                  <div style={hintStyle}>Recorded automatically when the invoice is created.</div>
                </div>
                <div>
                  <label style={labelStyle}>Due Date{auto.due && <AutoChip />}</label>
                  <SaguaroDatePicker value={form.due_date} onChange={(v) => setForm({ ...form, due_date: v })} style={inputStyle} />
                  <div style={hintStyle}>{auto.due ? 'Net 30 from today — adjust freely.' : 'Overdue flags itself from this date.'}</div>
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={inputStyle}>
                    <option value="draft">Draft</option>
                    <option value="pending">Pending</option>
                    <option value="sent">Sent</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Category</label>
                  <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={inputStyle} placeholder="Materials, Labor, etc." />
                </div>
                <div>
                  <label style={labelStyle}>Cost Code</label>
                  {ctxCodes.length > 0 ? (
                    <select value={form.cost_code} onChange={(e) => setForm({ ...form, cost_code: e.target.value })} style={inputStyle}>
                      <option value="">No cost code</option>
                      {ctxCodes.map(c => <option key={c.costCode} value={c.costCode}>{c.costCode} — {c.description}</option>)}
                    </select>
                  ) : (
                    <input value={form.cost_code} onChange={(e) => setForm({ ...form, cost_code: e.target.value })} style={inputStyle} placeholder="03-100" />
                  )}
                  <div style={hintStyle}>{ctxCodes.length > 0 ? `${ctxCodes.length} codes from the project budget.` : 'Budget codes load from the project.'}</div>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Invoice description..." />
              </div>
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Internal notes..." />
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowCreate(false)} style={ghostButtonStyle}>Cancel</button>
                <button type="submit" disabled={creating} className="pmBtn" style={{ ...goldButtonStyle, cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.6 : 1 }}>
                  {creating ? 'Creating...' : 'Create Invoice'}
                </button>
              </div>
            </form>
            <div style={{ borderLeft: `1px solid ${colors.border}`, padding: 20, display: 'flex', flexDirection: 'column', gap: 22 }}>
              {ctx ? (
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 900, color: colors.textDim, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 10 }}>{ctx.project?.name || 'Project'}</div>
                  <InsightRow label="Owner" value={ctx.defaults?.ownerName || '—'} />
                  <InsightRow label="Invoices on project" value={String(Number(ctx.counts?.invoices) || 0)} />
                  <InsightRow label="Pay applications" value={String(Number(money?.payAppCount) || 0)} />
                  <InsightRow label="Known vendors" value={String(ctxVendors.length)} />
                  <InsightRow label="Budget cost codes" value={String(ctxCodes.length)} />
                </div>
              ) : (
                <div style={{ fontSize: 12, color: colors.textMuted, lineHeight: 1.55 }}>
                  Pick a project and Saguaro pre-fills the invoice number, known vendors, and budget cost codes from what it already tracks.
                </div>
              )}
              <FlowSteps title="After you create" steps={[
                { title: 'Draft is saved', desc: 'Review and edit anything before it goes out.' },
                { title: 'Send to owner', desc: 'One click emails it straight from the table.' },
                { title: 'Payment is tracked', desc: 'Overdue flags itself from the due date.' },
                { title: 'Ledger updates', desc: 'Billed and paid totals roll into the project money snapshot.' },
              ]} />
            </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const actionBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, background: 'none', border: 'none',
  color: colors.textMuted, cursor: 'pointer', borderRadius: 4,
};
