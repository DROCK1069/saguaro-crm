'use client';
/**
 * Saguaro Control Systems — Selections Management
 * Track material/finish selections by category, manage owner approvals,
 * budget variance, due dates, vendor info, and batch updates. Offline queue.
 */
import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { enqueue } from '@/lib/field-db';
import FieldPageHeader from '../FieldPageHeader';
import { scopedFieldIcon } from '../field-icons';

const GOLD   = '#F59E0B';
const BG     = '#0a0a0a';
const RAISED = '#141416';
const BORDER = 'rgba(255,255,255,0.12)';
const TEXT   = '#FFFFFF';
const DIM    = '#CBD5E1';
const GREEN  = '#22C55E';
const RED    = '#EF4444';
const AMBER  = '#F59E0B';
const BLUE   = '#F59E0B';
const PURPLE = '#8B5CF6';

/* ─── Constants ─── */
const CATEGORIES = [
  'Flooring', 'Countertops', 'Cabinets', 'Fixtures', 'Paint',
  'Tile', 'Appliances', 'Hardware', 'Lighting', 'Plumbing',
  'Windows', 'Doors', 'Roofing', 'Siding',
] as const;

const STATUSES = ['Pending', 'Owner Review', 'Selected', 'Ordered', 'Installed'] as const;
const STATUS_COLORS: Record<string, string> = {
  Pending: DIM, 'Owner Review': AMBER, Selected: BLUE, Ordered: PURPLE, Installed: GREEN,
};

const ROOMS = [
  'Kitchen', 'Master Bathroom', 'Guest Bathroom', 'Living Room', 'Dining Room',
  'Master Bedroom', 'Bedroom 2', 'Bedroom 3', 'Hallway', 'Laundry',
  'Garage', 'Exterior', 'Office', 'Basement', 'Whole House',
] as const;

/* ─── Types ─── */
interface SelectionOption {
  id: string;
  name: string;
  vendor: string;
  vendorContact: string;
  cost: number;
  leadTime: string;
  photoUrl: string;
  notes: string;
}

interface SelectionItem {
  id: string;
  category: string;
  description: string;
  room: string;
  status: string;
  allowance: number;
  options: SelectionOption[];
  selectedOptionId: string | null;
  selectedBy: string | null;
  selectedAt: string | null;
  dueDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

type View = 'list' | 'detail' | 'new' | 'summary';

/* ─── Helpers ─── */
function fmtCurrency(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(dueDate: string, status: string): boolean {
  if (!dueDate || status === 'Installed') return false;
  return new Date(dueDate) < new Date();
}

function getVariance(item: SelectionItem): number | null {
  if (!item.selectedOptionId) return null;
  const opt = item.options.find(o => o.id === item.selectedOptionId);
  if (!opt) return null;
  return item.allowance - opt.cost;
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}


/* ─── Badge Component ─── */
function Badge({ label, color, small }: { label: string; color: string; small?: boolean }) {
  return (
    <span style={{
      display: 'inline-block', padding: small ? '2px 8px' : '4px 12px',
      borderRadius: 999, fontSize: small ? 10 : 11, fontWeight: 700,
      background: color + '22', color, letterSpacing: 0.3,
    }}>
      {label}
    </span>
  );
}

/* ─── Confirm Dialog ─── */
function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
      <div style={{ background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24, maxWidth: 340, width: '90%' }}>
        <p style={{ margin: '0 0 20px', fontSize: 15, color: TEXT, lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12, color: DIM, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex: 1, background: RED, border: 'none', borderRadius: 10, padding: 12, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Photo Attach ───
   Real image upload (was a fake that attached a random picsum.photos stock
   image). Uploads the chosen file to the project via the canonical upload
   route and attaches the returned URL; renders the actual thumbnail. */
function PhotoAttach({ photos, onAdd, projectId }: { photos: string[]; onAdd: (url: string) => void; projectId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr('');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (projectId) fd.append('projectId', projectId);
      fd.append('category', 'Selections');
      const res = await fetch('/api/files/upload', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({} as any));
      const url: string | undefined = data?.file?.url || data?.file?.file_url || (Array.isArray(data?.files) ? data.files[0]?.url : undefined);
      if (res.ok && url) onAdd(url);
      else setErr(data?.error || 'Upload failed');
    } catch {
      setErr('Upload failed — check your connection.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        {photos.map((p, i) => (
          <div key={i} style={{ width: 64, height: 64, borderRadius: 8, background: BORDER, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p} alt="Selection photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        ))}
        <button onClick={() => inputRef.current?.click()} disabled={busy} style={{ width: 64, height: 64, borderRadius: 8, background: 'transparent', border: `2px dashed ${BORDER}`, color: GOLD, fontSize: 24, cursor: busy ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.6 : 1 }}>{busy ? '…' : '+'}</button>
      </div>
      {err && <p style={{ margin: 0, fontSize: 11, color: RED }}>{err}</p>}
      {photos.length > 0 && <p style={{ margin: 0, fontSize: 11, color: DIM }}>{photos.length} photo(s) attached</p>}
    </div>
  );
}

/* ─── SelectionsInner ─── */
function SelectionsInner() {
  const params = useSearchParams();
  const projectId = params.get('projectId') || '';

  const [items, setItems] = useState<SelectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<View>('list');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterRoom, setFilterRoom] = useState('All');
  const [batchMode, setBatchMode] = useState(false);
  const [batchIds, setBatchIds] = useState<Set<string>>(new Set());
  const [batchTargetStatus, setBatchTargetStatus] = useState('');
  const [confirmMsg, setConfirmMsg] = useState<{ msg: string; fn: () => void } | null>(null);
  const [toast, setToast] = useState('');

  /* ─── Form state for new / edit ─── */
  const [formCategory, setFormCategory] = useState('Flooring');
  const [formDesc, setFormDesc] = useState('');
  const [formRoom, setFormRoom] = useState('Kitchen');
  const [formAllowance, setFormAllowance] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formOptions, setFormOptions] = useState<SelectionOption[]>([
    { id: uid(), name: '', vendor: '', vendorContact: '', cost: 0, leadTime: '', photoUrl: '', notes: '' },
    { id: uid(), name: '', vendor: '', vendorContact: '', cost: 0, leadTime: '', photoUrl: '', notes: '' },
    { id: uid(), name: '', vendor: '', vendorContact: '', cost: 0, leadTime: '', photoUrl: '', notes: '' },
  ]);
  const [optionPhotos, setOptionPhotos] = useState<Record<string, string[]>>({});

  /* ─── Data load ─── */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        // Real project selections only — no seeded/fabricated finish selections
        // (this used to render fake vendors + "Jane Owner" approvals on any
        // project with none yet).
        if (!projectId) { setItems([]); setLoading(false); return; }
        const res = await fetch(`/api/projects/${projectId}/selections`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setItems(Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : (Array.isArray(data?.selections) ? data.selections : [])));
      } catch {
        if (!cancelled) { setItems([]); setError('Could not load selections. Please try again.'); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [projectId]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }, []);

  /* ─── Filtering ─── */
  const filtered = items.filter(item => {
    if (filterCategory !== 'All' && item.category !== filterCategory) return false;
    if (filterStatus !== 'All' && item.status !== filterStatus) return false;
    if (filterRoom !== 'All' && item.room !== filterRoom) return false;
    if (search) {
      const s = search.toLowerCase();
      return item.description.toLowerCase().includes(s) || item.category.toLowerCase().includes(s)
        || item.room.toLowerCase().includes(s) || item.options.some(o => o.name.toLowerCase().includes(s) || o.vendor.toLowerCase().includes(s));
    }
    return true;
  });

  /* ─── Stats ─── */
  const totalAllowance = items.reduce((s, i) => s + i.allowance, 0);
  const totalActual = items.reduce((s, i) => {
    if (!i.selectedOptionId) return s;
    const opt = i.options.find(o => o.id === i.selectedOptionId);
    return s + (opt ? opt.cost : 0);
  }, 0);
  const totalVariance = totalAllowance - totalActual;
  const overdueCount = items.filter(i => isOverdue(i.dueDate, i.status)).length;
  const pendingCount = items.filter(i => i.status === 'Pending' || i.status === 'Owner Review').length;

  /* ─── Open detail ─── */
  const openDetail = (id: string) => { setActiveId(id); setView('detail'); };
  const activeItem = items.find(i => i.id === activeId) || null;

  /* ─── Create selection ─── */
  const handleCreate = async () => {
    if (!formDesc.trim()) { showToast('Description required'); return; }
    const validOpts = formOptions.filter(o => o.name.trim());
    if (validOpts.length < 1) { showToast('At least 1 option required'); return; }
    const newItem: SelectionItem = {
      id: uid(), category: formCategory, description: formDesc.trim(),
      room: formRoom, status: 'Pending', allowance: parseFloat(formAllowance) || 0,
      options: validOpts.map(o => ({ ...o, id: o.id || uid() })),
      selectedOptionId: null, selectedBy: null, selectedAt: null,
      dueDate: formDueDate, notes: formNotes, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    setItems(prev => [newItem, ...prev]);
    if (projectId) {
      await enqueue({ url: `/api/projects/${projectId}/selections`, method: 'POST', body: JSON.stringify(newItem), contentType: 'application/json', isFormData: false });
    }
    resetForm();
    setView('list');
    showToast('Selection created');
  };

  const resetForm = () => {
    setFormCategory('Flooring'); setFormDesc(''); setFormRoom('Kitchen');
    setFormAllowance(''); setFormDueDate(''); setFormNotes('');
    setFormOptions([
      { id: uid(), name: '', vendor: '', vendorContact: '', cost: 0, leadTime: '', photoUrl: '', notes: '' },
      { id: uid(), name: '', vendor: '', vendorContact: '', cost: 0, leadTime: '', photoUrl: '', notes: '' },
      { id: uid(), name: '', vendor: '', vendorContact: '', cost: 0, leadTime: '', photoUrl: '', notes: '' },
    ]);
    setOptionPhotos({});
  };

  /* ─── Select an option (owner approval) ─── */
  const handleSelectOption = async (itemId: string, optionId: string) => {
    setItems(prev => prev.map(i => i.id === itemId ? {
      ...i, selectedOptionId: optionId, selectedBy: 'Current User', selectedAt: new Date().toISOString(),
      status: i.status === 'Pending' || i.status === 'Owner Review' ? 'Selected' : i.status,
      updatedAt: new Date().toISOString(),
    } : i));
    if (projectId) {
      await enqueue({ url: `/api/projects/${projectId}/selections/${itemId}/select`, method: 'PATCH', body: JSON.stringify({ optionId, selectedBy: 'Current User' }), contentType: 'application/json', isFormData: false });
    }
    showToast('Option selected');
  };

  /* ─── Update status ─── */
  const handleStatusChange = async (itemId: string, newStatus: string) => {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, status: newStatus, updatedAt: new Date().toISOString() } : i));
    if (projectId) {
      await enqueue({ url: `/api/projects/${projectId}/selections/${itemId}`, method: 'PATCH', body: JSON.stringify({ status: newStatus }), contentType: 'application/json', isFormData: false });
    }
    showToast(`Status → ${newStatus}`);
  };

  /* ─── Delete ─── */
  const handleDelete = async (itemId: string) => {
    setItems(prev => prev.filter(i => i.id !== itemId));
    if (projectId) {
      await enqueue({ url: `/api/projects/${projectId}/selections/${itemId}`, method: 'DELETE', body: JSON.stringify({}), contentType: 'application/json', isFormData: false });
    }
    setView('list');
    showToast('Selection deleted');
  };

  /* ─── Batch update ─── */
  const handleBatchUpdate = async () => {
    if (!batchTargetStatus || batchIds.size === 0) return;
    const ids = Array.from(batchIds);
    setItems(prev => prev.map(i => ids.includes(i.id) ? { ...i, status: batchTargetStatus, updatedAt: new Date().toISOString() } : i));
    if (projectId) {
      await enqueue({ url: `/api/projects/${projectId}/selections/batch-status`, method: 'PATCH', body: JSON.stringify({ ids, status: batchTargetStatus }), contentType: 'application/json', isFormData: false });
    }
    setBatchIds(new Set());
    setBatchMode(false);
    setBatchTargetStatus('');
    showToast(`${ids.length} item(s) updated to ${batchTargetStatus}`);
  };

  const toggleBatchId = (id: string) => {
    setBatchIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  /* ─── Shared Styles ─── */
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', background: '#1c1c1e', border: `1px solid ${BORDER}`,
    borderRadius: 10, color: TEXT, fontSize: 14, outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = { display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: DIM, letterSpacing: 0.5 };
  const btnPrimary: React.CSSProperties = {
    padding: '14px 20px', background: GOLD, border: 'none', borderRadius: 12,
    color: '#000', fontSize: 15, fontWeight: 700, cursor: 'pointer', width: '100%',
  };
  const btnSecondary: React.CSSProperties = {
    padding: '12px 16px', background: 'transparent', border: `1px solid ${BORDER}`,
    borderRadius: 10, color: DIM, fontSize: 13, cursor: 'pointer',
  };
  const cardStyle: React.CSSProperties = {
    background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 14,
    padding: 16, marginBottom: 10,
  };

  /* ─── Render: Loading ─── */
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: `3px solid ${BORDER}`, borderTopColor: GOLD, borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: DIM, fontSize: 14 }}>Loading selections...</p>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    );
  }

  /* ─── Render: Error ─── */
  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 320 }}>
          <p style={{ fontSize: 40, margin: '0 0 12px' }}>!</p>
          <p style={{ color: RED, fontSize: 15, marginBottom: 16 }}>{error}</p>
          <button onClick={() => window.location.reload()} style={btnPrimary}>Retry</button>
        </div>
      </div>
    );
  }

  /* ─── Render: Summary View ─── */
  if (view === 'summary') {
    const byCategory: Record<string, SelectionItem[]> = {};
    items.forEach(i => { if (!byCategory[i.category]) byCategory[i.category] = []; byCategory[i.category].push(i); });
    return (
      <div style={{ minHeight: '100vh', background: BG, padding: '0 0 100px' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, background: BG, zIndex: 100 }}>
          <button onClick={() => setView('list')} style={{ background: 'none', border: 'none', color: GOLD, fontSize: 22, cursor: 'pointer', padding: 0 }}>&#8592;</button>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: TEXT }}>Selection Sheet Summary</h1>
        </div>
        {/* Budget Overview */}
        <div style={{ padding: '16px 20px' }}>
          <div style={{ ...cardStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><p style={{ margin: 0, fontSize: 11, color: DIM }}>Total Allowance</p><p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700, color: TEXT }}>{fmtCurrency(totalAllowance)}</p></div>
            <div><p style={{ margin: 0, fontSize: 11, color: DIM }}>Total Actual</p><p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700, color: TEXT }}>{fmtCurrency(totalActual)}</p></div>
            <div><p style={{ margin: 0, fontSize: 11, color: DIM }}>Variance</p><p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700, color: totalVariance >= 0 ? GREEN : RED }}>{totalVariance >= 0 ? '+' : ''}{fmtCurrency(totalVariance)}</p></div>
            <div><p style={{ margin: 0, fontSize: 11, color: DIM }}>Items</p><p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700, color: TEXT }}>{items.length}</p></div>
          </div>
        </div>
        {/* By Category */}
        <div style={{ padding: '0 20px' }}>
          {Object.entries(byCategory).map(([cat, catItems]) => {
            const catAllowance = catItems.reduce((s, i) => s + i.allowance, 0);
            const catActual = catItems.reduce((s, i) => {
              if (!i.selectedOptionId) return s;
              const opt = i.options.find(o => o.id === i.selectedOptionId);
              return s + (opt ? opt.cost : 0);
            }, 0);
            return (
              <div key={cat} style={{ marginBottom: 20 }}>
                <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: GOLD }}>{cat}</h3>
                {catItems.map(item => {
                  const selOpt = item.selectedOptionId ? item.options.find(o => o.id === item.selectedOptionId) : null;
                  const v = getVariance(item);
                  return (
                    <div key={item.id} style={{ ...cardStyle, padding: 12, marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TEXT, flex: 1 }}>{item.description}</p>
                        <Badge label={item.status} color={STATUS_COLORS[item.status] || DIM} small />
                      </div>
                      <p style={{ margin: '0 0 4px', fontSize: 12, color: DIM }}>Room: {item.room}</p>
                      {selOpt ? (
                        <div style={{ fontSize: 12, color: DIM }}>
                          <p style={{ margin: '2px 0' }}>Selected: <span style={{ color: TEXT }}>{selOpt.name}</span></p>
                          <p style={{ margin: '2px 0' }}>Vendor: {selOpt.vendor}</p>
                          <p style={{ margin: '2px 0' }}>Allowance: {fmtCurrency(item.allowance)} | Actual: {fmtCurrency(selOpt.cost)} | Variance: <span style={{ color: v !== null && v >= 0 ? GREEN : RED }}>{v !== null ? (v >= 0 ? '+' : '') + fmtCurrency(v) : '—'}</span></p>
                        </div>
                      ) : (
                        <p style={{ margin: '2px 0', fontSize: 12, color: AMBER }}>No option selected — Allowance: {fmtCurrency(item.allowance)}</p>
                      )}
                    </div>
                  );
                })}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', fontSize: 12, color: DIM, borderTop: `1px solid ${BORDER}` }}>
                  <span>Category Allowance: {fmtCurrency(catAllowance)}</span>
                  <span>Actual: {fmtCurrency(catActual)}</span>
                </div>
              </div>
            );
          })}
        </div>
        {toast && <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: GREEN, color: '#000', padding: '10px 24px', borderRadius: 999, fontSize: 13, fontWeight: 700, zIndex: 9999 }}>{toast}</div>}
      </div>
    );
  }

  /* ─── Render: New Selection ─── */
  if (view === 'new') {
    return (
      <div style={{ minHeight: '100vh', background: BG, padding: '0 0 100px' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, background: BG, zIndex: 100 }}>
          <button onClick={() => { resetForm(); setView('list'); }} style={{ background: 'none', border: 'none', color: GOLD, fontSize: 22, cursor: 'pointer', padding: 0 }}>&#8592;</button>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: TEXT }}>New Selection</h1>
        </div>
        <div style={{ padding: '20px' }}>
          {/* Category */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>CATEGORY *</label>
            <select value={formCategory} onChange={e => setFormCategory(e.target.value)} style={{ ...inputStyle, appearance: 'auto' }}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {/* Description */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>DESCRIPTION *</label>
            <input value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="e.g. Kitchen Countertops" style={inputStyle} />
          </div>
          {/* Room */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>ROOM / LOCATION</label>
            <select value={formRoom} onChange={e => setFormRoom(e.target.value)} style={{ ...inputStyle, appearance: 'auto' }}>
              {ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {/* Allowance */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>ALLOWANCE AMOUNT ($)</label>
            <input type="number" value={formAllowance} onChange={e => setFormAllowance(e.target.value)} placeholder="0.00" style={inputStyle} />
          </div>
          {/* Due Date */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>DUE DATE</label>
            <input type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)} style={inputStyle} />
          </div>
          {/* Notes */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>NOTES</label>
            <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={3} placeholder="Additional notes..." style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          {/* Options */}
          <h3 style={{ margin: '24px 0 12px', fontSize: 15, fontWeight: 700, color: TEXT }}>Options</h3>
          {formOptions.map((opt, idx) => (
            <div key={opt.id} style={{ ...cardStyle, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: GOLD }}>Option {idx + 1}</p>
                {formOptions.length > 1 && (
                  <button onClick={() => setFormOptions(prev => prev.filter(o => o.id !== opt.id))} style={{ background: 'none', border: 'none', color: RED, fontSize: 12, cursor: 'pointer' }}>Remove</button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input placeholder="Option name *" value={opt.name} onChange={e => { const v = e.target.value; setFormOptions(prev => prev.map(o => o.id === opt.id ? { ...o, name: v } : o)); }} style={inputStyle} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input placeholder="Vendor" value={opt.vendor} onChange={e => { const v = e.target.value; setFormOptions(prev => prev.map(o => o.id === opt.id ? { ...o, vendor: v } : o)); }} style={inputStyle} />
                  <input placeholder="Contact email" value={opt.vendorContact} onChange={e => { const v = e.target.value; setFormOptions(prev => prev.map(o => o.id === opt.id ? { ...o, vendorContact: v } : o)); }} style={inputStyle} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input type="number" placeholder="Cost ($)" value={opt.cost || ''} onChange={e => { const v = parseFloat(e.target.value) || 0; setFormOptions(prev => prev.map(o => o.id === opt.id ? { ...o, cost: v } : o)); }} style={inputStyle} />
                  <input placeholder="Lead time" value={opt.leadTime} onChange={e => { const v = e.target.value; setFormOptions(prev => prev.map(o => o.id === opt.id ? { ...o, leadTime: v } : o)); }} style={inputStyle} />
                </div>
                <input placeholder="Notes" value={opt.notes} onChange={e => { const v = e.target.value; setFormOptions(prev => prev.map(o => o.id === opt.id ? { ...o, notes: v } : o)); }} style={inputStyle} />
                <div>
                  <label style={{ ...labelStyle, marginBottom: 4 }}>PHOTOS</label>
                  <PhotoAttach projectId={projectId} photos={optionPhotos[opt.id] || []} onAdd={(url) => setOptionPhotos(prev => ({ ...prev, [opt.id]: [...(prev[opt.id] || []), url] }))} />
                </div>
              </div>
            </div>
          ))}
          <button onClick={() => setFormOptions(prev => [...prev, { id: uid(), name: '', vendor: '', vendorContact: '', cost: 0, leadTime: '', photoUrl: '', notes: '' }])} style={{ ...btnSecondary, width: '100%', marginBottom: 24 }}>+ Add Another Option</button>
          <button onClick={handleCreate} style={btnPrimary}>Create Selection</button>
        </div>
        {toast && <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: GREEN, color: '#000', padding: '10px 24px', borderRadius: 999, fontSize: 13, fontWeight: 700, zIndex: 9999 }}>{toast}</div>}
      </div>
    );
  }

  /* ─── Render: Detail View ─── */
  if (view === 'detail' && activeItem) {
    const selOpt = activeItem.selectedOptionId ? activeItem.options.find(o => o.id === activeItem.selectedOptionId) : null;
    const variance = getVariance(activeItem);
    const overdue = isOverdue(activeItem.dueDate, activeItem.status);
    return (
      <div style={{ minHeight: '100vh', background: BG, padding: '0 0 100px' }}>
        {confirmMsg && <ConfirmDialog message={confirmMsg.msg} onConfirm={() => { confirmMsg.fn(); setConfirmMsg(null); }} onCancel={() => setConfirmMsg(null)} />}
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, background: BG, zIndex: 100 }}>
          <button onClick={() => setView('list')} style={{ background: 'none', border: 'none', color: GOLD, fontSize: 22, cursor: 'pointer', padding: 0 }}>&#8592;</button>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: TEXT }}>{activeItem.description}</h1>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: DIM }}>{activeItem.category} — {activeItem.room}</p>
          </div>
          <button onClick={() => setConfirmMsg({ msg: `Delete "${activeItem.description}"?`, fn: () => handleDelete(activeItem.id) })} style={{ background: 'none', border: 'none', color: RED, fontSize: 13, cursor: 'pointer' }}>Delete</button>
        </div>
        <div style={{ padding: '16px 20px' }}>
          {/* Status + Due */}
          <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: DIM }}>STATUS</p>
              <Badge label={activeItem.status} color={STATUS_COLORS[activeItem.status] || DIM} />
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: 11, color: DIM }}>DUE</p>
              <p style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 600, color: overdue ? RED : TEXT }}>
                {fmtDate(activeItem.dueDate)} {overdue && ' OVERDUE'}
              </p>
            </div>
          </div>
          {/* Status Workflow */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>UPDATE STATUS</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {STATUSES.map(s => (
                <button key={s} onClick={() => handleStatusChange(activeItem.id, s)}
                  style={{ padding: '8px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: activeItem.status === s ? 'none' : `1px solid ${BORDER}`, background: activeItem.status === s ? STATUS_COLORS[s] + '33' : 'transparent', color: activeItem.status === s ? STATUS_COLORS[s] : DIM }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          {/* Budget */}
          <div style={{ ...cardStyle }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: TEXT }}>Budget</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div><p style={{ margin: 0, fontSize: 11, color: DIM }}>Allowance</p><p style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 700, color: TEXT }}>{fmtCurrency(activeItem.allowance)}</p></div>
              <div><p style={{ margin: 0, fontSize: 11, color: DIM }}>Actual</p><p style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 700, color: TEXT }}>{selOpt ? fmtCurrency(selOpt.cost) : '—'}</p></div>
              <div><p style={{ margin: 0, fontSize: 11, color: DIM }}>Variance</p><p style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 700, color: variance !== null ? (variance >= 0 ? GREEN : RED) : DIM }}>{variance !== null ? (variance >= 0 ? '+' : '') + fmtCurrency(variance) : '—'}</p></div>
            </div>
          </div>
          {/* Owner Approval */}
          {activeItem.selectedBy && (
            <div style={{ ...cardStyle }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: TEXT }}>Owner Approval</h3>
              <p style={{ margin: '2px 0', fontSize: 13, color: DIM }}>Selected by: <span style={{ color: TEXT }}>{activeItem.selectedBy}</span></p>
              <p style={{ margin: '2px 0', fontSize: 13, color: DIM }}>Date: <span style={{ color: TEXT }}>{fmtDate(activeItem.selectedAt || '')}</span></p>
            </div>
          )}
          {/* Notes */}
          {activeItem.notes && (
            <div style={{ ...cardStyle }}>
              <h3 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: TEXT }}>Notes</h3>
              <p style={{ margin: 0, fontSize: 13, color: DIM, lineHeight: 1.5 }}>{activeItem.notes}</p>
            </div>
          )}
          {/* Options */}
          <h3 style={{ margin: '20px 0 12px', fontSize: 15, fontWeight: 700, color: TEXT }}>Options ({activeItem.options.length})</h3>
          {activeItem.options.map((opt, idx) => {
            const isSelected = activeItem.selectedOptionId === opt.id;
            const optVariance = activeItem.allowance - opt.cost;
            return (
              <div key={opt.id} style={{ ...cardStyle, borderColor: isSelected ? GREEN : BORDER, borderWidth: isSelected ? 2 : 1, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: TEXT }}>{opt.name}</p>
                    {isSelected && <Badge label="SELECTED" color={GREEN} small />}
                  </div>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: GOLD }}>{fmtCurrency(opt.cost)}</p>
                </div>
                <div style={{ fontSize: 12, color: DIM, lineHeight: 1.6 }}>
                  <p style={{ margin: '2px 0' }}>Vendor: <span style={{ color: TEXT }}>{opt.vendor || '—'}</span></p>
                  <p style={{ margin: '2px 0' }}>Contact: {opt.vendorContact || '—'}</p>
                  <p style={{ margin: '2px 0' }}>Lead Time: {opt.leadTime || '—'}</p>
                  {opt.notes && <p style={{ margin: '2px 0' }}>Notes: {opt.notes}</p>}
                  <p style={{ margin: '2px 0' }}>Variance vs Allowance: <span style={{ color: optVariance >= 0 ? GREEN : RED }}>{optVariance >= 0 ? '+' : ''}{fmtCurrency(optVariance)}</span></p>
                </div>
                {/* Photo attachment sim */}
                <div style={{ marginTop: 8 }}>
                  <PhotoAttach projectId={projectId} photos={optionPhotos[opt.id] || []} onAdd={(url) => setOptionPhotos(prev => ({ ...prev, [opt.id]: [...(prev[opt.id] || []), url] }))} />
                </div>
                {!isSelected && (
                  <button onClick={() => handleSelectOption(activeItem.id, opt.id)} style={{ marginTop: 10, padding: '10px 16px', background: GOLD, border: 'none', borderRadius: 10, color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer', width: '100%' }}>
                    Select This Option
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {toast && <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: GREEN, color: '#000', padding: '10px 24px', borderRadius: 999, fontSize: 13, fontWeight: 700, zIndex: 9999 }}>{toast}</div>}
      </div>
    );
  }

  /* ─── Render: List View ─── */
  return (
    <div style={{ minHeight: '100vh', background: BG, padding: '0 0 100px' }}>
      {confirmMsg && <ConfirmDialog message={confirmMsg.msg} onConfirm={() => { confirmMsg.fn(); setConfirmMsg(null); }} onCancel={() => setConfirmMsg(null)} />}
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BORDER}`, position: 'sticky', top: 0, background: BG, zIndex: 100 }}>
        <FieldPageHeader
          title="Selections"
          icon={scopedFieldIcon('punchList', 'ph')}
          actions={<>
            <button onClick={() => setView('summary')} style={{ ...btnSecondary, padding: '8px 12px', fontSize: 12 }}>Summary</button>
            <button onClick={() => setView('new')} style={{ padding: '8px 16px', background: GOLD, border: 'none', borderRadius: 10, color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ New</button>
          </>}
        />
        {/* Quick Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
          <div style={{ background: RAISED, borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 10, color: DIM }}>Total</p>
            <p style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 700, color: TEXT }}>{items.length}</p>
          </div>
          <div style={{ background: RAISED, borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 10, color: DIM }}>Pending</p>
            <p style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 700, color: AMBER }}>{pendingCount}</p>
          </div>
          <div style={{ background: RAISED, borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 10, color: DIM }}>Overdue</p>
            <p style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 700, color: overdueCount > 0 ? RED : GREEN }}>{overdueCount}</p>
          </div>
          <div style={{ background: RAISED, borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 10, color: DIM }}>Variance</p>
            <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 700, color: totalVariance >= 0 ? GREEN : RED }}>{totalVariance >= 0 ? '+' : ''}{fmtCurrency(totalVariance)}</p>
          </div>
        </div>
        {/* Search */}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search selections, vendors..." style={{ ...inputStyle, marginBottom: 10, background: RAISED }} />
        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ ...inputStyle, width: 'auto', minWidth: 100, fontSize: 12, padding: '8px 10px', background: RAISED, appearance: 'auto' }}>
            <option value="All">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inputStyle, width: 'auto', minWidth: 90, fontSize: 12, padding: '8px 10px', background: RAISED, appearance: 'auto' }}>
            <option value="All">All Status</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterRoom} onChange={e => setFilterRoom(e.target.value)} style={{ ...inputStyle, width: 'auto', minWidth: 90, fontSize: 12, padding: '8px 10px', background: RAISED, appearance: 'auto' }}>
            <option value="All">All Rooms</option>
            {ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      {/* Batch Mode Controls */}
      <div style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => { setBatchMode(!batchMode); setBatchIds(new Set()); }} style={{ ...btnSecondary, padding: '8px 14px', fontSize: 12, color: batchMode ? GOLD : DIM, borderColor: batchMode ? GOLD : BORDER }}>
          {batchMode ? 'Cancel Batch' : 'Batch Update'}
        </button>
        {batchMode && batchIds.size > 0 && (
          <>
            <select value={batchTargetStatus} onChange={e => setBatchTargetStatus(e.target.value)} style={{ ...inputStyle, width: 'auto', minWidth: 110, fontSize: 12, padding: '8px 10px', background: RAISED, appearance: 'auto' }}>
              <option value="">Set status...</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={handleBatchUpdate} disabled={!batchTargetStatus} style={{ padding: '8px 14px', background: batchTargetStatus ? GOLD : BORDER, border: 'none', borderRadius: 10, color: batchTargetStatus ? '#000' : DIM, fontSize: 12, fontWeight: 700, cursor: batchTargetStatus ? 'pointer' : 'default' }}>
              Apply ({batchIds.size})
            </button>
          </>
        )}
      </div>

      {/* Empty State */}
      {filtered.length === 0 && (
        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: 48, margin: '0 0 12px' }}>&#9634;</p>
          <p style={{ color: DIM, fontSize: 15, marginBottom: 4 }}>No selections found</p>
          <p style={{ color: DIM, fontSize: 13 }}>{search || filterCategory !== 'All' || filterStatus !== 'All' || filterRoom !== 'All' ? 'Try adjusting your filters' : 'Create your first selection to get started'}</p>
        </div>
      )}

      {/* Selection Cards */}
      <div style={{ padding: '0 20px' }}>
        {filtered.map(item => {
          const selOpt = item.selectedOptionId ? item.options.find(o => o.id === item.selectedOptionId) : null;
          const variance = getVariance(item);
          const overdue = isOverdue(item.dueDate, item.status);
          return (
            <div key={item.id} style={{ ...cardStyle, cursor: batchMode ? 'default' : 'pointer', borderColor: batchIds.has(item.id) ? GOLD : overdue ? RED : BORDER, borderWidth: batchIds.has(item.id) ? 2 : 1 }}
              onClick={() => batchMode ? toggleBatchId(item.id) : openDetail(item.id)}>
              {/* Top row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1 }}>
                  {batchMode && (
                    <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${batchIds.has(item.id) ? GOLD : BORDER}`, background: batchIds.has(item.id) ? GOLD + '33' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                      {batchIds.has(item.id) && <span style={{ color: GOLD, fontSize: 14, fontWeight: 700 }}>&#10003;</span>}
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: TEXT }}>{item.description}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: DIM }}>{item.category} — {item.room}</p>
                  </div>
                </div>
                <Badge label={item.status} color={STATUS_COLORS[item.status] || DIM} />
              </div>
              {/* Budget row */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 6, fontSize: 12 }}>
                <span style={{ color: DIM }}>Allowance: <span style={{ color: TEXT }}>{fmtCurrency(item.allowance)}</span></span>
                {selOpt && <span style={{ color: DIM }}>Actual: <span style={{ color: TEXT }}>{fmtCurrency(selOpt.cost)}</span></span>}
                {variance !== null && <span style={{ color: variance >= 0 ? GREEN : RED }}>{variance >= 0 ? '+' : ''}{fmtCurrency(variance)}</span>}
              </div>
              {/* Selected option */}
              {selOpt && (
                <p style={{ margin: '0 0 4px', fontSize: 12, color: BLUE }}>Selected: {selOpt.name} ({selOpt.vendor})</p>
              )}
              {!selOpt && item.options.length > 0 && (
                <p style={{ margin: '0 0 4px', fontSize: 12, color: AMBER }}>{item.options.length} option(s) — awaiting selection</p>
              )}
              {/* Due + overdue */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ margin: 0, fontSize: 11, color: overdue ? RED : DIM }}>
                  Due: {fmtDate(item.dueDate)} {overdue && ' — OVERDUE'}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: DIM }}>{item.options.length} options</p>
              </div>
            </div>
          );
        })}
      </div>

      {toast && <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: GREEN, color: '#000', padding: '10px 24px', borderRadius: 999, fontSize: 13, fontWeight: 700, zIndex: 9999 }}>{toast}</div>}
    </div>
  );
}

/* ─── Default Export with Suspense ─── */
export default function Page() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '3px solid rgba(255,255,255,0.12)', borderTopColor: '#F59E0B', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#CBD5E1', fontSize: 14 }}>Loading...</p>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    }>
      <SelectionsInner />
    </Suspense>
  );
}