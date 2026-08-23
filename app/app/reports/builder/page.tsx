'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { humanError } from '@/lib/errors';
import { PageWrap, SectionHeader, Card, CardHeader, CardBody, Btn, Badge, T } from '@/components/ui/shell';
import { PdfIcon, XlsIcon, CsvIcon, FileButton } from '@/components/ui/FileTypeIcon';
import {
  REPORT_ENTITIES,
  ENTITY_MAP,
  FILTER_OPS,
  type ColType,
} from '@/lib/report-entities';

// ── Local types ────────────────────────────────────────────────
interface FilterRow {
  field: string;
  op: string;
  value: string;
}
interface RunColumn {
  key: string;
  label: string;
  type: ColType;
}
interface SavedReport {
  id: string;
  name: string;
  entity: string;
  config: ReportConfig;
  updated_at?: string;
}
interface ReportConfig {
  columns: string[];
  filters: FilterRow[];
  groupBy: string | null;
  sort: { field: string; dir: 'asc' | 'desc' };
  limit: number;
}
interface RunResult {
  columns: RunColumn[];
  rows: Record<string, unknown>[];
  groupBy: string | null;
  rowCount: number;
}

// ── Value-less operators (no value input) ──────────────────────
const NO_VALUE_OPS = new Set(['is_null', 'not_null']);

// ── Formatting helpers ──────────────────────────────────────────
function fmtCell(value: unknown, type: ColType): string {
  if (value === null || value === undefined || value === '') return '—';
  switch (type) {
    case 'currency': {
      const n = Number(value);
      return Number.isNaN(n) ? String(value) : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
    }
    case 'percent': {
      const n = Number(value);
      return Number.isNaN(n) ? String(value) : `${n}%`;
    }
    case 'number': {
      const n = Number(value);
      return Number.isNaN(n) ? String(value) : n.toLocaleString('en-US');
    }
    case 'date': {
      const s = String(value);
      // date-only strings: show as-is (avoid TZ shifting); timestamps → local date
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      const d = new Date(s);
      return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('en-US');
    }
    case 'bool':
      return value === true || value === 'true' ? 'Yes' : 'No';
    default:
      return String(value);
  }
}

// Trigger a browser download for a served export blob.
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const badgeColorFor = (v: string): 'gold' | 'green' | 'red' | 'amber' | 'blue' | 'muted' => {
  const s = v.toLowerCase();
  if (/(approved|complete|closed|answered|resolved|done|paid|certified)/.test(s)) return 'green';
  if (/(open|pending|draft|new|submitted|in.?progress|review)/.test(s)) return 'blue';
  if (/(overdue|rejected|void|failed|expired|disputed)/.test(s)) return 'red';
  if (/(urgent|high|hold|revise)/.test(s)) return 'amber';
  return 'muted';
};

// ── Small styled form inputs (consistent with shell tokens) ─────
const inputStyle: React.CSSProperties = {
  background: T.bg,
  color: T.white,
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
};
const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: T.muted,
  marginBottom: 6,
  display: 'block',
};

function Sel({ value, onChange, children, style }: { value: string; onChange: (v: string) => void; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, cursor: 'pointer', ...style }}>
      {children}
    </select>
  );
}

// ─────────────────────────────────────────────────────────────────
export default function ReportBuilderPage() {
  const [entityKey, setEntityKey] = useState<string>(REPORT_ENTITIES[0].key);
  const entity = ENTITY_MAP[entityKey];

  const [selectedCols, setSelectedCols] = useState<string[]>(() => REPORT_ENTITIES[0].columns.slice(0, 6).map((c) => c.key));
  const [filters, setFilters] = useState<FilterRow[]>([]);
  const [groupBy, setGroupBy] = useState<string>('');
  const [sortField, setSortField] = useState<string>(REPORT_ENTITIES[0].defaultSort);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [limit, setLimit] = useState<number>(100);

  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<RunResult | null>(null);

  const [saved, setSaved] = useState<SavedReport[]>([]);
  const [reportName, setReportName] = useState('');
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset column/sort selection whenever the entity changes.
  const applyEntityDefaults = useCallback((key: string) => {
    const e = ENTITY_MAP[key];
    setSelectedCols(e.columns.slice(0, 6).map((c) => c.key));
    setFilters([]);
    setGroupBy('');
    setSortField(e.defaultSort);
    setSortDir('desc');
    setResult(null);
    setError('');
  }, []);

  const onEntityChange = (key: string) => {
    setEntityKey(key);
    setLoadedId(null);
    setReportName('');
    applyEntityDefaults(key);
  };

  // ── Load saved reports ──
  const loadSaved = useCallback(async () => {
    try {
      const r = await fetch('/api/reports/saved');
      const j = await r.json();
      setSaved(Array.isArray(j.reports) ? j.reports : []);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => { loadSaved(); }, [loadSaved]);

  // ── Column toggling ──
  const toggleCol = (key: string) => {
    setSelectedCols((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  // ── Filters ──
  const addFilter = () => setFilters((f) => [...f, { field: entity.columns[0].key, op: 'eq', value: '' }]);
  const updateFilter = (i: number, patch: Partial<FilterRow>) =>
    setFilters((f) => f.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const removeFilter = (i: number) => setFilters((f) => f.filter((_, idx) => idx !== i));

  // ── Run ──
  const currentConfig = useCallback((): ReportConfig => ({
    columns: selectedCols,
    filters,
    groupBy: groupBy || null,
    sort: { field: sortField, dir: sortDir },
    limit,
  }), [selectedCols, filters, groupBy, sortField, sortDir, limit]);

  const run = useCallback(async () => {
    if (selectedCols.length === 0) { setError('Pick at least one column.'); return; }
    setRunning(true);
    setError('');
    try {
      const r = await fetch('/api/reports/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity: entityKey,
          columns: selectedCols,
          filters: filters.filter((f) => f.field && f.op),
          groupBy: groupBy || null,
          sort: { field: sortField, dir: sortDir },
          limit,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Report failed');
      setResult({ columns: j.columns, rows: j.rows, groupBy: j.groupBy, rowCount: j.rowCount });
    } catch (e: unknown) {
      console.error(e); setError(humanError(e, 'Report failed. Please try again.'));
      setResult(null);
    } finally {
      setRunning(false);
    }
  }, [entityKey, selectedCols, filters, groupBy, sortField, sortDir, limit]);

  // ── Grouped rows for display ──
  const grouped = useMemo(() => {
    if (!result) return null;
    if (!result.groupBy) return [{ key: '', rows: result.rows }];
    const gb = result.groupBy;
    const map = new Map<string, Record<string, unknown>[]>();
    for (const row of result.rows) {
      const k = row[gb] === null || row[gb] === undefined || row[gb] === '' ? '(none)' : String(row[gb]);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(row);
    }
    return Array.from(map.entries()).map(([key, rows]) => ({ key, rows }));
  }, [result]);

  const currencyCols = useMemo(() => (result ? result.columns.filter((c) => c.type === 'currency') : []), [result]);

  // ── Downloads: server-built, tenant-branded PDF / Excel / CSV ──
  // All three formats run through /api/reports/export so every file carries the
  // tenant's letterhead (PDF), typed money columns, and a real totals row.
  const [exporting, setExporting] = useState<'' | 'csv' | 'xlsx' | 'pdf'>('');
  const exportAs = useCallback(async (format: 'csv' | 'xlsx' | 'pdf') => {
    if (!result || exporting) return;
    setExporting(format);
    setError('');
    try {
      const title = reportName || `${entity.label} Report`;
      const r = await fetch('/api/reports/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format,
          title,
          // 'bool' has no export peer — ship it as text.
          columns: result.columns.map((c) => ({ key: c.key, label: c.label, type: c.type === 'bool' ? 'text' : c.type })),
          rows: result.rows,
        }),
      });
      if (!r.ok) throw new Error('Export failed');
      const blob = await r.blob();
      const base = `${title.replace(/[^\w.-]+/g, '_')}_${new Date().toISOString().slice(0, 10)}`;
      downloadBlob(blob, `${base}.${format === 'xlsx' ? 'xlsx' : format}`);
    } catch (e: unknown) {
      console.error(e); setError(humanError(e, 'Export failed. Please try again.'));
    } finally {
      setExporting('');
    }
  }, [result, exporting, reportName, entity.label]);

  // ── Save / Load / Delete ──
  const saveReport = async () => {
    const name = reportName.trim();
    if (!name) { setError('Enter a report name to save.'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = { name, entity: entityKey, config: currentConfig() };
      const url = loadedId ? `/api/reports/saved/${loadedId}` : '/api/reports/saved';
      const method = loadedId ? 'PUT' : 'POST';
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Save failed');
      if (j.report?.id) setLoadedId(j.report.id);
      await loadSaved();
    } catch (e: unknown) {
      console.error(e); setError(humanError(e, 'Save failed. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const loadReport = (rep: SavedReport) => {
    if (!ENTITY_MAP[rep.entity]) return;
    const cfg = rep.config || ({} as ReportConfig);
    setEntityKey(rep.entity);
    const e = ENTITY_MAP[rep.entity];
    const validCols = (cfg.columns || []).filter((k) => e.columns.some((c) => c.key === k));
    setSelectedCols(validCols.length ? validCols : e.columns.slice(0, 6).map((c) => c.key));
    setFilters(Array.isArray(cfg.filters) ? cfg.filters : []);
    setGroupBy(cfg.groupBy || '');
    setSortField(cfg.sort?.field && e.columns.some((c) => c.key === cfg.sort.field) ? cfg.sort.field : e.defaultSort);
    setSortDir(cfg.sort?.dir === 'asc' ? 'asc' : 'desc');
    setLimit(typeof cfg.limit === 'number' ? cfg.limit : 100);
    setReportName(rep.name);
    setLoadedId(rep.id);
    setResult(null);
    setError('');
  };

  const deleteReport = async (id: string) => {
    try {
      await fetch(`/api/reports/saved/${id}`, { method: 'DELETE' });
      if (loadedId === id) { setLoadedId(null); setReportName(''); }
      await loadSaved();
    } catch { /* ignore */ }
  };

  return (
    <PageWrap>
      <style>{`
        @media print {
          body { background: #fff !important; }
          .rb-noprint { display: none !important; }
          .rb-print-area, .rb-print-area * { color: #000 !important; }
          .rb-print-area { box-shadow: none !important; background: #fff !important; }
          .rb-print-area table { border-collapse: collapse; width: 100%; }
          .rb-print-area th, .rb-print-area td { border: 1px solid #999 !important; padding: 6px 8px !important; font-size: 11px; }
        }
      `}</style>

      <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>
        <div className="rb-noprint">
          <SectionHeader
            title="Custom Report Builder"
            sub="Build an ad-hoc report over your project data — pick a source, choose columns, filter, group, sort, then run, export or save."
          />
        </div>

        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* ── Left: builder controls ── */}
          <div className="rb-noprint" style={{ flex: '1 1 380px', minWidth: 320, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Source + options */}
            <Card>
              <CardHeader><span style={{ fontWeight: 700, color: T.white }}>1 · Source</span></CardHeader>
              <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Entity</label>
                  <Sel value={entityKey} onChange={onEntityChange} style={{ width: '100%' }}>
                    {REPORT_ENTITIES.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
                  </Sel>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 130 }}>
                    <label style={labelStyle}>Sort by</label>
                    <Sel value={sortField} onChange={setSortField} style={{ width: '100%' }}>
                      {entity.columns.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </Sel>
                  </div>
                  <div style={{ width: 110 }}>
                    <label style={labelStyle}>Direction</label>
                    <Sel value={sortDir} onChange={(v) => setSortDir(v as 'asc' | 'desc')} style={{ width: '100%' }}>
                      <option value="desc">Desc</option>
                      <option value="asc">Asc</option>
                    </Sel>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 130 }}>
                    <label style={labelStyle}>Group by</label>
                    <Sel value={groupBy} onChange={setGroupBy} style={{ width: '100%' }}>
                      <option value="">(none)</option>
                      {entity.columns.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </Sel>
                  </div>
                  <div style={{ width: 110 }}>
                    <label style={labelStyle}>Row limit</label>
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={limit}
                      onChange={(e) => setLimit(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))}
                      style={{ ...inputStyle, width: '100%' }}
                    />
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Columns */}
            <Card>
              <CardHeader style={{ justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, color: T.white }}>2 · Columns</span>
                <span style={{ fontSize: 12, color: T.faint }}>{selectedCols.length} selected</span>
              </CardHeader>
              <CardBody style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
                {entity.columns.map((c) => {
                  const on = selectedCols.includes(c.key);
                  return (
                    <label
                      key={c.key}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                        padding: '7px 10px', borderRadius: 8,
                        border: `1px solid ${on ? T.borderGold : T.border}`,
                        background: on ? T.goldDim : 'transparent',
                        fontSize: 13, color: T.white,
                      }}
                    >
                      <input type="checkbox" checked={on} onChange={() => toggleCol(c.key)} style={{ accentColor: T.gold }} />
                      {c.label}
                    </label>
                  );
                })}
              </CardBody>
            </Card>

            {/* Filters */}
            <Card>
              <CardHeader style={{ justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, color: T.white }}>3 · Filters</span>
                <Btn size="sm" variant="ghost" onClick={addFilter}>+ Add filter</Btn>
              </CardHeader>
              <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filters.length === 0 && <div style={{ fontSize: 13, color: T.faint }}>No filters — all rows for your tenant.</div>}
                {filters.map((f, i) => {
                  const noVal = NO_VALUE_OPS.has(f.op);
                  return (
                    <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Sel value={f.field} onChange={(v) => updateFilter(i, { field: v })} style={{ flex: '1 1 120px', minWidth: 110 }}>
                        {entity.columns.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                      </Sel>
                      <Sel value={f.op} onChange={(v) => updateFilter(i, { op: v })} style={{ flex: '0 1 140px' }}>
                        {FILTER_OPS.map((o) => <option key={o.op} value={o.op}>{o.label}</option>)}
                      </Sel>
                      {!noVal && (
                        <input
                          value={f.value}
                          onChange={(e) => updateFilter(i, { value: e.target.value })}
                          placeholder="value"
                          style={{ ...inputStyle, flex: '1 1 100px', minWidth: 80 }}
                        />
                      )}
                      <button
                        onClick={() => removeFilter(i)}
                        title="Remove"
                        style={{ background: T.redDim, color: T.red, border: `1px solid rgba(255,59,48,0.3)`, borderRadius: 8, width: 30, height: 32, cursor: 'pointer', fontSize: 15, flexShrink: 0 }}
                      >×</button>
                    </div>
                  );
                })}
              </CardBody>
            </Card>

            {/* Run */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Btn onClick={run} disabled={running} style={{ flex: 1 }}>{running ? 'Running…' : 'Run Report'}</Btn>
            </div>
            {error && <div style={{ color: T.red, fontSize: 13 }}>{error}</div>}

            {/* Save / Load */}
            <Card>
              <CardHeader><span style={{ fontWeight: 700, color: T.white }}>Saved Reports</span></CardHeader>
              <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    value={reportName}
                    onChange={(e) => setReportName(e.target.value)}
                    placeholder="Report name"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <Btn size="sm" onClick={saveReport} disabled={saving}>{saving ? 'Saving…' : loadedId ? 'Update' : 'Save'}</Btn>
                </div>
                {loadedId && <div style={{ fontSize: 11, color: T.faint }}>Editing a saved report — Update overwrites it.</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {saved.length === 0 && <div style={{ fontSize: 13, color: T.faint }}>Nothing saved yet.</div>}
                  {saved.map((rep) => (
                    <div
                      key={rep.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8,
                        border: `1px solid ${loadedId === rep.id ? T.borderGold : T.border}`,
                        background: loadedId === rep.id ? T.goldDim : 'transparent',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.white, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rep.name}</div>
                        <div style={{ fontSize: 11, color: T.faint }}>{ENTITY_MAP[rep.entity]?.label || rep.entity}</div>
                      </div>
                      <Btn size="sm" variant="ghost" onClick={() => loadReport(rep)}>Load</Btn>
                      <button
                        onClick={() => deleteReport(rep.id)}
                        title="Delete"
                        style={{ background: 'transparent', color: T.faint, border: `1px solid ${T.border}`, borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontSize: 14, flexShrink: 0 }}
                      >×</button>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>

          {/* ── Right: results ── */}
          <div style={{ flex: '2 1 560px', minWidth: 340 }}>
            <Card>
              <CardHeader style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <span style={{ fontWeight: 700, color: T.white }}>{reportName || `${entity.label} Report`}</span>
                  {result && <span style={{ marginLeft: 10, fontSize: 12, color: T.faint }}>{result.rowCount} row{result.rowCount === 1 ? '' : 's'}</span>}
                </div>
                <div className="rb-noprint" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <FileButton icon={<PdfIcon size={16} />} label={exporting === 'pdf' ? 'Building…' : 'PDF'} onClick={() => exportAs('pdf')} disabled={!result || result.rowCount === 0 || !!exporting} title="Branded corporate PDF — letterhead, KPI band, totals" />
                  <FileButton icon={<XlsIcon size={16} />} label={exporting === 'xlsx' ? 'Building…' : 'Excel'} onClick={() => exportAs('xlsx')} disabled={!result || result.rowCount === 0 || !!exporting} title="Excel workbook (.xlsx) with typed money columns and totals" />
                  <FileButton icon={<CsvIcon size={16} />} label={exporting === 'csv' ? 'Building…' : 'CSV'} onClick={() => exportAs('csv')} disabled={!result || result.rowCount === 0 || !!exporting} title="Plain CSV (.csv) for any spreadsheet tool" />
                  <Btn size="sm" variant="ghost" onClick={() => window.print()} disabled={!result}>Print</Btn>
                </div>
              </CardHeader>
              <CardBody style={{ padding: 0 }}>
                <div className="rb-print-area" style={{ overflowX: 'auto', maxHeight: 640, overflowY: 'auto' }}>
                  {!result && (
                    <div style={{ padding: '56px 20px', textAlign: 'center', color: T.faint, fontSize: 14 }}>
                      Configure your report on the left, then press <strong style={{ color: T.muted }}>Run Report</strong>.
                    </div>
                  )}
                  {result && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr>
                          {result.columns.map((c) => (
                            <th key={c.key} style={{
                              padding: '10px 12px', textAlign: c.type === 'currency' || c.type === 'number' || c.type === 'percent' ? 'right' : 'left',
                              color: T.muted, fontWeight: 600, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
                              borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap', position: 'sticky', top: 0, background: T.surface2,
                            }}>{c.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(grouped || []).map((g) => (
                          <React.Fragment key={g.key || '_all'}>
                            {result.groupBy && (
                              <tr>
                                <td colSpan={result.columns.length} style={{ padding: '8px 12px', background: T.goldDim, color: T.gold, fontWeight: 700, fontSize: 12, letterSpacing: '0.04em', borderBottom: `1px solid ${T.border}` }}>
                                  {ENTITY_MAP[entityKey]?.columns.find((c) => c.key === result.groupBy)?.label || result.groupBy}: {g.key} · {g.rows.length}
                                </td>
                              </tr>
                            )}
                            {g.rows.map((row, ri) => (
                              <tr key={(row.id as string) || ri} style={{ borderBottom: `1px solid ${T.borderSubtle}` }}>
                                {result.columns.map((c) => (
                                  <td key={c.key} style={{
                                    padding: '9px 12px', color: T.white, verticalAlign: 'middle',
                                    textAlign: c.type === 'currency' || c.type === 'number' || c.type === 'percent' ? 'right' : 'left',
                                    fontVariantNumeric: c.type === 'currency' || c.type === 'number' ? 'tabular-nums' : undefined,
                                  }}>
                                    {c.type === 'badge' && row[c.key]
                                      ? <Badge label={String(row[c.key])} color={badgeColorFor(String(row[c.key]))} />
                                      : fmtCell(row[c.key], c.type)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                            {result.groupBy && currencyCols.length > 0 && (
                              <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                                {result.columns.map((c, ci) => {
                                  if (ci === 0) return <td key={c.key} style={{ padding: '8px 12px', color: T.faint, fontSize: 11, fontWeight: 700 }}>Subtotal</td>;
                                  if (c.type === 'currency') {
                                    const sum = g.rows.reduce((acc, r) => acc + (Number(r[c.key]) || 0), 0);
                                    return <td key={c.key} style={{ padding: '8px 12px', textAlign: 'right', color: T.gold, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtCell(sum, 'currency')}</td>;
                                  }
                                  return <td key={c.key} />;
                                })}
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                        {result.rowCount === 0 && (
                          <tr><td colSpan={result.columns.length} style={{ padding: '40px 12px', textAlign: 'center', color: T.faint }}>No rows match.</td></tr>
                        )}
                      </tbody>
                      {currencyCols.length > 0 && result.rowCount > 0 && (
                        <tfoot>
                          <tr style={{ borderTop: `2px solid ${T.border}` }}>
                            {result.columns.map((c, ci) => {
                              if (ci === 0) return <td key={c.key} style={{ padding: '10px 12px', color: T.white, fontWeight: 700 }}>Total</td>;
                              if (c.type === 'currency') {
                                const sum = result.rows.reduce((acc, r) => acc + (Number(r[c.key]) || 0), 0);
                                return <td key={c.key} style={{ padding: '10px 12px', textAlign: 'right', color: T.gold, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmtCell(sum, 'currency')}</td>;
                              }
                              return <td key={c.key} />;
                            })}
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  )}
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </PageWrap>
  );
}
