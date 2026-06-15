'use client';
import React, { useCallback, useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { WarningCircle, Wallet } from '@phosphor-icons/react';
import { EmptyState } from '../../../../../components/EmptyState';
import { Skeleton, SkeletonKPI } from '../../../../../components/ui/Skeleton';

const GOLD='#C8881C',DARK='#F2F2F7',RAISED='#FFFFFF',BORDER='#E5E5EA',DIM='#6E6E73',TEXT='#1C1C1E',RED='#c03030';
const fmt = (n: number | null | undefined) => '$' + (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (a: number | null | undefined, b: number | null | undefined) => (b ?? 0) > 0 ? (((a ?? 0) / (b as number)) * 100).toFixed(1) + '%' : '0%';

interface BudgetLine {
  id: string;
  cost_code: string;
  description: string;
  original_budget: number;
  approved_cos: number;
  revised_budget: number;
  committed_cost: number;
  actual_cost: number;
  pct_complete: number;
  forecast_cost: number;
  category: string;
}

interface AddLineForm {
  cost_code: string;
  description: string;
  original_budget: string;
}

export default function BudgetPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [lines, setLines] = useState<BudgetLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<AddLineForm>({ cost_code: '', description: '', original_budget: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [adjustId, setAdjustId] = useState<string | null>(null);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [noteVal, setNoteVal] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`/api/projects/${projectId}/budget`);
      if (!r.ok) throw new Error(`Request failed (${r.status})`);
      const d = await r.json();
      setLines(Array.isArray(d.lines) ? d.lines : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load budget');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  async function addLine(e: React.FormEvent) {
    e.preventDefault();
    const budget = parseFloat(addForm.original_budget) || 0;
    try {
      const r = await fetch(`/api/projects/${projectId}/budget`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cost_code: addForm.cost_code,
          description: addForm.description,
          original_budget: budget,
          project_id: projectId,
        }),
      });
      const d = await r.json();
      const newLine: BudgetLine = d.line || {
        id: Date.now().toString(),
        cost_code: addForm.cost_code,
        description: addForm.description,
        original_budget: budget,
        approved_cos: 0,
        revised_budget: budget,
        committed_cost: 0,
        actual_cost: 0,
        pct_complete: 0,
        forecast_cost: budget,
        category: 'Other',
      };
      setLines(prev => [...prev, newLine]);
      setAddForm({ cost_code: '', description: '', original_budget: '' });
      setShowAddForm(false);
      showToast('Budget line added.');
    } catch {
      showToast('Failed to add line.', false);
    }
  }

  async function saveEdit(id: string) {
    const amount = parseFloat(editAmount) || 0;
    setLines(prev => prev.map(l => l.id === id ? { ...l, original_budget: amount, revised_budget: amount + l.approved_cos, forecast_cost: Math.max(l.actual_cost, amount) } : l));
    setEditingId(null);
    try {
      await fetch(`/api/projects/${projectId}/budget`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, original_budget: amount }),
      });
      showToast('Budget line updated.');
    } catch {
      showToast('Saved locally (offline mode).', true);
    }
  }

  function openMenu(id: string) { setMenuId(id); setEditingId(null); setAdjustId(null); setNoteId(null); setDeleteId(null); }

  async function handleAdjust(id: string, pct: number) {
    const line = lines.find(l => l.id === id);
    if (!line) return;
    const newAmt = Math.round(line.original_budget * (1 + pct / 100));
    setLines(prev => prev.map(l => l.id === id ? { ...l, original_budget: newAmt, revised_budget: newAmt + l.approved_cos, forecast_cost: Math.max(l.actual_cost, newAmt) } : l));
    setAdjustId(null);
    try {
      await fetch(`/api/projects/${projectId}/budget`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, original_budget: newAmt }) });
      showToast(`Adjusted ${pct > 0 ? '+' : ''}${pct}%`);
    } catch { showToast('Saved locally.'); }
  }

  function handleCopy(id: string, amount: number) {
    navigator.clipboard.writeText(fmt(amount)).catch(() => {});
    setCopiedId(id); setTimeout(() => setCopiedId(null), 2000);
    setMenuId(null);
  }

  async function handleDeleteLine(id: string) {
    setLines(prev => prev.filter(l => l.id !== id));
    setDeleteId(null);
    try {
      await fetch(`/api/projects/${projectId}/budget`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, _delete: true }) });
      showToast('Budget line deleted.');
    } catch { showToast('Deleted locally.'); }
  }

  function csvCell(v: unknown): string {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  async function exportReport() {
    setExporting(true);
    try {
      const r = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportType: 'job-cost', projectId }),
      });
      const d = await r.json();
      const columns: string[] = Array.isArray(d.columns) ? d.columns : [];
      const rows: unknown[][] = Array.isArray(d.rows) ? d.rows : [];
      if (!columns.length || !rows.length) {
        showToast(d.message || d.error || 'No budget data to export.', false);
        return;
      }
      const csv = [columns, ...rows]
        .map(row => (Array.isArray(row) ? row : [row]).map(csvCell).join(','))
        .join('\r\n');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `job-cost-summary-${projectId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('Exported');
    } catch {
      showToast('Export failed.', false);
    } finally {
      setExporting(false);
    }
  }

  // KPI calculations
  const totalOriginal = lines.reduce((s, l) => s + (l.original_budget ?? 0), 0);
  const totalApprovedCOs = lines.reduce((s, l) => s + (l.approved_cos ?? 0), 0);
  const totalRevised = lines.reduce((s, l) => s + (l.revised_budget ?? 0), 0);
  const totalActual = lines.reduce((s, l) => s + (l.actual_cost ?? 0), 0);
  const totalForecast = lines.reduce((s, l) => s + (l.forecast_cost ?? 0), 0);
  const totalVariance = totalRevised - totalForecast;
  const totalCommitted = lines.reduce((s, l) => s + (l.committed_cost ?? 0), 0);

  function rowBg(l: BudgetLine) {
    const actual = l.actual_cost ?? 0;
    const revised = l.revised_budget ?? 0;
    if (actual > revised) return 'rgba(192,48,48,.08)';
    if (revised > 0 && actual / revised > 0.9) return 'rgba(212,160,23,.06)';
    return 'transparent';
  }

  const inputStyle: React.CSSProperties = {
    padding: '8px 10px', background: DARK, border: `1px solid ${BORDER}`,
    borderRadius: 6, color: TEXT, fontSize: 13, outline: 'none', boxSizing: 'border-box', width: '100%',
  };

  // LOADING — skeletons that mirror the KPI row + table, never computed zeros.
  if (loading) {
    return (
      <div style={{ background: DARK, minHeight: '100%' }}>
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${BORDER}`, background: DARK }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: TEXT }}>Budget</h2>
          <div style={{ fontSize: 12, color: DIM, marginTop: 3 }}>Job costing by CSI cost code</div>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 24 }}>
            {Array.from({ length: 5 }).map((_, i) => <SkeletonKPI key={i} />)}
          </div>
          <div style={{ background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 18 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: i < 5 ? `1px solid rgba(229,229,234,.5)` : 'none' }}>
                <Skeleton width={70} height={14} />
                <Skeleton width="32%" height={14} />
                <div style={{ flex: 1 }} />
                <Skeleton width={90} height={14} />
                <Skeleton width={90} height={14} />
                <Skeleton width={70} height={14} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ERROR — distinct, actionable block. NEVER render $0 KPIs / "no data" on a
  // failed load, which on a financial page is indistinguishable from a real
  // empty project. Reuse the shared EmptyState with a Retry action.
  if (error) {
    return (
      <div style={{ background: DARK, minHeight: '100%' }}>
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${BORDER}`, background: DARK }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: TEXT }}>Budget</h2>
          <div style={{ fontSize: 12, color: DIM, marginTop: 3 }}>Job costing by CSI cost code</div>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ background: 'rgba(192,48,48,.12)', border: `1px solid rgba(192,48,48,.3)`, borderRadius: 8, padding: '12px 16px', marginBottom: 20, color: RED, fontSize: 13 }}>
            {error}
          </div>
          <EmptyState
            icon={<WarningCircle size={32} weight="duotone" />}
            title="Couldn't load budget"
            description="Something went wrong while loading the job-cost budget. Your data is safe — this is a loading error, not an empty project."
            actionLabel="Retry"
            onAction={load}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: DARK, minHeight: '100%' }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, padding: '12px 20px', borderRadius: 8, background: toast.ok ? 'rgba(34,197,94,.9)' : 'rgba(239,68,68,.9)', color: '#fff', fontWeight: 600, fontSize: 14 }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '18px 24px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: DARK }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: TEXT }}>Budget</h2>
          <div style={{ fontSize: 12, color: DIM, marginTop: 3 }}>Job costing by CSI cost code</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setShowAddForm(v => !v)}
            style={{ padding: '8px 16px', background: 'rgba(212,160,23,.12)', border: '1px solid rgba(212,160,23,.3)', borderRadius: 7, color: GOLD, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            + Add Line
          </button>
          <button
            onClick={exportReport}
            disabled={exporting}
            style={{ padding: '8px 16px', background: `linear-gradient(135deg,${GOLD},#E0A030)`, border: 'none', borderRadius: 7, color: '#1C1C1E', fontSize: 13, fontWeight: 800, cursor: exporting ? 'wait' : 'pointer', opacity: exporting ? 0.7 : 1 }}
          >
            {exporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>

      <div style={{ padding: 24 }}>
        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 24 }}>
          {[
            { l: 'Total Contract', v: fmt(totalRevised), c: TEXT },
            { l: 'Original Budget', v: fmt(totalOriginal), c: TEXT },
            { l: 'Actual to Date', v: fmt(totalActual), c: '#f97316' },
            { l: 'Projected Final', v: fmt(totalForecast), c: totalForecast > totalRevised ? '#ff7070' : '#3dd68c' },
            { l: 'Variance', v: (totalVariance >= 0 ? '+' : '') + fmt(totalVariance), c: totalVariance >= 0 ? '#3dd68c' : '#ff7070' },
          ].map(k => (
            <div key={k.l} style={{ background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '16px 18px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: DIM, marginBottom: 6 }}>{k.l}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: k.c }}>{k.v}</div>
            </div>
          ))}
        </div>

        {/* Add Line Form */}
        {showAddForm && (
          <form onSubmit={addLine} style={{ background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 18, marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: TEXT, marginBottom: 14 }}>Add Budget Line</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr auto', gap: 12, alignItems: 'flex-end' }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: DIM, textTransform: 'uppercase', marginBottom: 5 }}>CSI Code</label>
                <input value={addForm.cost_code} onChange={e => setAddForm(f => ({ ...f, cost_code: e.target.value }))} placeholder="e.g. 03-300" required style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: DIM, textTransform: 'uppercase', marginBottom: 5 }}>Description</label>
                <input value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Cast-in-Place Concrete" required style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: DIM, textTransform: 'uppercase', marginBottom: 5 }}>Budget Amount ($)</label>
                <input value={addForm.original_budget} onChange={e => setAddForm(f => ({ ...f, original_budget: e.target.value }))} placeholder="0" type="number" min="0" required style={inputStyle} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" style={{ padding: '8px 16px', background: `linear-gradient(135deg,${GOLD},#E0A030)`, border: 'none', borderRadius: 7, color: '#1C1C1E', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>Add</button>
                <button type="button" onClick={() => setShowAddForm(false)} style={{ padding: '8px 12px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 7, color: DIM, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </form>
        )}

        {/* EMPTY — genuine zero results (only reaches here when !loading && !error). */}
        {lines.length === 0 ? (
          <EmptyState
            icon={<Wallet size={32} weight="duotone" />}
            title="No budget lines yet"
            description="Add your first budget line to start job costing by CSI cost code for this project."
            actionLabel="Add Budget Line"
            onAction={() => setShowAddForm(true)}
          />
        ) : (
        /* Budget Table */
        <div style={{ background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F2F2F7' }}>
                  {['Cost Code', 'Description', 'Orig. Budget', 'Approved COs', 'Revised Budget', 'Committed', 'Actual Cost', '% Complete', 'Remaining', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Cost Code' || h === 'Description' || h === 'Actions' ? 'left' : 'right', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: DIM, borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map(l => {
                  const remaining = (l.revised_budget ?? 0) - (l.actual_cost ?? 0);
                  const pct = l.pct_complete ?? 0;
                  const isEditing = editingId === l.id;
                  return (
                    <tr key={l.id} style={{ borderBottom: `1px solid rgba(229,229,234,.5)`, background: rowBg(l) }}>
                      <td style={{ padding: '11px 14px', color: GOLD, fontWeight: 700, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{l.cost_code}</td>
                      <td style={{ padding: '11px 14px', color: TEXT, fontWeight: 500, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.description}</td>
                      <td style={{ padding: '11px 14px', textAlign: 'right', color: TEXT }}>
                        {isEditing ? (
                          <input
                            value={editAmount}
                            onChange={e => setEditAmount(e.target.value)}
                            type="number"
                            style={{ width: 110, padding: '4px 8px', background: DARK, border: `1px solid ${GOLD}`, borderRadius: 5, color: TEXT, fontSize: 12, outline: 'none', textAlign: 'right' }}
                            autoFocus
                          />
                        ) : fmt(l.original_budget)}
                      </td>
                      <td style={{ padding: '11px 14px', textAlign: 'right', color: (l.approved_cos ?? 0) > 0 ? '#4a9de8' : DIM }}>{(l.approved_cos ?? 0) > 0 ? '+' + fmt(l.approved_cos) : '—'}</td>
                      <td style={{ padding: '11px 14px', textAlign: 'right', color: TEXT, fontWeight: 600 }}>{fmt(l.revised_budget)}</td>
                      <td style={{ padding: '11px 14px', textAlign: 'right', color: '#4a9de8' }}>{fmt(l.committed_cost)}</td>
                      <td style={{ padding: '11px 14px', textAlign: 'right', color: (l.actual_cost ?? 0) > (l.revised_budget ?? 0) ? '#ff7070' : (l.actual_cost ?? 0) > 0 ? '#f97316' : DIM }}>{fmt(l.actual_cost)}</td>
                      <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                          <div style={{ width: 40, height: 4, background: 'rgba(0,0,0,.08)', borderRadius: 2 }}>
                            <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: pct >= 100 ? '#3dd68c' : GOLD, borderRadius: 2 }} />
                          </div>
                          <span style={{ color: pct >= 100 ? '#3dd68c' : TEXT, fontWeight: 600, whiteSpace: 'nowrap' }}>{pct}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '11px 14px', textAlign: 'right', color: remaining >= 0 ? '#3dd68c' : '#ff7070', fontWeight: 600 }}>{fmt(remaining)}</td>
                      <td style={{ padding: '11px 14px', whiteSpace: 'nowrap', position: 'relative' as const }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: 5 }}>
                            <button onClick={() => saveEdit(l.id)} style={{ padding: '3px 8px', background: `linear-gradient(135deg,${GOLD},#E0A030)`, border: 'none', borderRadius: 4, color: '#1C1C1E', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Save</button>
                            <button onClick={() => setEditingId(null)} style={{ padding: '3px 8px', background: 'none', border: `1px solid ${BORDER}`, borderRadius: 4, color: DIM, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                          </div>
                        ) : adjustId === l.id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            {[-10, -5, 5, 10].map(p => (
                              <button key={p} onClick={() => handleAdjust(l.id, p)} style={{ padding: '3px 7px', background: p > 0 ? 'rgba(61,214,140,.1)' : 'rgba(239,68,68,.1)', border: `1px solid ${p > 0 ? 'rgba(61,214,140,.25)' : 'rgba(239,68,68,.25)'}`, borderRadius: 4, color: p > 0 ? '#3dd68c' : '#ff7070', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{p > 0 ? '+' : ''}{p}%</button>
                            ))}
                            <button onClick={() => setAdjustId(null)} style={{ padding: '3px 6px', background: 'none', border: 'none', color: DIM, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                          </div>
                        ) : deleteId === l.id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, color: '#ff7070', fontWeight: 600 }}>Delete?</span>
                            <button onClick={() => handleDeleteLine(l.id)} style={{ padding: '3px 8px', background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 4, color: '#ff7070', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Yes</button>
                            <button onClick={() => setDeleteId(null)} style={{ padding: '3px 8px', background: 'none', border: `1px solid ${BORDER}`, borderRadius: 4, color: DIM, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {copiedId === l.id && <span style={{ fontSize: 10, color: '#3dd68c', fontWeight: 600 }}>Copied!</span>}
                            <button onClick={() => openMenu(l.id)} style={{ padding: '3px 8px', background: 'none', border: `1px solid ${BORDER}`, borderRadius: 4, color: DIM, fontSize: 11, cursor: 'pointer' }}>Actions &#9662;</button>
                            {menuId === l.id && (
                              <div style={{ position: 'absolute', top: 36, right: 14, background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 4, zIndex: 100, minWidth: 150, boxShadow: '0 8px 24px rgba(0,0,0,.4)' }}>
                                {[
                                  { label: 'Edit Amount', icon: '\u270F\uFE0F', action: () => { setMenuId(null); setEditingId(l.id); setEditAmount(String(l.original_budget)); } },
                                  { label: 'Adjust %', icon: '\uD83D\uDCCA', action: () => { setMenuId(null); setAdjustId(l.id); } },
                                  { label: 'Copy Amount', icon: '\uD83D\uDCCB', action: () => handleCopy(l.id, l.original_budget) },
                                ].map(item => (
                                  <div key={item.label} onClick={item.action} style={{ padding: '7px 12px', fontSize: 12, color: TEXT, cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8 }} onMouseEnter={e => (e.currentTarget.style.background = DARK)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                    <span style={{ fontSize: 14 }}>{item.icon}</span>{item.label}
                                  </div>
                                ))}
                                <div style={{ height: 1, background: BORDER, margin: '4px 0' }} />
                                <div onClick={() => { setMenuId(null); setDeleteId(l.id); }} style={{ padding: '7px 12px', fontSize: 12, color: '#ff7070', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8 }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,.08)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                  <span style={{ fontSize: 14 }}>{'\uD83D\uDDD1\uFE0F'}</span>Delete Line
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'rgba(0,0,0,.03)', fontWeight: 800 }}>
                  <td colSpan={2} style={{ padding: '12px 14px', color: TEXT, fontWeight: 800 }}>TOTALS</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', color: TEXT }}>{fmt(totalOriginal)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', color: totalApprovedCOs > 0 ? '#4a9de8' : DIM }}>{totalApprovedCOs > 0 ? '+' + fmt(totalApprovedCOs) : '—'}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', color: TEXT }}>{fmt(totalRevised)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', color: '#4a9de8' }}>{fmt(totalCommitted)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', color: '#f97316' }}>{fmt(totalActual)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', color: DIM }}>{fmtPct(totalActual, totalRevised)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', color: totalVariance >= 0 ? '#3dd68c' : '#ff7070', fontWeight: 800 }}>{(totalVariance >= 0 ? '+' : '') + fmt(totalVariance)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        )}
      </div>
      {menuId && <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={() => setMenuId(null)} />}
    </div>
  );
}
