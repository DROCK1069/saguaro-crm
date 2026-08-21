'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import SaguaroDatePicker from '../../../../../components/SaguaroDatePicker';
import { toCents, toDollars, sumCents, scaleCents } from '@/lib/calc';
import { PremiumSurface, ModuleHero, SectionCard, StatCard, PremiumEmpty, goldButtonStyle, ghostButtonStyle } from '@/components/ui/premium';
import { Receipt, CurrencyDollar, CheckCircle, WarningCircle, PencilSimple, Percent, Copy, Trash, Plus, CaretDown } from '@phosphor-icons/react';

const GOLD='#F59E0B', DARK='#0a0a0a', RAISED='#141416', BORDER='rgba(255,255,255,0.12)', DIM='#CBD5E1', TEXT='#FFFFFF', GREEN='#3dd68c', RED='#ef4444';

interface Invoice {
  id: string;
  invoice_number: string;
  vendor_name: string;
  vendor_email?: string;
  description: string;
  amount: number;
  due_date: string;
  status: string;
  notes: string;
  project_id: string;
  created_at?: string;
}

const STATUS_MAP: Record<string, { bg: string; color: string }> = {
  Draft: { bg: 'rgba(143,163,192,.2)', color: DIM },
  Sent: { bg: 'rgba(245,158,11,.2)', color: '#FBBF24' },
  Pending: { bg: 'rgba(245,158,11,.2)', color: '#f59e0b' },
  Paid: { bg: 'rgba(61,214,140,.2)', color: GREEN },
  Overdue: { bg: 'rgba(239,68,68,.2)', color: RED },
};

const EMPTY_FORM = { invoice_number: '', vendor_name: '', vendor_email: '', description: '', amount: 0, due_date: '', notes: '' };

export default function InvoicesPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const [adjustId, setAdjustId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/invoices`);
      const json = await res.json();
      setInvoices(json.invoices ?? []);
    } catch {
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const today = new Date().toISOString().split('T')[0];
  const totalBilled = toDollars(sumCents(invoices.map(i => toCents(i.amount || 0))));
  const totalPaid = toDollars(sumCents(invoices.filter(i => i.status === 'Paid').map(i => toCents(i.amount || 0))));
  const totalOutstanding = toDollars(sumCents(invoices.filter(i => i.status !== 'Paid' && i.status !== 'Draft').map(i => toCents(i.amount || 0))));

  async function handleSave() {
    if (!form.invoice_number || !form.vendor_name || !form.amount) { setErrorMsg('Invoice number, bill-to, and amount are required.'); return; }
    setSaving(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/invoices/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        project_id: projectId,
        invoice_number: form.invoice_number,
        vendor_name: form.vendor_name,
        vendor_email: form.vendor_email || null,
        description: form.description,
        amount: form.amount,
        total: form.amount,
        due_date: form.due_date || null,
        notes: form.notes,
        status: 'Draft',
      }) });
      if (!res.ok) throw new Error('save failed');
      const json = await res.json();
      if (!json.invoice) throw new Error('save failed');
      setInvoices(prev => [...prev, json.invoice as Invoice]);
      setShowForm(false);
      setForm(EMPTY_FORM);
      setSuccessMsg('Invoice created.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch {
      setErrorMsg('Could not create the invoice. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSend(id: string) {
    try {
      const res = await fetch(`/api/invoices/${id}/send`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setErrorMsg(json.error || 'Could not send the invoice.'); setTimeout(() => setErrorMsg(''), 5000); return; }
      setInvoices(prev => prev.map(i => i.id === id ? { ...i, status: 'Sent' } : i));
      setSuccessMsg('Invoice emailed to the client.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch {
      setErrorMsg('Could not send the invoice. Please try again.');
      setTimeout(() => setErrorMsg(''), 5000);
    }
  }

  const fmt = (n: number) => '$' + ((n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }));

  function openInvMenu(id: string) { setMenuId(id); setEditId(null); setAdjustId(null); setDeleteId(null); }

  async function handleEditInv(id: string) {
    const amount = parseFloat(editVal);
    if (isNaN(amount) || amount < 0) return;
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, amount } : i));
    setEditId(null);
    try {
      const res = await fetch(`/api/invoices/${id}/update`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount }) });
      if (!res.ok) throw new Error('update failed');
      setSuccessMsg('Amount updated.'); setTimeout(() => setSuccessMsg(''), 3000);
    } catch {
      setErrorMsg('Could not update the amount. Please try again.'); setTimeout(() => setErrorMsg(''), 4000);
      fetchInvoices();
    }
  }

  async function handleAdjustInv(id: string, pct: number) {
    const inv = invoices.find(i => i.id === id);
    if (!inv) return;
    const newAmt = toDollars(scaleCents(toCents(inv.amount), 1 + pct / 100));
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, amount: newAmt } : i));
    setAdjustId(null);
    try {
      const res = await fetch(`/api/invoices/${id}/update`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: newAmt }) });
      if (!res.ok) throw new Error('update failed');
      setSuccessMsg(`Adjusted ${pct > 0 ? '+' : ''}${pct}%`); setTimeout(() => setSuccessMsg(''), 3000);
    } catch {
      setErrorMsg('Could not adjust the amount. Please try again.'); setTimeout(() => setErrorMsg(''), 4000);
      fetchInvoices();
    }
  }

  function handleCopyInv(id: string, amount: number) {
    navigator.clipboard.writeText(fmt(amount)).catch(() => {});
    setCopiedId(id); setTimeout(() => setCopiedId(null), 2000);
    setMenuId(null);
  }

  async function handleDeleteInv(id: string) {
    setInvoices(prev => prev.filter(i => i.id !== id));
    setDeleteId(null);
    try {
      const res = await fetch(`/api/invoices/${id}/delete`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
      setSuccessMsg('Invoice deleted.'); setTimeout(() => setSuccessMsg(''), 3000);
    } catch {
      setErrorMsg('Could not delete the invoice. Please try again.'); setTimeout(() => setErrorMsg(''), 4000);
      fetchInvoices();
    }
  }

  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', background: '#1c1c1e', border: '1px solid ' + BORDER, borderRadius: 6, color: TEXT, fontSize: 13 };
  const label: React.CSSProperties = { fontSize: 12, color: DIM, marginBottom: 4, display: 'block' };

  return (
    <PremiumSurface maxWidth={1600}>

      {/* Header */}
      <ModuleHero
        eyebrow="Project Billing"
        eyebrowIcon={<Receipt size={13} weight="fill" color={GOLD} />}
        title="Client"
        accent="Invoices"
        subtitle="Owner billing and payment tracking."
        actions={
          <button onClick={() => { setShowForm(p => !p); setErrorMsg(''); }} style={goldButtonStyle} className="pmBtn">
            <Plus size={15} weight="bold" /> New Invoice
          </button>
        }
      />

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard
          icon={<CurrencyDollar size={19} weight="duotone" color={GOLD} />}
          label="Total Billed" value={`$${totalBilled.toLocaleString()}`}
          sub="across all invoices" delay={0.02}
        />
        <StatCard
          icon={<CheckCircle size={19} weight="duotone" color={GREEN} />}
          label="Total Paid" value={`$${totalPaid.toLocaleString()}`} accent={GREEN}
          sub="collected" delay={0.06}
        />
        <StatCard
          icon={<WarningCircle size={19} weight="duotone" color={totalOutstanding > 0 ? GOLD : GREEN} />}
          label="Outstanding" value={`$${totalOutstanding.toLocaleString()}`} accent={totalOutstanding > 0 ? GOLD : GREEN}
          sub="awaiting payment" delay={0.10}
        />
      </div>

      {successMsg && <div style={{ margin: '0 0 16px', padding: '10px 14px', background: 'rgba(61,214,140,.15)', border: '1px solid rgba(61,214,140,.4)', borderRadius: 10, color: GREEN, fontSize: 13 }}>{successMsg}</div>}
      {errorMsg && <div style={{ margin: '0 0 16px', padding: '10px 14px', background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.4)', borderRadius: 10, color: RED, fontSize: 13 }}>{errorMsg}</div>}

      {showForm && (
        <div style={{ marginBottom: 24 }}>
          <SectionCard title="New Invoice" icon={<Plus size={17} weight="bold" color={GOLD} />}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              <div><label style={label}>Invoice # *</label><input type="text" value={form.invoice_number} onChange={e => setForm(p => ({ ...p, invoice_number: e.target.value }))} style={inp} /></div>
              <div><label style={label}>Bill To *</label><input type="text" value={form.vendor_name} onChange={e => setForm(p => ({ ...p, vendor_name: e.target.value }))} placeholder="Client / owner name" style={inp} /></div>
              <div><label style={label}>Bill To Email</label><input type="email" value={form.vendor_email} onChange={e => setForm(p => ({ ...p, vendor_email: e.target.value }))} placeholder="Required to email/send" style={inp} /></div>
              <div><label style={label}>Amount ($) *</label><input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: Number(e.target.value) }))} style={inp} /></div>
              <div><label style={label}>Due Date</label><SaguaroDatePicker value={form.due_date} onChange={v => setForm(p => ({ ...p, due_date: v }))} style={inp} /></div>
              <div><label style={label}>Description</label><input type="text" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Mar 2026 progress" style={inp} /></div>
              <div style={{ gridColumn: 'span 3' }}><label style={label}>Notes</label><input type="text" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={inp} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={handleSave} disabled={saving} style={{ ...goldButtonStyle, opacity: saving ? 0.7 : 1 }} className="pmBtn">
                {saving ? 'Saving...' : 'Create Invoice'}
              </button>
              <button onClick={() => { setShowForm(false); setErrorMsg(''); }} style={ghostButtonStyle} className="pmBtn">Cancel</button>
            </div>
          </SectionCard>
        </div>
      )}

      <SectionCard title="All Invoices" icon={<Receipt size={17} weight="duotone" color={GOLD} />} flush>
        {loading ? <div style={{ textAlign: 'center', padding: 40, color: DIM }}>Loading...</div> : invoices.length === 0 ? (
          <PremiumEmpty
            icon={<Receipt size={30} weight="duotone" color={GOLD} />}
            title="No invoices yet"
            description="Create your first invoice to start billing owners and tracking payments."
            action={<button onClick={() => { setShowForm(true); setErrorMsg(''); }} style={goldButtonStyle} className="pmBtn"><Plus size={15} weight="bold" /> New Invoice</button>}
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Invoice #','Bill To','Amount','Issued','Due','Status','Notes','Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: DIM, borderBottom: '1px solid ' + BORDER, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => {
                const overdue = inv.due_date < today && inv.status !== 'Paid';
                const effectiveStatus = overdue ? 'Overdue' : inv.status;
                const sc = STATUS_MAP[effectiveStatus] || { bg: 'rgba(143,163,192,.2)', color: DIM };
                return (
                  <tr key={inv.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: overdue ? 'rgba(239,68,68,.05)' : 'transparent' }}>
                    <td style={{ padding: '10px 14px', color: GOLD, fontWeight: 700 }}>{inv.invoice_number}</td>
                    <td style={{ padding: '10px 14px', color: DIM }}>{inv.vendor_name}</td>
                    <td style={{ padding: '10px 14px', position: 'relative' as const }}>
                      {deleteId === inv.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 11, color: RED, fontWeight: 600 }}>Delete?</span>
                          <button onClick={() => handleDeleteInv(inv.id)} style={{ padding: '3px 8px', background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 5, color: RED, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Yes</button>
                          <button onClick={() => setDeleteId(null)} style={{ padding: '3px 8px', background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 5, color: DIM, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                        </div>
                      ) : editId === inv.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input value={editVal} onChange={e => setEditVal(e.target.value)} type="number" autoFocus onKeyDown={e => { if (e.key === 'Enter') handleEditInv(inv.id); if (e.key === 'Escape') setEditId(null); }} style={{ width: 100, padding: '4px 8px', background: DARK, border: `1px solid ${GOLD}`, borderRadius: 5, color: TEXT, fontSize: 12, outline: 'none', textAlign: 'right' }} />
                          <button onClick={() => handleEditInv(inv.id)} style={{ padding: '3px 8px', background: `linear-gradient(135deg,${GOLD},#FBBF24)`, border: 'none', borderRadius: 5, color: '#1C1C1E', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Save</button>
                          <button onClick={() => setEditId(null)} style={{ padding: '3px 8px', background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 5, color: DIM, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                        </div>
                      ) : adjustId === inv.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          {[-10, -5, 5, 10].map(p => (
                            <button key={p} onClick={() => handleAdjustInv(inv.id, p)} style={{ padding: '3px 7px', background: p > 0 ? 'rgba(61,214,140,.1)' : 'rgba(239,68,68,.1)', border: `1px solid ${p > 0 ? 'rgba(61,214,140,.25)' : 'rgba(239,68,68,.25)'}`, borderRadius: 5, color: p > 0 ? GREEN : RED, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{p > 0 ? '+' : ''}{p}%</button>
                          ))}
                          <button onClick={() => setAdjustId(null)} style={{ padding: '3px 6px', background: 'none', border: 'none', color: DIM, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ color: TEXT, fontWeight: 700 }}>{fmt(inv.amount)}</span>
                          {copiedId === inv.id && <span style={{ fontSize: 10, color: GREEN, fontWeight: 600 }}>Copied!</span>}
                          <button onClick={() => openInvMenu(inv.id)} style={{ background: 'none', border: 'none', color: DIM, cursor: 'pointer', padding: '2px 4px', lineHeight: 1, opacity: 0.6, display: 'inline-flex', alignItems: 'center' }} onMouseEnter={e => (e.currentTarget.style.opacity = '1')} onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}><CaretDown size={11} weight="bold" /></button>
                          {menuId === inv.id && (
                            <div style={{ position: 'absolute', top: 36, right: 14, background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 'var(--radius-md)', padding: 6, zIndex: 100, minWidth: 160, boxShadow: 'var(--shadow-lg)' }}>
                              {[
                                { label: 'Edit Amount', icon: <PencilSimple size={15} weight="bold" color={DIM} />, action: () => { setMenuId(null); setEditId(inv.id); setEditVal(String(inv.amount)); } },
                                { label: 'Adjust %', icon: <Percent size={15} weight="bold" color={DIM} />, action: () => { setMenuId(null); setAdjustId(inv.id); } },
                                { label: 'Copy Amount', icon: <Copy size={15} weight="bold" color={DIM} />, action: () => handleCopyInv(inv.id, inv.amount) },
                              ].map(item => (
                                <div key={item.label} onClick={item.action} style={{ padding: '7px 12px', fontSize: 12, color: TEXT, cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 9 }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                  {item.icon}{item.label}
                                </div>
                              ))}
                              <div style={{ height: 1, background: BORDER, margin: '4px 0' }} />
                              <div onClick={() => { setMenuId(null); setDeleteId(inv.id); }} style={{ padding: '7px 12px', fontSize: 12, color: RED, cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 9 }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,.08)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                <Trash size={15} weight="bold" color={RED} />Delete Invoice
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', color: DIM, whiteSpace: 'nowrap' }}>{inv.created_at ? new Date(inv.created_at).toLocaleDateString() : '—'}</td>
                    <td style={{ padding: '10px 14px', color: overdue ? RED : DIM, whiteSpace: 'nowrap' }}>{inv.due_date || '—'}</td>
                    <td style={{ padding: '10px 14px' }}><span style={{ padding: '3px 10px', borderRadius: 20, background: sc.bg, color: sc.color, fontSize: 11, fontWeight: 700 }}>{effectiveStatus}</span></td>
                    <td style={{ padding: '10px 14px', color: DIM, fontSize: 12 }}>{inv.notes}</td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                      {inv.status === 'Draft' && (
                        <button onClick={() => handleSend(inv.id)} style={{ padding: '4px 12px', background: 'rgba(245,158,11,.2)', border: '1px solid rgba(245,158,11,.4)', borderRadius: 5, color: '#FBBF24', fontSize: 12, cursor: 'pointer' }}>Send to Owner</button>
                      )}
                      {inv.status === 'Paid' && <span style={{ color: GREEN, fontSize: 12 }}>Paid</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {menuId && <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={() => setMenuId(null)} />}
          </div>
        )}
      </SectionCard>
    </PremiumSurface>
  );
}
