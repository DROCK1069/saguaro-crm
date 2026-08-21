'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { humanError } from '@/lib/errors';
import { Buildings, CurrencyDollar, CalendarBlank, HardHat, Table, ChartBar, ChartLineUp, ChartLine, ChartPie, CheckCircle, Plus, Lightning, Files, FileDashed, WarningCircle } from '@phosphor-icons/react';
import { PremiumSurface, ModuleHero, SectionCard, PremiumEmpty, goldButtonStyle } from '@/components/ui/premium';

/* ─── Colors ────────────────────────────────────────────────────────── */
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

/* ─── Types ─────────────────────────────────────────────────────────── */
type ReportType = 'table' | 'chart' | 'summary';
type ChartKind = 'bar' | 'line' | 'pie';
type ModuleKey = 'projects' | 'budget' | 'schedule' | 'safety';
type Frequency = 'daily' | 'weekly' | 'monthly';
type FilterField = 'dateRange' | 'project' | 'status' | 'assignee' | 'priority';
type FilterOp = 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'between';

interface FilterRule {
  id: string;
  field: FilterField;
  operator: FilterOp;
  value: string;
  value2?: string;
}

interface ColumnDef {
  key: string;
  label: string;
  enabled: boolean;
}

interface ScheduleConfig {
  enabled: boolean;
  frequency: Frequency;
  recipients: string[];
  nextRun?: string;
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: ReportType;
  chartKind?: ChartKind;
  modules: ModuleKey[];
  columns: ColumnDef[];
  filters: FilterRule[];
  schedule: ScheduleConfig;
  preset?: string;
  createdAt: string;
  updatedAt: string;
}

type WizardStep = 'type' | 'modules' | 'columns' | 'filters' | 'chart' | 'schedule' | 'preview';

/* ─── Preset Definitions ────────────────────────────────────────────── */
const PRESETS: {
  key: string; name: string; description: string;
  type: ReportType; chartKind?: ChartKind; modules: ModuleKey[];
  columns: ColumnDef[];
}[] = [
  {
    key: 'project-status',
    name: 'Project Status',
    description: 'Overview of all project statuses and health',
    type: 'table',
    modules: ['projects'],
    columns: [
      { key: 'name', label: 'Project Name', enabled: true },
      { key: 'status', label: 'Status', enabled: true },
      { key: 'health', label: 'Health', enabled: true },
      { key: 'owner', label: 'Owner', enabled: true },
      { key: 'startDate', label: 'Start Date', enabled: true },
      { key: 'endDate', label: 'End Date', enabled: true },
      { key: 'completion', label: '% Complete', enabled: true },
    ],
  },
  {
    key: 'budget-summary',
    name: 'Budget Summary',
    description: 'Financial overview across projects',
    type: 'chart',
    chartKind: 'bar',
    modules: ['budget'],
    columns: [
      { key: 'project', label: 'Project', enabled: true },
      { key: 'budgeted', label: 'Budgeted', enabled: true },
      { key: 'actual', label: 'Actual Spend', enabled: true },
      { key: 'variance', label: 'Variance', enabled: true },
      { key: 'remaining', label: 'Remaining', enabled: true },
      { key: 'percentUsed', label: '% Used', enabled: true },
    ],
  },
  {
    key: 'safety-metrics',
    name: 'Safety Metrics',
    description: 'Safety incidents, near-misses, and compliance',
    type: 'summary',
    modules: ['safety'],
    columns: [
      { key: 'site', label: 'Site', enabled: true },
      { key: 'incidents', label: 'Incidents', enabled: true },
      { key: 'nearMisses', label: 'Near Misses', enabled: true },
      { key: 'inspections', label: 'Inspections', enabled: true },
      { key: 'complianceRate', label: 'Compliance %', enabled: true },
      { key: 'lastInspection', label: 'Last Inspection', enabled: true },
    ],
  },
  {
    key: 'schedule-variance',
    name: 'Schedule Variance',
    description: 'Tasks ahead or behind schedule',
    type: 'chart',
    chartKind: 'line',
    modules: ['schedule'],
    columns: [
      { key: 'task', label: 'Task', enabled: true },
      { key: 'planned', label: 'Planned Date', enabled: true },
      { key: 'actual', label: 'Actual Date', enabled: true },
      { key: 'varianceDays', label: 'Variance (days)', enabled: true },
      { key: 'status', label: 'Status', enabled: true },
      { key: 'critical', label: 'Critical Path', enabled: true },
    ],
  },
];

/* ─── Module Options ────────────────────────────────────────────────── */
const MODULE_OPTIONS: { key: ModuleKey; label: string; icon: React.ReactNode }[] = [
  { key: 'projects', label: 'Projects', icon: <Buildings size={28} weight="regular" color={TEXT} /> },
  { key: 'budget', label: 'Budget & Finance', icon: <CurrencyDollar size={28} weight="regular" color={TEXT} /> },
  { key: 'schedule', label: 'Schedule & Tasks', icon: <CalendarBlank size={28} weight="regular" color={TEXT} /> },
  { key: 'safety', label: 'Safety & Compliance', icon: <HardHat size={28} weight="regular" color={TEXT} /> },
];

/* ─── Columns per Module ────────────────────────────────────────────── */
const ALL_COLUMNS: Record<ModuleKey, ColumnDef[]> = {
  projects: [
    { key: 'name', label: 'Project Name', enabled: true },
    { key: 'status', label: 'Status', enabled: true },
    { key: 'health', label: 'Health', enabled: true },
    { key: 'owner', label: 'Owner', enabled: false },
    { key: 'startDate', label: 'Start Date', enabled: false },
    { key: 'endDate', label: 'End Date', enabled: false },
    { key: 'completion', label: '% Complete', enabled: true },
    { key: 'location', label: 'Location', enabled: false },
  ],
  budget: [
    { key: 'project', label: 'Project', enabled: true },
    { key: 'budgeted', label: 'Budgeted', enabled: true },
    { key: 'actual', label: 'Actual Spend', enabled: true },
    { key: 'variance', label: 'Variance', enabled: true },
    { key: 'remaining', label: 'Remaining', enabled: false },
    { key: 'percentUsed', label: '% Used', enabled: true },
    { key: 'costCode', label: 'Cost Code', enabled: false },
  ],
  schedule: [
    { key: 'task', label: 'Task', enabled: true },
    { key: 'planned', label: 'Planned Date', enabled: true },
    { key: 'actualDate', label: 'Actual Date', enabled: true },
    { key: 'varianceDays', label: 'Variance (days)', enabled: true },
    { key: 'taskStatus', label: 'Status', enabled: true },
    { key: 'critical', label: 'Critical Path', enabled: false },
    { key: 'assignee', label: 'Assignee', enabled: false },
  ],
  safety: [
    { key: 'site', label: 'Site', enabled: true },
    { key: 'incidents', label: 'Incidents', enabled: true },
    { key: 'nearMisses', label: 'Near Misses', enabled: true },
    { key: 'inspections', label: 'Inspections', enabled: false },
    { key: 'complianceRate', label: 'Compliance %', enabled: true },
    { key: 'lastInspection', label: 'Last Inspection', enabled: false },
    { key: 'severity', label: 'Severity', enabled: false },
  ],
};

/* ─── Filter Config ─────────────────────────────────────────────────── */
const FILTER_FIELDS: { key: FilterField; label: string }[] = [
  { key: 'dateRange', label: 'Date Range' },
  { key: 'project', label: 'Project' },
  { key: 'status', label: 'Status' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'priority', label: 'Priority' },
];

const FILTER_OPS: { key: FilterOp; label: string }[] = [
  { key: 'equals', label: 'Equals' },
  { key: 'contains', label: 'Contains' },
  { key: 'greaterThan', label: 'Greater Than' },
  { key: 'lessThan', label: 'Less Than' },
  { key: 'between', label: 'Between' },
];

/* ─── Mock Data Generator ───────────────────────────────────────────── */
function generateMockData(columns: ColumnDef[]): Record<string, string>[] {
  const pool: Record<string, string[]> = {
    name: ['Downtown Office Tower', 'Riverside Apartments', 'Highway Bridge Rehab', 'School Renovation', 'Medical Center'],
    project: ['Downtown Office Tower', 'Riverside Apartments', 'Highway Bridge Rehab', 'School Renovation', 'Medical Center'],
    status: ['Active', 'On Hold', 'Complete', 'Active', 'Planning'],
    health: ['Green', 'Yellow', 'Green', 'Red', 'Green'],
    owner: ['J. Smith', 'A. Garcia', 'M. Chen', 'R. Patel', 'S. Williams'],
    startDate: ['2025-01-15', '2025-03-01', '2025-06-10', '2025-02-20', '2025-08-01'],
    endDate: ['2026-06-30', '2026-09-15', '2026-12-01', '2026-04-30', '2027-01-15'],
    completion: ['45%', '28%', '72%', '15%', '8%'],
    location: ['Phoenix, AZ', 'Scottsdale, AZ', 'Tempe, AZ', 'Mesa, AZ', 'Chandler, AZ'],
    budgeted: ['$2,450,000', '$1,800,000', '$3,200,000', '$950,000', '$5,100,000'],
    actual: ['$1,102,500', '$612,000', '$2,176,000', '$190,000', '$408,000'],
    variance: ['-$50,000', '+$36,000', '-$128,000', '+$12,500', '-$8,000'],
    remaining: ['$1,347,500', '$1,188,000', '$1,024,000', '$760,000', '$4,692,000'],
    percentUsed: ['45%', '34%', '68%', '20%', '8%'],
    costCode: ['01-100', '01-200', '02-100', '01-150', '03-100'],
    task: ['Foundation Pour', 'Framing Phase 2', 'Electrical Rough-In', 'HVAC Install', 'Final Inspection'],
    planned: ['2025-11-01', '2025-12-15', '2026-01-10', '2026-02-01', '2026-03-15'],
    actualDate: ['2025-11-03', '2025-12-20', '---', '---', '---'],
    varianceDays: ['+2', '+5', '---', '---', '---'],
    taskStatus: ['Complete', 'Complete', 'In Progress', 'Not Started', 'Not Started'],
    critical: ['Yes', 'Yes', 'No', 'Yes', 'No'],
    assignee: ['Team Alpha', 'Team Bravo', 'Team Charlie', 'Team Alpha', 'Team Delta'],
    site: ['Site A - Downtown', 'Site B - Riverside', 'Site C - Highway', 'Site D - School', 'Site E - Medical'],
    incidents: ['0', '1', '0', '2', '0'],
    nearMisses: ['3', '1', '5', '2', '0'],
    inspections: ['12', '8', '15', '6', '4'],
    complianceRate: ['98%', '94%', '100%', '87%', '96%'],
    lastInspection: ['2026-03-10', '2026-03-08', '2026-03-12', '2026-03-05', '2026-03-11'],
    severity: ['N/A', 'Minor', 'N/A', 'Moderate', 'N/A'],
    priority: ['High', 'Medium', 'High', 'Low', 'Medium'],
  };
  const enabled = columns.filter(c => c.enabled);
  const rows: Record<string, string>[] = [];
  for (let i = 0; i < 5; i++) {
    const row: Record<string, string> = {};
    enabled.forEach(col => {
      const vals = pool[col.key] || ['---', '---', '---', '---', '---'];
      row[col.key] = vals[i % vals.length];
    });
    rows.push(row);
  }
  return rows;
}

/* ─── Sample-data notice ─────────────────────────────────────────────
   The builder previews render illustrative placeholder rows/charts so you can
   see the report's SHAPE before running it. Real, tenant-scoped values are
   populated only when you export or run the saved report (via
   /api/reports/[id]/export → the live report engines). We label the preview
   honestly so the placeholders are never mistaken for your actual data. */
function SampleDataNote() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        margin: '0 0 14px',
        padding: '8px 12px',
        background: `${AMBER}14`,
        border: `1px solid ${AMBER}44`,
        borderRadius: 8,
        fontSize: 12,
        color: AMBER,
        fontWeight: 600,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          background: AMBER,
          color: '#1C1C1E',
          padding: '2px 7px',
          borderRadius: 4,
        }}
      >
        Sample
      </span>
      <span>
        Layout preview with placeholder data — real values populate when you
        export or run this report.
      </span>
    </div>
  );
}

/* ─── Chart Sample Data ─────────────────────────────────────────────── */
const CHART_DATA = [
  { label: 'Jan', value: 42 },
  { label: 'Feb', value: 58 },
  { label: 'Mar', value: 35 },
  { label: 'Apr', value: 71 },
  { label: 'May', value: 63 },
  { label: 'Jun', value: 89 },
];

const PIE_DATA = [
  { label: 'Active', value: 45, color: GREEN },
  { label: 'On Hold', value: 20, color: AMBER },
  { label: 'Complete', value: 25, color: BLUE },
  { label: 'Planning', value: 10, color: PURPLE },
];

/* ═══ Inline SVG Chart Components ═══════════════════════════════════ */
function BarChart({
  data,
  width = 460,
  height = 220,
}: {
  data: { label: string; value: number }[];
  width?: number;
  height?: number;
}) {
  const max = Math.max(...data.map(d => d.value));
  const barW = (width - 60) / data.length - 8;
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <line x1={46} y1={0} x2={46} y2={height - 28} stroke={BORDER} strokeWidth={1} />
      <line x1={46} y1={height - 28} x2={width} y2={height - 28} stroke={BORDER} strokeWidth={1} />
      {data.map((d, i) => {
        const barH = (d.value / max) * (height - 50);
        const x = 50 + i * (barW + 8);
        const y = height - 30 - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} fill={GOLD} rx={3} />
            <text x={x + barW / 2} y={height - 12} textAnchor="middle" fill={DIM} fontSize={11}>
              {d.label}
            </text>
            <text x={x + barW / 2} y={y - 6} textAnchor="middle" fill={TEXT} fontSize={10}>
              {d.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function LineChart({
  data,
  width = 460,
  height = 220,
}: {
  data: { label: string; value: number }[];
  width?: number;
  height?: number;
}) {
  const max = Math.max(...data.map(d => d.value));
  const pts = data.map((d, i) => {
    const x = 50 + i * ((width - 70) / (data.length - 1));
    const y = height - 30 - (d.value / max) * (height - 50);
    return { x, y, ...d };
  });
  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <line x1={46} y1={0} x2={46} y2={height - 28} stroke={BORDER} strokeWidth={1} />
      <line x1={46} y1={height - 28} x2={width} y2={height - 28} stroke={BORDER} strokeWidth={1} />
      <polyline
        points={polyline}
        fill="none"
        stroke={GOLD}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={4} fill={RAISED} stroke={GOLD} strokeWidth={2} />
          <text x={p.x} y={height - 12} textAnchor="middle" fill={DIM} fontSize={11}>
            {p.label}
          </text>
          <text x={p.x} y={p.y - 10} textAnchor="middle" fill={TEXT} fontSize={10}>
            {p.value}
          </text>
        </g>
      ))}
    </svg>
  );
}

function PieChart({
  data,
  size = 200,
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 10;
  let cumAngle = -Math.PI / 2;
  const slices = data.map(d => {
    const angle = (d.value / total) * 2 * Math.PI;
    const startX = cx + r * Math.cos(cumAngle);
    const startY = cy + r * Math.sin(cumAngle);
    cumAngle += angle;
    const endX = cx + r * Math.cos(cumAngle);
    const endY = cy + r * Math.sin(cumAngle);
    const large = angle > Math.PI ? 1 : 0;
    const path = `M${cx},${cy} L${startX},${startY} A${r},${r} 0 ${large},1 ${endX},${endY} Z`;
    return { ...d, path };
  });
  return (
    <svg width={size + 140} height={size} style={{ display: 'block' }}>
      {slices.map((s, i) => (
        <path key={i} d={s.path} fill={s.color} stroke={BG} strokeWidth={2} />
      ))}
      {data.map((d, i) => (
        <g key={`legend-${i}`}>
          <rect x={size + 8} y={10 + i * 24} width={14} height={14} rx={3} fill={d.color} />
          <text x={size + 28} y={22 + i * 24} fill={TEXT} fontSize={12}>
            {d.label} ({d.value}%)
          </text>
        </g>
      ))}
    </svg>
  );
}

/* ─── Helper: unique ID ─────────────────────────────────────────────── */
function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ─── Default empty template ────────────────────────────────────────── */
function emptyTemplate(): Omit<ReportTemplate, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: '',
    description: '',
    type: 'table',
    modules: [],
    columns: [],
    filters: [],
    schedule: { enabled: false, frequency: 'weekly', recipients: [] },
  };
}

/* ════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════════ */
export default function ReportsBuilderPage() {
  /* ── core state ── */
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  /* ── wizard state ── */
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>('type');
  const [draft, setDraft] = useState(emptyTemplate());
  const [editId, setEditId] = useState<string | null>(null);

  /* ── modal state ── */
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [scheduleModal, setScheduleModal] = useState<string | null>(null);
  const [recipientInput, setRecipientInput] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  /* ════ DATA LOADING ════════════════════════════════════════════════ */
  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/reports');
      if (!res.ok) throw new Error('Failed to load report templates');
      const data = await res.json();
      setTemplates(Array.isArray(data) ? data : data.reports ?? []);
    } catch {
      /* No fabricated reports — show a real empty list so the customer builds
         their own. (Previously seeded fake "Project Status Report" etc.) */
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  /* ════ TOAST ═══════════════════════════════════════════════════════ */
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  /* ════ SAVE TEMPLATE ══════════════════════════════════════════════ */
  const saveTemplate = async () => {
    if (!draft.name.trim()) {
      showToast('Report name is required');
      return;
    }
    if (draft.modules.length === 0) {
      showToast('Select at least one module');
      return;
    }
    setSaving(true);
    const now = new Date().toISOString().slice(0, 10);
    try {
      if (editId) {
        // Report the real outcome instead of fire-and-forget: a failed PUT used
        // to still toast "updated" while nothing persisted.
        const res = await fetch(`/api/reports/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draft),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          console.error('report update failed', res.status, j.error); showToast(humanError(j.error, 'Could not update the report. Please try again.'));
          return;
        }
        setTemplates(prev =>
          prev.map(t =>
            t.id === editId ? { ...t, ...draft, updatedAt: now } : t,
          ),
        );
        showToast('Report updated successfully');
      } else {
        const res = await fetch('/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...draft, createdAt: now, updatedAt: now }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          console.error('report create failed', res.status, j.error); showToast(humanError(j.error, 'Could not create the report. Please try again.'));
          return;
        }
        // Adopt the REAL server id so an immediate re-edit targets the persisted
        // row (a client uid() would 404 the PUT and drop the change).
        const j = await res.json().catch(() => ({}));
        const saved = (j?.report ?? {}) as Partial<ReportTemplate>;
        const newTemplate: ReportTemplate = {
          ...draft,
          id: saved.id || uid(),
          createdAt: saved.createdAt || now,
          updatedAt: now,
        };
        setTemplates(prev => [...prev, newTemplate]);
        showToast('Report created successfully');
      }
      closeWizard();
    } catch {
      showToast('Save failed — check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  /* ════ DUPLICATE ══════════════════════════════════════════════════ */
  const duplicateTemplate = async (t: ReportTemplate) => {
    const now = new Date().toISOString().slice(0, 10);
    const dup: ReportTemplate = {
      ...t,
      id: uid(),
      name: `${t.name} (Copy)`,
      columns: t.columns.map(c => ({ ...c })),
      filters: t.filters.map(f => ({ ...f, id: uid() })),
      schedule: { ...t.schedule, recipients: [...t.schedule.recipients] },
      createdAt: now,
      updatedAt: now,
    };
    // Persist the copy — this used to be a local-only add that vanished on
    // reload (no route was ever called).
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dup),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        console.error('report duplicate failed', res.status, j.error); showToast(humanError(j.error, 'Could not duplicate the report. Please try again.'));
        return;
      }
      const j = await res.json().catch(() => ({}));
      const saved = (j?.report ?? {}) as Partial<ReportTemplate>;
      setTemplates(prev => [...prev, { ...dup, id: saved.id || dup.id }]);
      showToast('Report duplicated');
    } catch {
      showToast('Could not duplicate report — check your connection.');
    }
  };

  /* ════ DELETE ══════════════════════════════════════════════════════ */
  const deleteTemplate = async (id: string) => {
    await fetch(`/api/reports/${id}`, { method: 'DELETE' }).catch(() => {});
    setTemplates(prev => prev.filter(t => t.id !== id));
    setDeleteConfirm(null);
    showToast('Report deleted');
  };

  /* ════ EXPORT ══════════════════════════════════════════════════════ */
  const handleExport = async (id: string, format: string) => {
    const exportKey = `${id}-${format}`;
    setExporting(exportKey);
    try {
      const res = await fetch(`/api/reports/${id}/export?format=${format}`);
      if (!res.ok) {
        let serverErr = '';
        try { const j = await res.json(); if (j?.error) serverErr = j.error; } catch { /* non-JSON body */ }
        console.error('report export failed', res.status, serverErr);
        showToast(humanError(serverErr, 'Export failed. Please try again.'));
        return;
      }
      // Real download: pull the file bytes and hand them to the browser.
      const blob = await res.blob();
      const cd = res.headers.get('content-disposition') || '';
      const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
      const tpl = templates.find(t => t.id === id);
      const safeBase = (tpl?.name || 'report').replace(/[^\w.-]+/g, '_');
      const filename = m?.[1] ? decodeURIComponent(m[1]) : `${safeBase}.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast(`${format.toUpperCase()} downloaded`);
    } catch {
      showToast('Export failed — check your connection and try again.');
    } finally {
      setExporting(null);
    }
  };

  /* ════ SCHEDULE UPDATE ════════════════════════════════════════════ */
  const updateSchedule = async (id: string, schedule: ScheduleConfig) => {
    await fetch(`/api/reports/${id}/schedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(schedule),
    }).catch(() => {});
    setTemplates(prev =>
      prev.map(t =>
        t.id === id
          ? { ...t, schedule, updatedAt: new Date().toISOString().slice(0, 10) }
          : t,
      ),
    );
    showToast('Schedule updated');
  };

  /* ════ WIZARD HELPERS ═════════════════════════════════════════════ */
  const closeWizard = () => {
    setWizardOpen(false);
    setDraft(emptyTemplate());
    setEditId(null);
    setWizardStep('type');
    setRecipientInput('');
  };

  const openEdit = (t: ReportTemplate) => {
    setDraft({
      name: t.name,
      description: t.description,
      type: t.type,
      chartKind: t.chartKind,
      modules: [...t.modules],
      columns: t.columns.map(c => ({ ...c })),
      filters: t.filters.map(f => ({ ...f })),
      schedule: {
        ...t.schedule,
        recipients: [...t.schedule.recipients],
      },
    });
    setEditId(t.id);
    setWizardStep('type');
    setWizardOpen(true);
  };

  const applyPreset = (p: (typeof PRESETS)[0]) => {
    setDraft(prev => ({
      ...prev,
      name: p.name,
      description: p.description,
      type: p.type,
      chartKind: p.chartKind,
      modules: [...p.modules],
      columns: p.columns.map(c => ({ ...c })),
      preset: p.key,
    }));
    setWizardStep('filters');
  };

  const wizardSteps: WizardStep[] =
    draft.type === 'chart'
      ? ['type', 'modules', 'columns', 'chart', 'filters', 'schedule', 'preview']
      : ['type', 'modules', 'columns', 'filters', 'schedule', 'preview'];
  const stepIdx = wizardSteps.indexOf(wizardStep);

  const canNext = (): boolean => {
    if (wizardStep === 'type') return !!draft.type && draft.name.trim().length > 0;
    if (wizardStep === 'modules') return draft.modules.length > 0;
    if (wizardStep === 'columns') return draft.columns.some(c => c.enabled);
    if (wizardStep === 'chart') return !!draft.chartKind;
    return true;
  };

  const updateModules = (mod: ModuleKey) => {
    setDraft(prev => {
      const has = prev.modules.includes(mod);
      const modules = has
        ? prev.modules.filter(m => m !== mod)
        : [...prev.modules, mod];
      const cols = modules.flatMap(m => ALL_COLUMNS[m]);
      const unique = cols.filter(
        (c, i, a) => a.findIndex(x => x.key === c.key) === i,
      );
      return { ...prev, modules, columns: unique };
    });
  };

  const toggleColumn = (key: string) => {
    setDraft(prev => ({
      ...prev,
      columns: prev.columns.map(c =>
        c.key === key ? { ...c, enabled: !c.enabled } : c,
      ),
    }));
  };

  const addFilter = () => {
    setDraft(prev => ({
      ...prev,
      filters: [
        ...prev.filters,
        { id: uid(), field: 'dateRange', operator: 'equals', value: '' },
      ],
    }));
  };

  const updateFilter = (id: string, patch: Partial<FilterRule>) => {
    setDraft(prev => ({
      ...prev,
      filters: prev.filters.map(f =>
        f.id === id ? { ...f, ...patch } : f,
      ),
    }));
  };

  const removeFilter = (id: string) => {
    setDraft(prev => ({
      ...prev,
      filters: prev.filters.filter(f => f.id !== id),
    }));
  };

  const addRecipientToDraft = () => {
    if (!recipientInput.trim()) return;
    setDraft(p => ({
      ...p,
      schedule: {
        ...p.schedule,
        recipients: [...p.schedule.recipients, recipientInput.trim()],
      },
    }));
    setRecipientInput('');
  };

  const removeRecipientFromDraft = (idx: number) => {
    setDraft(p => ({
      ...p,
      schedule: {
        ...p.schedule,
        recipients: p.schedule.recipients.filter((_, j) => j !== idx),
      },
    }));
  };

  /* ── filtered template list ── */
  const filtered = templates.filter(
    t =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.description.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  /* ── derived modal state ── */
  const schedTpl = scheduleModal
    ? templates.find(t => t.id === scheduleModal)
    : null;
  const previewTpl = previewId
    ? templates.find(t => t.id === previewId)
    : null;

  /* ════════════════════════════════════════════════════════════════════
     STYLES
     ════════════════════════════════════════════════════════════════════ */
  const cardStyle: React.CSSProperties = {
    background: RAISED,
    border: `1px solid ${BORDER}`,
    borderRadius: 10,
    padding: 20,
    marginBottom: 16,
  };
  const btnPrimary: React.CSSProperties = {
    background: GOLD,
    color: '#000',
    border: 'none',
    borderRadius: 6,
    padding: '10px 20px',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: 14,
  };
  const btnSecondary: React.CSSProperties = {
    background: 'transparent',
    color: GOLD,
    border: `1px solid ${GOLD}`,
    borderRadius: 6,
    padding: '8px 16px',
    fontWeight: 500,
    cursor: 'pointer',
    fontSize: 13,
  };
  const btnDanger: React.CSSProperties = {
    background: RED,
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '8px 16px',
    fontWeight: 500,
    cursor: 'pointer',
    fontSize: 13,
  };
  const btnSmall: React.CSSProperties = {
    background: 'transparent',
    color: DIM,
    border: `1px solid ${BORDER}`,
    borderRadius: 5,
    padding: '5px 12px',
    cursor: 'pointer',
    fontSize: 12,
  };
  const inputStyle: React.CSSProperties = {
    background: BG,
    border: `1px solid ${BORDER}`,
    borderRadius: 6,
    padding: '9px 14px',
    color: TEXT,
    fontSize: 14,
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box',
  };
  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
  };
  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  };
  const modalStyle: React.CSSProperties = {
    background: RAISED,
    border: `1px solid ${BORDER}`,
    borderRadius: 12,
    padding: 28,
    width: '90%',
    maxWidth: 760,
    maxHeight: '90vh',
    overflowY: 'auto',
  };
  const badgeStyle = (color: string): React.CSSProperties => ({
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 600,
    background: color + '22',
    color,
    marginRight: 6,
  });
  const tagStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: BLUE + '22',
    color: BLUE,
    padding: '3px 10px',
    borderRadius: 12,
    fontSize: 12,
    marginRight: 6,
    marginBottom: 4,
  };

  /* ════════════════════════════════════════════════════════════════════
     LOADING STATE
     ════════════════════════════════════════════════════════════════════ */
  if (loading) {
    return (
      <PremiumSurface maxWidth={1600}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            justifyContent: 'center',
            marginTop: 120,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              border: `3px solid ${BORDER}`,
              borderTopColor: GOLD,
              borderRadius: '50%',
              animation: 'rpt-spin 0.8s linear infinite',
            }}
          />
          <span style={{ color: DIM, fontSize: 16 }}>
            Loading report templates...
          </span>
        </div>
        <style>{`@keyframes rpt-spin { to { transform: rotate(360deg); } }`}</style>
      </PremiumSurface>
    );
  }

  /* ════════════════════════════════════════════════════════════════════
     ERROR STATE
     ════════════════════════════════════════════════════════════════════ */
  if (error) {
    return (
      <PremiumSurface maxWidth={1600}>
        <SectionCard>
          <PremiumEmpty
            tone="error"
            icon={<WarningCircle size={30} weight="duotone" color={RED} />}
            title={error}
            description="We hit a problem loading your report templates. Your data is safe — try again."
            action={
              <button style={goldButtonStyle} className="pmBtn" onClick={loadTemplates}>
                Retry
              </button>
            }
          />
        </SectionCard>
      </PremiumSurface>
    );
  }

  /* ════════════════════════════════════════════════════════════════════
     MAIN RENDER
     ════════════════════════════════════════════════════════════════════ */
  return (
    <PremiumSurface maxWidth={1600}>
      {/* ── Toast Notification ── */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 24,
            right: 24,
            background: GREEN + 'DD',
            color: '#fff',
            padding: '12px 24px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            zIndex: 2000,
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          }}
        >
          {toast}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
         HEADER
         ══════════════════════════════════════════════════════════════ */}
      <ModuleHero
        eyebrow="REPORTS"
        eyebrowIcon={<ChartLineUp size={13} weight="fill" color={GOLD} />}
        title="Reports"
        accent="Builder"
        subtitle="Create, schedule, and manage custom reports"
        actions={
          <button
            style={goldButtonStyle}
            className="pmBtn"
            onClick={() => {
              setDraft(emptyTemplate());
              setEditId(null);
              setWizardStep('type');
              setWizardOpen(true);
            }}
          >
            <Plus size={15} weight="bold" /> New Report
          </button>
        }
      />

      {/* ══════════════════════════════════════════════════════════════
         QUICK START PRESETS
         ══════════════════════════════════════════════════════════════ */}
      <SectionCard
        title="Quick Start Presets"
        icon={<Lightning size={17} weight="duotone" color={GOLD} />}
        style={{ marginBottom: 24 }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: 12,
          }}
        >
          {PRESETS.map(p => (
            <div
              key={p.key}
              style={{ ...cardStyle, cursor: 'pointer', transition: 'border-color 0.2s' }}
              onClick={() => {
                setEditId(null);
                setDraft(emptyTemplate());
                applyPreset(p);
                setWizardOpen(true);
              }}
              onMouseEnter={e =>
                (e.currentTarget.style.borderColor = GOLD)
              }
              onMouseLeave={e =>
                (e.currentTarget.style.borderColor = BORDER)
              }
            >
              <div
                style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 4 }}
              >
                {p.name}
              </div>
              <div style={{ fontSize: 12, color: DIM, marginBottom: 8 }}>
                {p.description}
              </div>
              <div>
                <span
                  style={badgeStyle(
                    p.type === 'table'
                      ? BLUE
                      : p.type === 'chart'
                        ? PURPLE
                        : GREEN,
                  )}
                >
                  {p.type}
                </span>
                {p.chartKind && (
                  <span style={badgeStyle(AMBER)}>{p.chartKind}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ══════════════════════════════════════════════════════════════
         TEMPLATE LIST
         ══════════════════════════════════════════════════════════════ */}
      <SectionCard
        title={`Saved Reports (${filtered.length})`}
        icon={<Files size={17} weight="duotone" color={GOLD} />}
        style={{ marginBottom: 24 }}
        action={
          <input
            style={{ ...inputStyle, maxWidth: 240, width: 240 }}
            placeholder="Search saved reports..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        }
      >
        {filtered.length === 0 && (
          <PremiumEmpty
            icon={<FileDashed size={30} weight="duotone" color={GOLD} />}
            title="No reports found"
            description="Create one above or use a preset to get started."
            action={
              <button
                style={goldButtonStyle}
                className="pmBtn"
                onClick={() => {
                  setDraft(emptyTemplate());
                  setEditId(null);
                  setWizardStep('type');
                  setWizardOpen(true);
                }}
              >
                <Plus size={15} weight="bold" /> New Report
              </button>
            }
          />
        )}

        {filtered.map(t => (
          <div key={t.id} style={cardStyle}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              {/* ── Left: info ── */}
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 4,
                  }}
                >
                  <span style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>
                    {t.name}
                  </span>
                  <span
                    style={badgeStyle(
                      t.type === 'table'
                        ? BLUE
                        : t.type === 'chart'
                          ? PURPLE
                          : GREEN,
                    )}
                  >
                    {t.type}
                  </span>
                  {t.chartKind && (
                    <span style={badgeStyle(AMBER)}>{t.chartKind}</span>
                  )}
                  {t.schedule.enabled && (
                    <span style={badgeStyle(GREEN)}>
                      Scheduled: {t.schedule.frequency}
                    </span>
                  )}
                </div>
                <p style={{ color: DIM, fontSize: 13, margin: '2px 0 8px' }}>
                  {t.description}
                </p>
                <div
                  style={{
                    display: 'flex',
                    gap: 6,
                    flexWrap: 'wrap',
                    marginBottom: 8,
                  }}
                >
                  {t.modules.map(m => (
                    <span key={m} style={tagStyle}>
                      {MODULE_OPTIONS.find(o => o.key === m)?.label ?? m}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: DIM }}>
                  {t.columns.filter(c => c.enabled).length} columns &middot;{' '}
                  {t.filters.length} filter
                  {t.filters.length !== 1 ? 's' : ''} &middot; Updated{' '}
                  {t.updatedAt}
                </div>
                {t.schedule.enabled && t.schedule.recipients.length > 0 && (
                  <div style={{ fontSize: 12, color: DIM, marginTop: 4 }}>
                    Recipients: {t.schedule.recipients.join(', ')} &middot; Next
                    run: {t.schedule.nextRun || 'TBD'}
                  </div>
                )}
              </div>

              {/* ── Right: actions ── */}
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  flexShrink: 0,
                  flexWrap: 'wrap',
                  justifyContent: 'flex-end',
                  maxWidth: 280,
                }}
              >
                <button style={btnSmall} onClick={() => setPreviewId(t.id)}>
                  Preview
                </button>
                <button style={btnSmall} onClick={() => openEdit(t)}>
                  Edit
                </button>
                <button style={btnSmall} onClick={() => duplicateTemplate(t)}>
                  Duplicate
                </button>
                <button
                  style={btnSmall}
                  onClick={() => setScheduleModal(t.id)}
                >
                  Schedule
                </button>
                <button
                  style={{ ...btnSmall, borderColor: RED, color: RED }}
                  onClick={() => setDeleteConfirm(t.id)}
                >
                  Delete
                </button>
              </div>
            </div>

            {/* ── Export row ── */}
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginTop: 12,
                borderTop: `1px solid ${BORDER}`,
                paddingTop: 12,
              }}
            >
              {['PDF', 'Excel', 'CSV'].map(fmt => {
                const isExporting = exporting === `${t.id}-${fmt}`;
                return (
                  <button
                    key={fmt}
                    style={{
                      ...btnSecondary,
                      fontSize: 12,
                      padding: '5px 14px',
                      opacity: isExporting ? 0.5 : 1,
                    }}
                    disabled={isExporting}
                    onClick={() => handleExport(t.id, fmt)}
                  >
                    {isExporting ? 'Exporting...' : `Export ${fmt}`}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </SectionCard>

      {/* ══════════════════════════════════════════════════════════════
         DELETE CONFIRMATION MODAL
         ══════════════════════════════════════════════════════════════ */}
      {deleteConfirm && (
        <div style={overlayStyle} onClick={() => setDeleteConfirm(null)}>
          <div
            style={{ ...modalStyle, maxWidth: 420, textAlign: 'center' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ color: RED, marginBottom: 12 }}>Delete Report</h3>
            <p style={{ color: DIM, marginBottom: 20 }}>
              Are you sure you want to delete this report template? This action
              cannot be undone.
            </p>
            <div
              style={{ display: 'flex', gap: 12, justifyContent: 'center' }}
            >
              <button
                style={btnSecondary}
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </button>
              <button
                style={btnDanger}
                onClick={() => deleteTemplate(deleteConfirm)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
         SCHEDULE MODAL
         ══════════════════════════════════════════════════════════════ */}
      {scheduleModal && schedTpl && (
        <div
          style={overlayStyle}
          onClick={() => {
            setScheduleModal(null);
            setRecipientInput('');
          }}
        >
          <div
            style={{ ...modalStyle, maxWidth: 520 }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ color: GOLD, marginBottom: 16 }}>
              Schedule: {schedTpl.name}
            </h3>

            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: 'pointer',
                  marginBottom: 14,
                }}
              >
                <input
                  type="checkbox"
                  checked={schedTpl.schedule.enabled}
                  onChange={e =>
                    updateSchedule(schedTpl.id, {
                      ...schedTpl.schedule,
                      enabled: e.target.checked,
                    })
                  }
                />
                <span style={{ color: TEXT, fontSize: 14 }}>
                  Enable scheduled delivery
                </span>
              </label>

              {schedTpl.schedule.enabled && (
                <>
                  <label
                    style={{
                      display: 'block',
                      color: DIM,
                      fontSize: 13,
                      marginBottom: 6,
                    }}
                  >
                    Frequency
                  </label>
                  <select
                    style={{ ...selectStyle, marginBottom: 16 }}
                    value={schedTpl.schedule.frequency}
                    onChange={e =>
                      updateSchedule(schedTpl.id, {
                        ...schedTpl.schedule,
                        frequency: e.target.value as Frequency,
                      })
                    }
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>

                  <label
                    style={{
                      display: 'block',
                      color: DIM,
                      fontSize: 13,
                      marginBottom: 6,
                    }}
                  >
                    Recipients
                  </label>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 6,
                      marginBottom: 8,
                    }}
                  >
                    {schedTpl.schedule.recipients.map((r, i) => (
                      <span key={i} style={tagStyle}>
                        {r}
                        <span
                          style={{
                            cursor: 'pointer',
                            marginLeft: 4,
                            color: RED,
                            fontWeight: 700,
                          }}
                          onClick={() =>
                            updateSchedule(schedTpl.id, {
                              ...schedTpl.schedule,
                              recipients:
                                schedTpl.schedule.recipients.filter(
                                  (_, j) => j !== i,
                                ),
                            })
                          }
                        >
                          x
                        </span>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      style={inputStyle}
                      placeholder="Add email address..."
                      value={recipientInput}
                      onChange={e => setRecipientInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && recipientInput.trim()) {
                          updateSchedule(schedTpl.id, {
                            ...schedTpl.schedule,
                            recipients: [
                              ...schedTpl.schedule.recipients,
                              recipientInput.trim(),
                            ],
                          });
                          setRecipientInput('');
                        }
                      }}
                    />
                    <button
                      style={btnPrimary}
                      onClick={() => {
                        if (recipientInput.trim()) {
                          updateSchedule(schedTpl.id, {
                            ...schedTpl.schedule,
                            recipients: [
                              ...schedTpl.schedule.recipients,
                              recipientInput.trim(),
                            ],
                          });
                          setRecipientInput('');
                        }
                      }}
                    >
                      Add
                    </button>
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                style={btnPrimary}
                onClick={() => {
                  setScheduleModal(null);
                  setRecipientInput('');
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
         PREVIEW MODAL
         ══════════════════════════════════════════════════════════════ */}
      {previewId && previewTpl && (
        <div style={overlayStyle} onClick={() => setPreviewId(null)}>
          <div
            style={{ ...modalStyle, maxWidth: 860 }}
            onClick={e => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <h3 style={{ color: GOLD, margin: 0 }}>
                Preview: {previewTpl.name}
              </h3>
              <button style={btnSmall} onClick={() => setPreviewId(null)}>
                Close
              </button>
            </div>

            {/* Badges */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <span
                style={badgeStyle(
                  previewTpl.type === 'table'
                    ? BLUE
                    : previewTpl.type === 'chart'
                      ? PURPLE
                      : GREEN,
                )}
              >
                {previewTpl.type}
              </span>
              {previewTpl.chartKind && (
                <span style={badgeStyle(AMBER)}>{previewTpl.chartKind}</span>
              )}
              {previewTpl.modules.map(m => (
                <span key={m} style={tagStyle}>
                  {MODULE_OPTIONS.find(o => o.key === m)?.label ?? m}
                </span>
              ))}
            </div>

            <SampleDataNote />

            {/* Active filters */}
            {previewTpl.filters.length > 0 && (
              <div
                style={{
                  marginBottom: 16,
                  padding: 12,
                  background: BG,
                  borderRadius: 8,
                  border: `1px solid ${BORDER}`,
                }}
              >
                <div
                  style={{
                    color: DIM,
                    fontSize: 12,
                    fontWeight: 600,
                    marginBottom: 6,
                  }}
                >
                  Active Filters
                </div>
                {previewTpl.filters.map(f => (
                  <div
                    key={f.id}
                    style={{ fontSize: 13, color: TEXT, marginBottom: 2 }}
                  >
                    {FILTER_FIELDS.find(ff => ff.key === f.field)?.label}{' '}
                    {f.operator} &ldquo;{f.value}&rdquo;
                    {f.value2 ? ` and "${f.value2}"` : ''}
                  </div>
                ))}
              </div>
            )}

            {/* Chart preview */}
            {previewTpl.type === 'chart' && (
              <div
                style={{
                  marginBottom: 20,
                  padding: 16,
                  background: BG,
                  borderRadius: 8,
                  border: `1px solid ${BORDER}`,
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                {previewTpl.chartKind === 'bar' && (
                  <BarChart data={CHART_DATA} />
                )}
                {previewTpl.chartKind === 'line' && (
                  <LineChart data={CHART_DATA} />
                )}
                {previewTpl.chartKind === 'pie' && (
                  <PieChart data={PIE_DATA} />
                )}
              </div>
            )}

            {/* Summary cards */}
            {previewTpl.type === 'summary' && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 12,
                  marginBottom: 20,
                }}
              >
                {[
                  { label: 'Total Incidents', value: '3', color: RED },
                  { label: 'Near Misses', value: '11', color: AMBER },
                  { label: 'Avg Compliance', value: '95%', color: GREEN },
                  { label: 'Inspections Done', value: '45', color: BLUE },
                  { label: 'Open Items', value: '7', color: AMBER },
                  {
                    label: 'Days Since Incident',
                    value: '12',
                    color: GREEN,
                  },
                ].map((s, i) => (
                  <div
                    key={i}
                    style={{
                      background: BG,
                      border: `1px solid ${BORDER}`,
                      borderRadius: 8,
                      padding: 16,
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 28,
                        fontWeight: 700,
                        color: s.color,
                      }}
                    >
                      {s.value}
                    </div>
                    <div style={{ fontSize: 12, color: DIM, marginTop: 4 }}>
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Data table */}
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr>
                    {previewTpl.columns
                      .filter(c => c.enabled)
                      .map(c => (
                        <th
                          key={c.key}
                          style={{
                            textAlign: 'left',
                            padding: '10px 12px',
                            borderBottom: `2px solid ${BORDER}`,
                            color: DIM,
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {c.label}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {generateMockData(previewTpl.columns).map((row, ri) => (
                    <tr key={ri}>
                      {previewTpl.columns
                        .filter(c => c.enabled)
                        .map(c => {
                          const val = row[c.key] || '---';
                          let cellColor = TEXT;
                          if (
                            val === 'Green' ||
                            val === 'Active' ||
                            val === 'Complete'
                          )
                            cellColor = GREEN;
                          else if (
                            val === 'Yellow' ||
                            val === 'On Hold' ||
                            val === 'Planning'
                          )
                            cellColor = AMBER;
                          else if (val === 'Red') cellColor = RED;
                          return (
                            <td
                              key={c.key}
                              style={{
                                padding: '9px 12px',
                                borderBottom: `1px solid ${BORDER}`,
                                color: cellColor,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {val}
                            </td>
                          );
                        })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Export from preview */}
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginTop: 16,
                justifyContent: 'flex-end',
              }}
            >
              {['PDF', 'Excel', 'CSV'].map(fmt => (
                <button
                  key={fmt}
                  style={{ ...btnSecondary, fontSize: 12 }}
                  onClick={() => {
                    setPreviewId(null);
                    handleExport(previewTpl.id, fmt);
                  }}
                >
                  Export {fmt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
         CREATE / EDIT WIZARD MODAL
         ══════════════════════════════════════════════════════════════ */}
      {wizardOpen && (
        <div style={overlayStyle} onClick={closeWizard}>
          <div
            style={{ ...modalStyle, maxWidth: 820 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Wizard header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 20,
              }}
            >
              <h3 style={{ color: GOLD, margin: 0 }}>
                {editId ? 'Edit Report' : 'Create New Report'}
              </h3>
              <button style={btnSmall} onClick={closeWizard}>
                Cancel
              </button>
            </div>

            {/* Step progress bar */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
              {wizardSteps.map((s, i) => (
                <div
                  key={s}
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 2,
                    background: i <= stepIdx ? GOLD : BORDER,
                    transition: 'background 0.3s',
                  }}
                />
              ))}
            </div>
            <div
              style={{
                fontSize: 12,
                color: DIM,
                marginBottom: 20,
                textTransform: 'capitalize',
              }}
            >
              Step {stepIdx + 1} of {wizardSteps.length}: {wizardStep}
            </div>

            {/* ═══ STEP: TYPE ═══ */}
            {wizardStep === 'type' && (
              <div>
                <label
                  style={{
                    display: 'block',
                    color: DIM,
                    fontSize: 13,
                    marginBottom: 6,
                  }}
                >
                  Report Name *
                </label>
                <input
                  style={{ ...inputStyle, marginBottom: 14 }}
                  placeholder="e.g. Weekly Project Summary"
                  value={draft.name}
                  onChange={e =>
                    setDraft(p => ({ ...p, name: e.target.value }))
                  }
                />
                <label
                  style={{
                    display: 'block',
                    color: DIM,
                    fontSize: 13,
                    marginBottom: 6,
                  }}
                >
                  Description
                </label>
                <input
                  style={{ ...inputStyle, marginBottom: 18 }}
                  placeholder="Brief description of this report..."
                  value={draft.description}
                  onChange={e =>
                    setDraft(p => ({ ...p, description: e.target.value }))
                  }
                />
                <label
                  style={{
                    display: 'block',
                    color: DIM,
                    fontSize: 13,
                    marginBottom: 8,
                  }}
                >
                  Report Type
                </label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 12,
                  }}
                >
                  {(
                    [
                      {
                        key: 'table' as ReportType,
                        label: 'Table',
                        desc: 'Rows and columns of data',
                        icon: <Table size={28} weight="regular" color={TEXT} />,
                      },
                      {
                        key: 'chart' as ReportType,
                        label: 'Chart',
                        desc: 'Visual bar, line, or pie chart',
                        icon: <ChartBar size={28} weight="regular" color={TEXT} />,
                      },
                      {
                        key: 'summary' as ReportType,
                        label: 'Summary',
                        desc: 'KPI cards with highlights',
                        icon: <ChartLineUp size={28} weight="regular" color={TEXT} />,
                      },
                    ] as const
                  ).map(opt => (
                    <div
                      key={opt.key}
                      style={{
                        ...cardStyle,
                        cursor: 'pointer',
                        borderColor:
                          draft.type === opt.key ? GOLD : BORDER,
                        textAlign: 'center',
                        transition: 'border-color 0.2s',
                      }}
                      onClick={() =>
                        setDraft(p => ({ ...p, type: opt.key }))
                      }
                    >
                      <div style={{ fontSize: 28 }}>{opt.icon}</div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: TEXT,
                          marginTop: 6,
                        }}
                      >
                        {opt.label}
                      </div>
                      <div style={{ fontSize: 12, color: DIM, marginTop: 4 }}>
                        {opt.desc}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ═══ STEP: MODULES ═══ */}
            {wizardStep === 'modules' && (
              <div>
                <label
                  style={{
                    display: 'block',
                    color: DIM,
                    fontSize: 13,
                    marginBottom: 10,
                  }}
                >
                  Select Data Modules (one or more)
                </label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 12,
                  }}
                >
                  {MODULE_OPTIONS.map(m => {
                    const sel = draft.modules.includes(m.key);
                    return (
                      <div
                        key={m.key}
                        style={{
                          ...cardStyle,
                          cursor: 'pointer',
                          borderColor: sel ? GOLD : BORDER,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 14,
                          transition: 'border-color 0.2s',
                        }}
                        onClick={() => updateModules(m.key)}
                      >
                        <span style={{ fontSize: 28 }}>{m.icon}</span>
                        <div>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: TEXT,
                            }}
                          >
                            {m.label}
                          </div>
                          <div style={{ fontSize: 12, color: DIM }}>
                            {ALL_COLUMNS[m.key].length} available columns
                          </div>
                        </div>
                        {sel && (
                          <span
                            style={{
                              marginLeft: 'auto',
                              color: GREEN,
                              fontWeight: 700,
                              fontSize: 18,
                            }}
                          >
                            <CheckCircle size={18} weight="fill" color={GREEN} />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ═══ STEP: COLUMNS ═══ */}
            {wizardStep === 'columns' && (
              <div>
                <label
                  style={{
                    display: 'block',
                    color: DIM,
                    fontSize: 13,
                    marginBottom: 10,
                  }}
                >
                  Configure Columns ({draft.columns.filter(c => c.enabled).length}{' '}
                  of {draft.columns.length} selected)
                </label>
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <button
                    style={btnSmall}
                    onClick={() =>
                      setDraft(p => ({
                        ...p,
                        columns: p.columns.map(c => ({
                          ...c,
                          enabled: true,
                        })),
                      }))
                    }
                  >
                    Select All
                  </button>
                  <button
                    style={btnSmall}
                    onClick={() =>
                      setDraft(p => ({
                        ...p,
                        columns: p.columns.map(c => ({
                          ...c,
                          enabled: false,
                        })),
                      }))
                    }
                  >
                    Deselect All
                  </button>
                </div>
                <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                  {(() => {
                    /* Field pickers organized BY MODULE - each selected module
                       renders its own header with live counts and All/None,
                       so a multi-module report is scannable, not a flat wall. */
                    const seen = new Set<string>();
                    const groups: { mod: string; label: string; cols: ColumnDef[] }[] = draft.modules
                      .map(mod => {
                        const meta = MODULE_OPTIONS.find(o => o.key === mod);
                        const cols = ALL_COLUMNS[mod]
                          .map(mc => draft.columns.find(dc => dc.key === mc.key))
                          .filter((c): c is ColumnDef => !!c && !seen.has(c.key));
                        cols.forEach(c => seen.add(c.key));
                        return { mod, label: meta?.label ?? mod, cols };
                      })
                      .filter(g => g.cols.length > 0);
                    const leftover = draft.columns.filter(c => !seen.has(c.key));
                    if (leftover.length > 0) groups.push({ mod: 'other', label: 'Other Fields', cols: leftover });
                    const setGroup = (keys: string[], enabled: boolean) => {
                      const ks = new Set(keys);
                      setDraft(p => ({ ...p, columns: p.columns.map(c => (ks.has(c.key) ? { ...c, enabled } : c)) }));
                    };
                    return groups.map(g => (
                      <div key={g.mod} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: BG, border: `1px solid ${BORDER}`, borderRadius: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: 0.5 }}>{g.label}</span>
                          <span style={{ fontSize: 11, color: DIM }}>{g.cols.filter(c => c.enabled).length} of {g.cols.length} fields</span>
                          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                            <button style={{ ...btnSmall, padding: '2px 8px', fontSize: 11 }} onClick={() => setGroup(g.cols.map(c => c.key), true)}>All</button>
                            <button style={{ ...btnSmall, padding: '2px 8px', fontSize: 11 }} onClick={() => setGroup(g.cols.map(c => c.key), false)}>None</button>
                          </span>
                        </div>
                        {g.cols.map(col => (
                    <label
                      key={col.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 12px',
                        borderBottom: `1px solid ${BORDER}`,
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={col.enabled}
                        onChange={() => toggleColumn(col.key)}
                      />
                      <span
                        style={{
                          color: col.enabled ? TEXT : DIM,
                          fontSize: 14,
                        }}
                      >
                        {col.label}
                      </span>
                      <span
                        style={{
                          marginLeft: 'auto',
                          fontSize: 12,
                          color: DIM,
                        }}
                      >
                        {col.key}
                      </span>
                    </label>
                  ))}
                      </div>
                    ));
                  })()}
                </div>
                {draft.columns.length === 0 && (
                  <p style={{ color: AMBER, fontSize: 13, marginTop: 8 }}>
                    Select at least one module first to see available columns.
                  </p>
                )}
              </div>
            )}

            {/* ═══ STEP: CHART ═══ */}
            {wizardStep === 'chart' && (
              <div>
                <label
                  style={{
                    display: 'block',
                    color: DIM,
                    fontSize: 13,
                    marginBottom: 10,
                  }}
                >
                  Chart Type
                </label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 12,
                    marginBottom: 24,
                  }}
                >
                  {(
                    [
                      { key: 'bar' as ChartKind, label: 'Bar Chart', icon: <ChartBar size={24} weight="regular" color={TEXT} /> },
                      { key: 'line' as ChartKind, label: 'Line Chart', icon: <ChartLine size={24} weight="regular" color={TEXT} /> },
                      { key: 'pie' as ChartKind, label: 'Pie Chart', icon: <ChartPie size={24} weight="regular" color={TEXT} /> },
                    ] as const
                  ).map(opt => (
                    <div
                      key={opt.key}
                      style={{
                        ...cardStyle,
                        cursor: 'pointer',
                        borderColor:
                          draft.chartKind === opt.key ? GOLD : BORDER,
                        textAlign: 'center',
                        transition: 'border-color 0.2s',
                      }}
                      onClick={() =>
                        setDraft(p => ({ ...p, chartKind: opt.key }))
                      }
                    >
                      <div style={{ fontSize: 24 }}>{opt.icon}</div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: TEXT,
                          marginTop: 4,
                        }}
                      >
                        {opt.label}
                      </div>
                    </div>
                  ))}
                </div>

                <label
                  style={{
                    display: 'block',
                    color: DIM,
                    fontSize: 13,
                    marginBottom: 8,
                  }}
                >
                  Chart Preview (sample data)
                </label>
                <div
                  style={{
                    padding: 16,
                    background: BG,
                    borderRadius: 8,
                    border: `1px solid ${BORDER}`,
                    display: 'flex',
                    justifyContent: 'center',
                  }}
                >
                  {draft.chartKind === 'bar' && (
                    <BarChart data={CHART_DATA} />
                  )}
                  {draft.chartKind === 'line' && (
                    <LineChart data={CHART_DATA} />
                  )}
                  {draft.chartKind === 'pie' && (
                    <PieChart data={PIE_DATA} />
                  )}
                  {!draft.chartKind && (
                    <p style={{ color: DIM }}>
                      Select a chart type above to see a preview
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ═══ STEP: FILTERS ═══ */}
            {wizardStep === 'filters' && (
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 12,
                  }}
                >
                  <label style={{ color: DIM, fontSize: 13 }}>
                    Filter Rules ({draft.filters.length})
                  </label>
                  <button style={btnSmall} onClick={addFilter}>
                    + Add Filter
                  </button>
                </div>

                {draft.filters.length === 0 && (
                  <p style={{ color: DIM, fontSize: 13 }}>
                    No filters applied. The report will include all matching
                    data. Click &ldquo;+ Add Filter&rdquo; to narrow results.
                  </p>
                )}

                {draft.filters.map(f => (
                  <div
                    key={f.id}
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                      marginBottom: 10,
                      padding: 10,
                      background: BG,
                      borderRadius: 6,
                      border: `1px solid ${BORDER}`,
                      flexWrap: 'wrap',
                    }}
                  >
                    <select
                      style={{ ...selectStyle, flex: '1 1 120px' }}
                      value={f.field}
                      onChange={e =>
                        updateFilter(f.id, {
                          field: e.target.value as FilterField,
                        })
                      }
                    >
                      {FILTER_FIELDS.map(ff => (
                        <option key={ff.key} value={ff.key}>
                          {ff.label}
                        </option>
                      ))}
                    </select>
                    <select
                      style={{ ...selectStyle, flex: '1 1 120px' }}
                      value={f.operator}
                      onChange={e =>
                        updateFilter(f.id, {
                          operator: e.target.value as FilterOp,
                        })
                      }
                    >
                      {FILTER_OPS.map(op => (
                        <option key={op.key} value={op.key}>
                          {op.label}
                        </option>
                      ))}
                    </select>
                    <input
                      style={{ ...inputStyle, flex: '1 1 120px' }}
                      placeholder="Value..."
                      value={f.value}
                      onChange={e =>
                        updateFilter(f.id, { value: e.target.value })
                      }
                    />
                    {f.operator === 'between' && (
                      <input
                        style={{ ...inputStyle, flex: '1 1 120px' }}
                        placeholder="Value 2..."
                        value={f.value2 || ''}
                        onChange={e =>
                          updateFilter(f.id, { value2: e.target.value })
                        }
                      />
                    )}
                    <button
                      style={{
                        ...btnSmall,
                        borderColor: RED,
                        color: RED,
                        padding: '5px 8px',
                        flexShrink: 0,
                      }}
                      onClick={() => removeFilter(f.id)}
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* ═══ STEP: SCHEDULE ═══ */}
            {wizardStep === 'schedule' && (
              <div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                    marginBottom: 16,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={draft.schedule.enabled}
                    onChange={e =>
                      setDraft(p => ({
                        ...p,
                        schedule: {
                          ...p.schedule,
                          enabled: e.target.checked,
                        },
                      }))
                    }
                  />
                  <span style={{ color: TEXT, fontSize: 14 }}>
                    Enable scheduled delivery
                  </span>
                </label>

                {draft.schedule.enabled && (
                  <>
                    <label
                      style={{
                        display: 'block',
                        color: DIM,
                        fontSize: 13,
                        marginBottom: 6,
                      }}
                    >
                      Frequency
                    </label>
                    <select
                      style={{ ...selectStyle, marginBottom: 16 }}
                      value={draft.schedule.frequency}
                      onChange={e =>
                        setDraft(p => ({
                          ...p,
                          schedule: {
                            ...p.schedule,
                            frequency: e.target.value as Frequency,
                          },
                        }))
                      }
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>

                    <label
                      style={{
                        display: 'block',
                        color: DIM,
                        fontSize: 13,
                        marginBottom: 6,
                      }}
                    >
                      Recipients
                    </label>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 6,
                        marginBottom: 8,
                      }}
                    >
                      {draft.schedule.recipients.map((r, i) => (
                        <span key={i} style={tagStyle}>
                          {r}
                          <span
                            style={{
                              cursor: 'pointer',
                              marginLeft: 4,
                              color: RED,
                              fontWeight: 700,
                            }}
                            onClick={() => removeRecipientFromDraft(i)}
                          >
                            x
                          </span>
                        </span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        style={inputStyle}
                        placeholder="Add email address..."
                        value={recipientInput}
                        onChange={e =>
                          setRecipientInput(e.target.value)
                        }
                        onKeyDown={e => {
                          if (
                            e.key === 'Enter' &&
                            recipientInput.trim()
                          ) {
                            addRecipientToDraft();
                          }
                        }}
                      />
                      <button
                        style={{ ...btnPrimary, padding: '8px 16px' }}
                        onClick={addRecipientToDraft}
                      >
                        Add
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ═══ STEP: PREVIEW ═══ */}
            {wizardStep === 'preview' && (
              <div>
                <h4 style={{ color: TEXT, marginBottom: 12 }}>
                  Report Preview: {draft.name}
                </h4>

                {/* Meta badges */}
                <div
                  style={{ display: 'flex', gap: 8, marginBottom: 16 }}
                >
                  <span
                    style={badgeStyle(
                      draft.type === 'table'
                        ? BLUE
                        : draft.type === 'chart'
                          ? PURPLE
                          : GREEN,
                    )}
                  >
                    {draft.type}
                  </span>
                  {draft.chartKind && (
                    <span style={badgeStyle(AMBER)}>
                      {draft.chartKind}
                    </span>
                  )}
                  {draft.modules.map(m => (
                    <span key={m} style={tagStyle}>
                      {MODULE_OPTIONS.find(o => o.key === m)?.label ?? m}
                    </span>
                  ))}
                </div>

                <SampleDataNote />

                {/* Filters summary */}
                {draft.filters.length > 0 && (
                  <div
                    style={{
                      marginBottom: 12,
                      padding: 10,
                      background: BG,
                      borderRadius: 6,
                      border: `1px solid ${BORDER}`,
                    }}
                  >
                    <div
                      style={{
                        color: DIM,
                        fontSize: 12,
                        fontWeight: 600,
                        marginBottom: 4,
                      }}
                    >
                      Filters
                    </div>
                    {draft.filters.map(f => (
                      <div
                        key={f.id}
                        style={{ fontSize: 12, color: TEXT }}
                      >
                        {
                          FILTER_FIELDS.find(ff => ff.key === f.field)
                            ?.label
                        }{' '}
                        {f.operator} &ldquo;{f.value}&rdquo;
                        {f.value2 ? ` - "${f.value2}"` : ''}
                      </div>
                    ))}
                  </div>
                )}

                {/* Schedule summary */}
                {draft.schedule.enabled && (
                  <div
                    style={{
                      marginBottom: 12,
                      padding: 10,
                      background: BG,
                      borderRadius: 6,
                      border: `1px solid ${BORDER}`,
                    }}
                  >
                    <div
                      style={{
                        color: DIM,
                        fontSize: 12,
                        fontWeight: 600,
                        marginBottom: 4,
                      }}
                    >
                      Schedule
                    </div>
                    <div style={{ fontSize: 12, color: TEXT }}>
                      {draft.schedule.frequency} &middot;{' '}
                      {draft.schedule.recipients.length} recipient(s)
                      {draft.schedule.recipients.length > 0 && (
                        <span>
                          {' '}
                          ({draft.schedule.recipients.join(', ')})
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Chart in preview step */}
                {draft.type === 'chart' && draft.chartKind && (
                  <div
                    style={{
                      marginBottom: 16,
                      padding: 16,
                      background: BG,
                      borderRadius: 8,
                      border: `1px solid ${BORDER}`,
                      display: 'flex',
                      justifyContent: 'center',
                    }}
                  >
                    {draft.chartKind === 'bar' && (
                      <BarChart data={CHART_DATA} />
                    )}
                    {draft.chartKind === 'line' && (
                      <LineChart data={CHART_DATA} />
                    )}
                    {draft.chartKind === 'pie' && (
                      <PieChart data={PIE_DATA} />
                    )}
                  </div>
                )}

                {/* Summary KPI cards in preview step */}
                {draft.type === 'summary' && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: 10,
                      marginBottom: 16,
                    }}
                  >
                    {[
                      {
                        label: 'Total Records',
                        value: '127',
                        color: BLUE,
                      },
                      { label: 'Active', value: '85', color: GREEN },
                      { label: 'Flagged', value: '12', color: RED },
                    ].map((s, i) => (
                      <div
                        key={i}
                        style={{
                          background: BG,
                          border: `1px solid ${BORDER}`,
                          borderRadius: 8,
                          padding: 14,
                          textAlign: 'center',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 24,
                            fontWeight: 700,
                            color: s.color,
                          }}
                        >
                          {s.value}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: DIM,
                            marginTop: 4,
                          }}
                        >
                          {s.label}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Mock data table in preview step */}
                {draft.columns.some(c => c.enabled) && (
                  <div style={{ overflowX: 'auto' }}>
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: 13,
                      }}
                    >
                      <thead>
                        <tr>
                          {draft.columns
                            .filter(c => c.enabled)
                            .map(c => (
                              <th
                                key={c.key}
                                style={{
                                  textAlign: 'left',
                                  padding: '9px 12px',
                                  borderBottom: `2px solid ${BORDER}`,
                                  color: DIM,
                                  fontWeight: 600,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {c.label}
                              </th>
                            ))}
                        </tr>
                      </thead>
                      <tbody>
                        {generateMockData(draft.columns).map(
                          (row, ri) => (
                            <tr key={ri}>
                              {draft.columns
                                .filter(c => c.enabled)
                                .map(c => {
                                  const val = row[c.key] || '---';
                                  let cellColor = TEXT;
                                  if (
                                    val === 'Green' ||
                                    val === 'Active' ||
                                    val === 'Complete'
                                  )
                                    cellColor = GREEN;
                                  else if (
                                    val === 'Yellow' ||
                                    val === 'On Hold' ||
                                    val === 'Planning'
                                  )
                                    cellColor = AMBER;
                                  else if (val === 'Red')
                                    cellColor = RED;
                                  return (
                                    <td
                                      key={c.key}
                                      style={{
                                        padding: '8px 12px',
                                        borderBottom: `1px solid ${BORDER}`,
                                        color: cellColor,
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {val}
                                    </td>
                                  );
                                })}
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ═══ WIZARD NAVIGATION ═══ */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 24,
                borderTop: `1px solid ${BORDER}`,
                paddingTop: 16,
              }}
            >
              <button
                style={btnSecondary}
                onClick={() => {
                  if (stepIdx > 0) {
                    setWizardStep(wizardSteps[stepIdx - 1]);
                  } else {
                    closeWizard();
                  }
                }}
              >
                {stepIdx === 0 ? 'Cancel' : 'Back'}
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                {wizardStep === 'preview' ? (
                  <button
                    style={{
                      ...btnPrimary,
                      opacity: saving ? 0.6 : 1,
                    }}
                    disabled={saving}
                    onClick={saveTemplate}
                  >
                    {saving
                      ? 'Saving...'
                      : editId
                        ? 'Update Report'
                        : 'Create Report'}
                  </button>
                ) : (
                  <button
                    style={{
                      ...btnPrimary,
                      opacity: canNext() ? 1 : 0.4,
                    }}
                    disabled={!canNext()}
                    onClick={() => {
                      if (
                        canNext() &&
                        stepIdx < wizardSteps.length - 1
                      ) {
                        setWizardStep(wizardSteps[stepIdx + 1]);
                      }
                    }}
                  >
                    Next
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Spinner keyframe */}
      <style>{`@keyframes rpt-spin { to { transform: rotate(360deg); } }`}</style>
    </PremiumSurface>
  );
}
