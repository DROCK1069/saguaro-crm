'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import SaguaroDatePicker from '../../../../../components/SaguaroDatePicker';
import { toCents, toDollars, sumCents, scaleCents } from '@/lib/calc';
import { PremiumSurface, ModuleHero, SectionCard, StatCard, PremiumEmpty, goldButtonStyle, ghostButtonStyle } from '@/components/ui/premium';
import { Receipt, Plus, FilePlus, CurrencyDollar } from '@phosphor-icons/react';

const GOLD='#F59E0B', DARK='#0a0a0a', RAISED='#141416', BORDER='rgba(255,255,255,0.12)', DIM='#CBD5E1', TEXT='#FFFFFF', GREEN='#3dd68c', RED='#ef4444';

interface Bill {
  id: string;
  bill_number: string;
  vendor_name: string;
  description: string;
  amount: number;
  total?: number;
  due_date: string;
  status: string;
  category: string;
  project_id: string;
}

const EMPTY_FORM = { invoice_num: '', vendor: '', description: '', amount: 0, due_date: '', category: '03 - Concrete' };
const CATEGORIES = ['03 - Concrete','04 - Masonry','05 - Metals','06 - Wood & Plastics','07 - Thermal & Moisture','08 - Openings','09 - Finishes','21 - Fire Suppression','22 - Plumbing','23 - HVAC','26 - Electrical','31 - Earthwork','32 - Exterior Improvements'];

function statusBadge(status: string) {
  const map: Record<string, { bg: string; color: string }> = {
    Pending: { bg: 'rgba(245,158,11,.2)', color: '#f59e0b' },
    Approved: { bg: 'rgba(245,158,11,.2)', color: '#FBBF24' },
    Paid: { bg: 'rgba(61,214,140,.2)', color: GREEN },
    Overdue: { bg: 'rgba(239,68,68,.2)', color: RED },
  };
  const s = map[status] || { bg: 'rgba(143,163,192,.2)', color: DIM };
  return <span style={{ padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color, fontSize: 11, fontWeight: 700 }}>{status}</span>;
}

function isOverdue(dueDate: string, status: string): boolean {
  if (status === 'Paid') return false;
  return new Date(dueDate) < new Date();
}

export default function BillsPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const [adjustId, setAdjustId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchBills = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/bills`);
      const json = await res.json();
      setBills(json.bills || []);
    } catch {
      setBills([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchBills(); }, [fetchBills]);

  async function handleSave() {
    if (!form.vendor || !form.invoice_num || !form.amount) {
      setErrorMsg('Vendor, invoice number, and amount are required.');
      return;
    }
    setSaving(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/bills/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          vendor_name: form.vendor,
          bill_number: form.invoice_num,
          description: form.description,
          category: form.category,
          amount: form.amount,
          total: form.amount,
          due_date: form.due_date || null,
          status: 'Pending',
        }),
      });
      if (!res.ok) throw new Error('save failed');
      const json = await res.json();
      if (!json.bill) throw new Error('save failed');
      setBills(prev => [json.bill as Bill, ...prev]);
      setShowForm(false);
      setForm(EMPTY_FORM);
      setSuccessMsg('Bill added successfully.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch {
      setErrorMsg('Could not save the bill. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove(id: string) {
    setActionLoading(id + '-approve');
    try {
      const res = await fetch(`/api/bills/${id}/approve`, { method: 'PATCH' });
      if (!res.ok) throw new Error('approve failed');
      setBills(prev => prev.map(b => b.id === id ? { ...b, status: 'Approved' } : b));
      setSuccessMsg('Bill approved.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch {
      setErrorMsg('Could not approve the bill. Please try again.');
      setTimeout(() => setErrorMsg(''), 4000);
    } finally {
      setActionLoading(null);
    }
  }

  async function handlePay(id: string) {
    setActionLoading(id + '-pay');
    try {
      const res = await fetch(`/api/bills/${id}/pay`, { method: 'PATCH' });
      if (!res.ok) throw new Error('pay failed');
      setBills(prev => prev.map(b => b.id === id ? { ...b, status: 'Paid' } : b));
      setSuccessMsg('Bill marked as paid.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch {
      setErrorMsg('Could not mark the bill as paid. Please try again.');
      setTimeout(() => setErrorMsg(''), 4000);
    } finally {
      setActionLoading(null);
    }
  }

  const fmt = (n: number) => '$' + ((n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }));

  function openBillMenu(id: string) { setMenuId(id); setEditId(null); setAdjustId(null); setDeleteId(null); }

  async function handleEditBill(id: string) {
    const amount = parseFloat(editVal);
    if (isNaN(amount) || amount < 0) return;
    setBills(prev => prev.map(b => b.id === id ? { ...b, amount } : b));
    setEditId(null);
    try {
      const res = await fetch(`/api/bills/${id}/update`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount }) });
      if (!res.ok) throw new Error('update failed');
      setSuccessMsg('Amount updated.'); setTimeout(() => setSuccessMsg(''), 3000);
    } catch {
      setErrorMsg('Could not update the amount. Please try again.'); setTimeout(() => setErrorMsg(''), 4000);
      fetchBills();
    }
  }

  async function handleAdjustBill(id: string, pct: number) {
    const bill = bills.find(b => b.id === id);
    if (!bill) return;
    const newAmt = toDollars(scaleCents(toCents(bill.amount), 1 + pct / 100));
    setBills(prev => prev.map(b => b.id === id ? { ...b, amount: newAmt } : b));
    setAdjustId(null);
    try {
      const res = await fetch(`/api/bills/${id}/update`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: newAmt }) });
      if (!res.ok) throw new Error('update failed');
      setSuccessMsg(`Adjusted ${pct > 0 ? '+' : ''}${pct}%`); setTimeout(() => setSuccessMsg(''), 3000);
    } catch {
      setErrorMsg('Could not adjust the amount. Please try again.'); setTimeout(() => setErrorMsg(''), 4000);
      fetchBills();
    }
  }

  function handleCopyBill(id: string, amount: number) {
    navigator.clipboard.writeText(fmt(amount)).catch(() => {});
    setCopiedId(id); setTimeout(() => setCopiedId(null), 2000);
    setMenuId(null);
  }

  async function handleDeleteBill(id: string) {
    setBills(prev => prev.filter(b => b.id !== id));
    setDeleteId(null);
    try {
      const res = await fetch(`/api/bills/${id}/delete`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
      setSuccessMsg('Bill deleted.'); setTimeout(() => setSuccessMsg(''), 3000);
    } catch {
      setErrorMsg('Could not delete the bill. Please try again.'); setTimeout(() => setErrorMsg(''), 4000);
      fetchBills();
    }
  }

  const pendingTotal = toDollars(sumCents(bills.filter(b => b.status === 'Pending' || b.status === 'Approved').map(b => toCents(b.amount || 0))));
  const paidCount = bills.filter(b => b.status === 'Paid').length;
  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', background: '#1c1c1e', border: '1px solid ' + BORDER, borderRadius: 6, color: TEXT, fontSize: 13 };
  const label: React.CSSProperties = { fontSize: 12, color: DIM, marginBottom: 4, display: 'block' };

  return (
    <PremiumSurface maxWidth={1600}>
      {/* Header */}
      <ModuleHero
        eyebrow="Financials"
        eyebrowIcon={<Receipt size={13} weight="fill" color={GOLD} />}
        title="Bills"
        subtitle="Vendor bills and supplier invoices"
        actions={
          <button onClick={() => { setShowForm(p => !p); setErrorMsg(''); }} style={goldButtonStyle} className="pmBtn">
            <Plus size={15} weight="bold" /> New Bill
          </button>
        }
      />

      {successMsg && <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(61,214,140,.15)', border: '1px solid rgba(61,214,140,.4)', borderRadius: 7, color: GREEN, fontSize: 13 }}>{successMsg}</div>}
      {errorMsg && <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.4)', borderRadius: 7, color: RED, fontSize: 13 }}>{errorMsg}</div>}

      {showForm && (
        <div style={{ marginBottom: 24 }}>
          <SectionCard title="New Bill" icon={<FilePlus size={17} weight="duotone" color={GOLD} />}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              <div><label style={label}>Invoice # *</label><input type="text" value={form.invoice_num} onChange={e => setForm(p => ({ ...p, invoice_num: e.target.value }))} style={inp} /></div>
              <div><label style={label}>Vendor *</label><input type="text" value={form.vendor} onChange={e => setForm(p => ({ ...p, vendor: e.target.value }))} style={inp} /></div>
              <div><label style={label}>Amount ($) *</label><input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: Number(e.target.value) }))} style={inp} /></div>
              <div><label style={label}>Due Date</label><SaguaroDatePicker value={form.due_date} onChange={v => setForm(p => ({ ...p, due_date: v }))} style={inp} /></div>
              <div><label style={label}>CSI Category</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={inp}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: 'span 3' }}><label style={label}>Description</label><input type="text" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} style={inp} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={handleSave} disabled={saving} style={{ ...goldButtonStyle, opacity: saving ? 0.7 : 1 }} className="pmBtn">
                {saving ? 'Saving...' : 'Save Bill'}
              </button>
              <button onClick={() => { setShowForm(false); setErrorMsg(''); }} style={ghostButtonStyle} className="pmBtn">Cancel</button>
            </div>
          </SectionCard>
        </div>
      )}

      <SectionCard title="All Bills" icon={<Receipt size={17} weight="duotone" color={GOLD} />} flush>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: DIM }}>Loading...</div>
        ) : bills.length === 0 ? (
          <div style={{ padding: '6px 8px' }}>
            <PremiumEmpty
              icon={<Receipt size={30} weight="duotone" color={GOLD} />}
              title="No bills yet"
              description="Add your first vendor bill to start tracking supplier invoices for this project."
              action={<button onClick={() => { setShowForm(true); setErrorMsg(''); }} style={goldButtonStyle} className="pmBtn"><Plus size={15} weight="bold" /> New Bill</button>}
            />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.25)' }}>
                  {['Invoice #','Vendor','Description','Amount','Due Date','Status','Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: DIM, borderBottom: '1px solid ' + BORDER, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bills.map(b => {
                  const overdue = isOverdue(b.due_date, b.status);
                  return (
                    <tr key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,.06)', background: overdue ? 'rgba(239,68,68,.05)' : 'transparent' }}>
                      <td style={{ padding: '10px 14px', color: GOLD, fontWeight: 600 }}>{b.bill_number}</td>
                      <td style={{ padding: '10px 14px', color: TEXT }}>{b.vendor_name}</td>
                      <td style={{ padding: '10px 14px', color: DIM, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.description}</td>
                      <td style={{ padding: '10px 14px', position: 'relative' as const }}>
                        {deleteId === b.id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, color: RED, fontWeight: 600 }}>Delete bill?</span>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteBill(b.id); }} style={{ padding: '3px 8px', background: 'rgba(239,68,68,.15)', border: `1px solid rgba(239,68,68,.3)`, borderRadius: 5, color: RED, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Yes</button>
                            <button onClick={(e) => { e.stopPropagation(); setDeleteId(null); }} style={{ padding: '3px 8px', background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 5, color: DIM, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                          </div>
                        ) : editId === b.id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <input value={editVal} onChange={e => setEditVal(e.target.value)} type="number" autoFocus onKeyDown={e => { if (e.key === 'Enter') handleEditBill(b.id); if (e.key === 'Escape') setEditId(null); }} style={{ width: 100, padding: '4px 8px', background: DARK, border: `1px solid ${GOLD}`, borderRadius: 5, color: TEXT, fontSize: 12, outline: 'none', textAlign: 'right' }} />
                            <button onClick={() => handleEditBill(b.id)} style={{ padding: '3px 8px', background: `linear-gradient(135deg,${GOLD},#FBBF24)`, border: 'none', borderRadius: 5, color: '#1C1C1E', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Save</button>
                            <button onClick={() => setEditId(null)} style={{ padding: '3px 8px', background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 5, color: DIM, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                          </div>
                        ) : adjustId === b.id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            {[-10, -5, 5, 10].map(p => (
                              <button key={p} onClick={(e) => { e.stopPropagation(); handleAdjustBill(b.id, p); }} style={{ padding: '3px 7px', background: p > 0 ? 'rgba(61,214,140,.1)' : 'rgba(239,68,68,.1)', border: `1px solid ${p > 0 ? 'rgba(61,214,140,.25)' : 'rgba(239,68,68,.25)'}`, borderRadius: 5, color: p > 0 ? GREEN : RED, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{p > 0 ? '+' : ''}{p}%</button>
                            ))}
                            <button onClick={(e) => { e.stopPropagation(); setAdjustId(null); }} style={{ padding: '3px 6px', background: 'none', border: 'none', color: DIM, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ color: TEXT, fontWeight: 700 }}>{fmt(b.amount)}</span>
                            {copiedId === b.id && <span style={{ fontSize: 10, color: GREEN, fontWeight: 600 }}>Copied!</span>}
                            <button onClick={(e) => { e.stopPropagation(); openBillMenu(b.id); }} style={{ background: 'none', border: 'none', color: DIM, cursor: 'pointer', fontSize: 10, padding: '2px 4px', lineHeight: 1, opacity: 0.6 }} onMouseEnter={e => (e.currentTarget.style.opacity = '1')} onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}>&#9662;</button>
                            {menuId === b.id && (
                              <div style={{ position: 'absolute', top: 36, right: 14, background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 4, zIndex: 100, minWidth: 150, boxShadow: '0 8px 24px rgba(0,0,0,.4)' }}>
                                {[
                                  { label: 'Edit Amount', icon: '✏️', action: () => { setMenuId(null); setEditId(b.id); setEditVal(String(b.amount)); } },
                                  { label: 'Adjust %', icon: '📊', action: () => { setMenuId(null); setAdjustId(b.id); } },
                                  { label: 'Copy Amount', icon: '📋', action: () => handleCopyBill(b.id, b.amount) },
                                ].map(item => (
                                  <div key={item.label} onClick={(e) => { e.stopPropagation(); item.action(); }} style={{ padding: '7px 12px', fontSize: 12, color: TEXT, cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8 }} onMouseEnter={e => (e.currentTarget.style.background = DARK)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                    <span style={{ fontSize: 14 }}>{item.icon}</span>{item.label}
                                  </div>
                                ))}
                                <div style={{ height: 1, background: BORDER, margin: '4px 0' }} />
                                <div onClick={(e) => { e.stopPropagation(); setMenuId(null); setDeleteId(b.id); }} style={{ padding: '7px 12px', fontSize: 12, color: RED, cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8 }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,.08)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                  <span style={{ fontSize: 14 }}>{'🗑️'}</span>Delete Bill
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', color: overdue ? RED : DIM, whiteSpace: 'nowrap' }}>{b.due_date || '—'}</td>
                      <td style={{ padding: '10px 14px' }}>{statusBadge(overdue && b.status !== 'Paid' ? 'Overdue' : b.status)}</td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        {b.status === 'Pending' && (
                          <button onClick={() => handleApprove(b.id)} disabled={actionLoading === b.id + '-approve'} style={{ padding: '4px 10px', background: 'rgba(245,158,11,.2)', border: '1px solid rgba(245,158,11,.4)', borderRadius: 5, color: '#FBBF24', fontSize: 12, cursor: 'pointer', marginRight: 6 }}>
                            {actionLoading === b.id + '-approve' ? '...' : 'Approve'}
                          </button>
                        )}
                        {(b.status === 'Pending' || b.status === 'Approved') && (
                          <button onClick={() => handlePay(b.id)} disabled={actionLoading === b.id + '-pay'} style={{ padding: '4px 10px', background: 'rgba(61,214,140,.2)', border: '1px solid rgba(61,214,140,.4)', borderRadius: 5, color: GREEN, fontSize: 12, cursor: 'pointer' }}>
                            {actionLoading === b.id + '-pay' ? '...' : 'Mark Paid'}
                          </button>
                        )}
                        {b.status === 'Paid' && <span style={{ color: GREEN, fontSize: 12 }}>Paid</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {!loading && bills.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 20 }}>
          <StatCard
            icon={<Receipt size={19} weight="duotone" color={GOLD} />}
            label="Total Bills"
            value={String(bills.length)}
            sub={`${paidCount} paid`}
          />
          <StatCard
            icon={<CurrencyDollar size={19} weight="duotone" color={GOLD} />}
            label="Pending + Approved"
            value={'$' + pendingTotal.toLocaleString()}
            accent={GOLD}
            sub="awaiting payment"
          />
        </div>
      )}

      {menuId && <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={() => setMenuId(null)} />}
    </PremiumSurface>
  );
}
