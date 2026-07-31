'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Badge, Table, T } from '@/components/ui/shell';
import {
  PremiumSurface, ModuleHero, StatCard, SectionCard, PremiumEmpty,
  goldButtonStyle, ghostButtonStyle,
} from '@/components/ui/premium';
import SaguaroDatePicker from '../../../../../components/SaguaroDatePicker';
import { CurrencyDollar, PencilSimple, Export, Package, Plus, X } from '@phosphor-icons/react';

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
}

interface PurchaseOrder {
  id: string;
  po_num: string;
  vendor: string;
  description: string;
  amount: number;
  issued_date: string;
  delivery_date: string | null;
  status: string;
  line_items: LineItem[];
  project_id: string;
}

const STATUS_BADGE: Record<string, 'muted' | 'blue' | 'green' | 'amber' | 'red'> = {
  draft: 'muted',
  sent: 'blue',
  received: 'green',
  closed: 'muted',
};

const EMPTY_LINE: LineItem = { description: '', quantity: 1, unit_price: 0 };
const EMPTY_FORM = { vendor: '', description: '', delivery_date: '', line_items: [{ ...EMPTY_LINE }] };

// Map a DB purchase_orders row (vendor_name/po_number/total/created_at) onto the display shape.
function normalizePo(row: Record<string, unknown>): PurchaseOrder {
  const created = (row.created_at as string) || '';
  return {
    id: String(row.id ?? `po-${Date.now()}`),
    project_id: String(row.project_id ?? ''),
    po_num: (row.po_number as string) || '',
    vendor: (row.vendor_name as string) || '',
    description: (row.description as string) || '',
    amount: Number(row.total ?? row.subtotal ?? 0),
    issued_date: created ? created.split('T')[0] : (new Date().toISOString().split('T')[0]),
    delivery_date: (row.delivery_date as string) || null,
    status: (row.status as string) || 'draft',
    line_items: (row.line_items as LineItem[]) || [],
  };
}

export default function PurchaseOrdersPage() {
  const { projectId } = useParams() as { projectId: string };
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchPos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/purchase-orders`);
      const json = await res.json();
      setPos((json.purchase_orders || []).map(normalizePo));
    } catch {
      setPos([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchPos(); }, [fetchPos]);

  const totalValue = pos.reduce((s, p) => s + (p.amount || 0), 0);
  const draftCount = pos.filter(p => p.status === 'draft').length;
  const sentCount = pos.filter(p => p.status === 'sent').length;
  const receivedCount = pos.filter(p => p.status === 'received').length;

  function updateLineItem(index: number, field: keyof LineItem, value: string | number) {
    setForm(prev => {
      const items = [...prev.line_items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, line_items: items };
    });
  }

  function addLineItem() {
    setForm(prev => ({ ...prev, line_items: [...prev.line_items, { ...EMPTY_LINE }] }));
  }

  function removeLineItem(index: number) {
    setForm(prev => ({ ...prev, line_items: prev.line_items.filter((_, i) => i !== index) }));
  }

  const formTotal = form.line_items.reduce((s, li) => s + li.quantity * li.unit_price, 0);

  async function handleSave() {
    if (!form.vendor || !form.description) { setErrorMsg('Vendor and description are required.'); return; }
    setSaving(true);
    setErrorMsg('');
    const num = `PO-${String(pos.length + 1).padStart(3, '0')}`;
    const amount = formTotal;
    try {
      const res = await fetch('/api/purchase-orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          vendor_name: form.vendor,
          po_number: num,
          description: form.description,
          delivery_date: form.delivery_date || null,
          line_items: form.line_items,
          subtotal: amount,
          total: amount,
          status: 'draft',
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.purchaseOrder) throw new Error(json.error || 'Create failed');
      setPos(prev => [...prev, normalizePo(json.purchaseOrder)]);
      setShowForm(false);
      setForm(EMPTY_FORM);
      setSuccessMsg('Purchase order created.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch {
      setErrorMsg('Could not create the purchase order. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleGeneratePdf(po: PurchaseOrder) {
    try {
      const res = await fetch('/api/documents/purchase-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, poId: po.id }),
      });
      const json = await res.json().catch(() => ({}));
      const url = json.pdfUrl || json.url;
      if (!res.ok || !url) throw new Error(json.error || 'PDF generation failed');
      window.open(url, '_blank');
    } catch {
      setErrorMsg('Could not generate the PO PDF. Please try again.');
      setTimeout(() => setErrorMsg(''), 4000);
    }
  }

  async function handleStatusChange(id: string, status: string) {
    setPos(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    try {
      const res = await fetch(`/api/purchase-orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('status update failed');
      setSuccessMsg(`PO status updated to ${status}.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch {
      setErrorMsg('Could not update the PO status. Please try again.');
      setTimeout(() => setErrorMsg(''), 4000);
      fetchPos();
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '8px 12px', background: T.surface2,
    border: `1px solid ${T.border}`, borderRadius: 8, color: T.white, fontSize: 13, outline: 'none',
  };
  const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 };

  // Compact button presets derived from the cinematic kit for inline/table actions.
  const smallGold: React.CSSProperties = { ...goldButtonStyle, padding: '7px 14px', fontSize: 12.5, borderRadius: 9 };
  const smallGhost: React.CSSProperties = { ...ghostButtonStyle, padding: '7px 14px', fontSize: 12.5, borderRadius: 9 };
  const smallDanger: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: '7px 12px', borderRadius: 9, cursor: 'pointer',
    background: 'rgba(239,68,68,0.12)', color: '#F87171', border: '1px solid rgba(239,68,68,0.35)',
    fontWeight: 800, fontSize: 12.5,
  };

  return (
    <PremiumSurface maxWidth={1600}>

      {/* Header */}
      <ModuleHero
        eyebrow="Procurement"
        eyebrowIcon={<Package size={13} weight="fill" color="#F59E0B" />}
        title="Purchase"
        accent="Orders"
        subtitle="Vendor and supplier purchase orders"
        actions={
          <button
            className="pmBtn"
            onClick={() => { setShowForm(p => !p); setErrorMsg(''); }}
            style={showForm ? ghostButtonStyle : goldButtonStyle}
          >
            {showForm ? <><X size={15} weight="bold" /> Cancel</> : <><Plus size={15} weight="bold" /> New PO</>}
          </button>
        }
      />

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 28 }}>
        <StatCard
          icon={<CurrencyDollar size={19} weight="duotone" color="#F59E0B" />}
          label="Total PO Value" value={`$${totalValue.toLocaleString()}`} accent="#F59E0B" delay={0.02}
        />
        <StatCard
          icon={<PencilSimple size={19} weight="duotone" color="#F59E0B" />}
          label="Draft" value={String(draftCount)} delay={0.06}
        />
        <StatCard
          icon={<Export size={19} weight="duotone" color="#F0A63C" />}
          label="Sent" value={String(sentCount)} accent={sentCount > 0 ? '#F0A63C' : undefined} delay={0.10}
        />
        <StatCard
          icon={<Package size={19} weight="duotone" color="#45B37D" />}
          label="Received" value={String(receivedCount)} accent={receivedCount > 0 ? '#45B37D' : undefined} delay={0.14}
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
        <div style={{ marginBottom: 20 }}>
          <SectionCard title="New Purchase Order" icon={<Package size={17} weight="duotone" color="#F59E0B" />}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              <div>
                <label style={lbl}>Vendor *</label>
                <input value={form.vendor} onChange={e => setForm(p => ({ ...p, vendor: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>Description *</label>
                <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>Delivery Date</label>
                <SaguaroDatePicker value={form.delivery_date} onChange={v => setForm(p => ({ ...p, delivery_date: v }))} style={inp} />
              </div>
            </div>

            {/* Line Items */}
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.white }}>Line Items</span>
                <button className="pmBtn" onClick={addLineItem} style={smallGhost}><Plus size={13} weight="bold" /> Add Line</button>
              </div>
              {form.line_items.map((li, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 10, marginBottom: 8 }}>
                  <input placeholder="Description" value={li.description} onChange={e => updateLineItem(idx, 'description', e.target.value)} style={inp} />
                  <input type="number" placeholder="Qty" value={li.quantity} onChange={e => updateLineItem(idx, 'quantity', Number(e.target.value))} style={inp} />
                  <input type="number" placeholder="Unit Price" value={li.unit_price} onChange={e => updateLineItem(idx, 'unit_price', Number(e.target.value))} style={inp} />
                  <button
                    className="pmBtn"
                    onClick={() => removeLineItem(idx)}
                    disabled={form.line_items.length <= 1}
                    style={{ ...smallDanger, ...(form.line_items.length <= 1 ? { opacity: 0.45, cursor: 'not-allowed' } : {}) }}
                    aria-label="Remove line item"
                  >
                    <X size={13} weight="bold" />
                  </button>
                </div>
              ))}
              <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 700, color: T.gold, marginTop: 8 }}>
                Total: ${formTotal.toLocaleString()}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                className="pmBtn"
                onClick={handleSave}
                disabled={saving}
                style={{ ...goldButtonStyle, ...(saving ? { opacity: 0.55, cursor: 'not-allowed' } : {}) }}
              >
                {saving ? 'Saving...' : 'Create PO'}
              </button>
              <button className="pmBtn" onClick={() => { setShowForm(false); setErrorMsg(''); }} style={ghostButtonStyle}>Cancel</button>
            </div>
          </SectionCard>
        </div>
      )}

      {/* Table */}
      <SectionCard title="All Purchase Orders" icon={<Package size={17} weight="duotone" color="#F59E0B" />} flush>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'rgba(255,255,255,0.62)', fontSize: 13 }}>Loading purchase orders…</div>
        ) : pos.length === 0 ? (
          <PremiumEmpty
            icon={<Package size={30} weight="duotone" color="#F59E0B" />}
            title="No purchase orders yet"
            description="Create your first purchase order to track vendor and supplier commitments for this project."
            action={
              <button className="pmBtn" onClick={() => { setShowForm(true); setErrorMsg(''); }} style={goldButtonStyle}>
                <Plus size={15} weight="bold" /> New Purchase Order
              </button>
            }
          />
        ) : (
          <Table
            headers={['PO #', 'Vendor', 'Description', 'Amount', 'Status', 'Date', 'Actions']}
            rows={pos.map(p => [
              <span key="n" style={{ color: T.gold, fontWeight: 700 }}>{p.po_num}</span>,
              p.vendor,
              <span key="d" style={{ color: T.muted }}>{p.description}</span>,
              <span key="a" style={{ fontWeight: 700 }}>${(p.amount || 0).toLocaleString()}</span>,
              <Badge key="s" label={p.status} color={STATUS_BADGE[p.status] || 'muted'} />,
              <span key="dt" style={{ color: T.muted }}>{p.issued_date}</span>,
              <div key="act" style={{ display: 'flex', gap: 6 }}>
                <button className="pmBtn" onClick={() => handleGeneratePdf(p)} style={smallGhost}>PDF</button>
                {p.status === 'draft' && (
                  <button className="pmBtn" onClick={() => handleStatusChange(p.id, 'sent')} style={smallGold}>Send</button>
                )}
                {p.status === 'sent' && (
                  <button className="pmBtn" onClick={() => handleStatusChange(p.id, 'received')} style={smallGold}>Received</button>
                )}
                {p.status === 'received' && (
                  <button className="pmBtn" onClick={() => handleStatusChange(p.id, 'closed')} style={smallGhost}>Close</button>
                )}
              </div>,
            ])}
          />
        )}
      </SectionCard>
    </PremiumSurface>
  );
}
