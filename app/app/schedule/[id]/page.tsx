'use client';
/**
 * Schedule Task Detail — task overview reached from the schedule list row click
 * (app/app/schedule/page.tsx -> router.push('/app/schedule/<id>')).
 *
 * Data source: GET /api/schedule/list returns { tasks: [...] } with full rows
 * (the [id] route only exposes PUT/DELETE, not GET), so the task is resolved by
 * id from that list. Matches the schedule list + invoice detail design tokens and
 * uses @phosphor-icons/react (no emoji), consistent with the rest of the app.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { humanError } from '@/lib/errors';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Warning, CalendarBlank, GitBranch, ClipboardText,
} from '@phosphor-icons/react';
import { colors, font, radius, space } from '@/lib/design-tokens';

interface ScheduleTask {
  id: string;
  project_id: string | null;
  name: string | null;
  phase: string | null;
  trade: string | null;
  start_date: string | null;
  end_date: string | null;
  pct_complete: number | null;
  status: string | null;
  predecessor_id: string | null;
  duration: number | null;
  created_at: string | null;
}

interface Project { id: string; name: string; }

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  not_started: { label: 'Not Started', color: colors.textDim },
  in_progress: { label: 'In Progress', color: colors.blue },
  complete: { label: 'Complete', color: colors.green },
  blocked: { label: 'Blocked', color: colors.red },
  delayed: { label: 'Delayed', color: colors.orange },
  on_hold: { label: 'On Hold', color: colors.orange },
};

function statusCfg(status?: string | null): { label: string; color: string } {
  const key = (status ?? 'not_started').toLowerCase();
  return STATUS_MAP[key] ?? STATUS_MAP.not_started;
}

function dateStr(v: string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export default function ScheduleTaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params['id'] as string;

  const [task, setTask] = useState<ScheduleTask | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [predecessorName, setPredecessorName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  const loadTask = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotFound(false);
    try {
      const res = await fetch('/api/schedule/list');
      if (!res.ok) throw new Error('Failed to load schedule');
      const data = await res.json();
      const list: ScheduleTask[] = Array.isArray(data)
        ? data
        : data.tasks ?? data.schedule_tasks ?? [];
      const match = list.find(t => t.id === id);
      if (!match) { setNotFound(true); return; }
      setTask(match);
      if (match.predecessor_id) {
        const pred = list.find(t => t.id === match.predecessor_id);
        setPredecessorName(pred?.name ?? 'Linked task');
      } else {
        setPredecessorName(null);
      }
      if (match.project_id) {
        fetch('/api/projects?limit=200&fields=id,name')
          .then(r => r.ok ? r.json() : null)
          .then(d => {
            if (!d) return;
            const projects: Project[] = Array.isArray(d) ? d : d.projects ?? [];
            const p = projects.find(x => x.id === match.project_id);
            if (p) setProjectName(p.name);
          })
          .catch(() => {});
      }
    } catch (e: any) {
      console.error(e); setError(humanError(e, 'Failed to load the task. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadTask(); }, [loadTask]);

  // ── Styles ───────────────────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    background: colors.raised, border: `1px solid ${colors.border}`,
    borderRadius: radius.xl, overflow: 'hidden', marginBottom: space.xxl,
  };
  const cardHeaderStyle: React.CSSProperties = {
    padding: '12px 18px', borderBottom: `1px solid ${colors.border}`,
    fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.text,
    display: 'flex', alignItems: 'center', gap: 8,
  };
  const ghostBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px',
    background: colors.raised, border: `1px solid ${colors.border}`, borderRadius: radius.lg,
    color: colors.text, fontSize: font.size.md, fontWeight: font.weight.semibold, cursor: 'pointer',
  };
  const fieldLabelStyle: React.CSSProperties = {
    fontSize: font.size.xs, fontWeight: font.weight.bold, textTransform: 'uppercase',
    letterSpacing: 0.5, color: colors.textMuted, marginBottom: 4,
  };
  const fieldValueStyle: React.CSSProperties = {
    fontSize: font.size.md, color: colors.text, wordBreak: 'break-word',
  };

  // ── Loading / Not found / Error ──────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 320, color: colors.textMuted, fontSize: font.size.lg }}>
        Loading task...
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: colors.textMuted }}>
        <CalendarBlank size={40} color={colors.textDim} style={{ marginBottom: 12 }} />
        <div style={{ fontSize: font.size.xl, fontWeight: font.weight.bold, color: colors.text, marginBottom: 8 }}>Task not found</div>
        <button onClick={() => router.push('/app/schedule')} style={{ ...ghostBtn, margin: '12px auto 0' }}>
          <ArrowLeft size={14} /> Back to Schedule
        </button>
      </div>
    );
  }

  if (error && !task) {
    return (
      <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,.1)', border: `1px solid rgba(239,68,68,.3)`, borderRadius: radius.md, color: colors.red, fontSize: font.size.md, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Warning size={16} /> {error}
        </div>
        <button onClick={() => router.push('/app/schedule')} style={ghostBtn}>
          <ArrowLeft size={14} /> Back to Schedule
        </button>
      </div>
    );
  }

  const t = task as ScheduleTask;
  const cfg = statusCfg(t.status);
  const pct = t.pct_complete ?? 0;
  const overdue = !!t.end_date && new Date(t.end_date) < new Date() && (t.status ?? '') !== 'complete';

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Back link */}
      <button
        onClick={() => router.push('/app/schedule')}
        style={{ background: 'none', border: 'none', color: colors.textMuted, fontSize: font.size.md, cursor: 'pointer', padding: 0, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <ArrowLeft size={14} /> Schedule
      </button>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,.1)', border: `1px solid rgba(239,68,68,.3)`, borderRadius: radius.md, color: colors.red, fontSize: font.size.md, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Warning size={16} /> {error}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: font.size['3xl'], fontWeight: font.weight.black, color: colors.text }}>
              {t.name || 'Schedule Task'}
            </h1>
            <span style={{
              padding: '3px 12px', borderRadius: 999, fontSize: font.size.xs, fontWeight: font.weight.bold,
              textTransform: 'uppercase', letterSpacing: 0.5, background: `${cfg.color}20`, color: cfg.color,
            }}>
              {cfg.label}
            </span>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: font.size.md, color: colors.textMuted }}>
            {t.phase || 'No phase'}
            {(projectName || t.project_id) && <span> · {projectName || 'Project'}</span>}
          </p>
        </div>
      </div>

      {/* Stat strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { l: 'Start Date', v: dateStr(t.start_date), c: colors.text },
          { l: 'End Date', v: dateStr(t.end_date), c: overdue ? colors.red : colors.text },
          { l: '% Complete', v: `${pct}%`, c: colors.gold },
          { l: 'Status', v: cfg.label, c: cfg.color },
        ].map(k => (
          <div key={k.l} style={{ background: colors.raised, border: `1px solid ${colors.border}`, borderRadius: radius.xl, padding: '16px 18px' }}>
            <div style={{ fontSize: font.size.xs, fontWeight: font.weight.bold, textTransform: 'uppercase', letterSpacing: 0.5, color: colors.textMuted, marginBottom: 6 }}>{k.l}</div>
            <div style={{ fontSize: font.size['2xl'], fontWeight: font.weight.black, color: k.c }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>Progress</div>
        <div style={{ padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 10, background: 'rgba(255,255,255,.06)', borderRadius: 5, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(Math.max(pct, 0), 100)}%`, background: pct >= 100 ? colors.green : pct > 50 ? colors.blue : colors.gold, borderRadius: 5, transition: 'width .3s ease' }} />
            </div>
            <span style={{ fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.text, minWidth: 44, textAlign: 'right' }}>{pct}%</span>
          </div>
        </div>
      </div>

      {/* Task details */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>
          <ClipboardText size={16} /> Task Details
        </div>
        <div style={{ padding: '16px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
          {[
            { l: 'Task', v: t.name || '—' },
            { l: 'Phase', v: t.phase || '—' },
            { l: 'Project', v: projectName || t.project_id || '—' },
            { l: 'Trade', v: t.trade || '—' },
            { l: 'Start Date', v: dateStr(t.start_date) },
            { l: 'End Date', v: dateStr(t.end_date) },
            { l: 'Created', v: dateStr(t.created_at) },
          ].map(f => (
            <div key={f.l}>
              <div style={fieldLabelStyle}>{f.l}</div>
              <div style={fieldValueStyle}>{f.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Dependencies */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>
          <GitBranch size={16} /> Dependencies
        </div>
        <div style={{ padding: '16px 18px' }}>
          <div style={fieldLabelStyle}>Predecessor</div>
          {t.predecessor_id ? (
            <div
              style={{ ...fieldValueStyle, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: colors.blue }}
              onClick={() => router.push(`/app/schedule/${t.predecessor_id}`)}
            >
              <GitBranch size={14} color={colors.blue} /> {predecessorName || 'Linked task'}
            </div>
          ) : (
            <div style={{ ...fieldValueStyle, color: colors.textMuted }}>No predecessor — this task can start independently.</div>
          )}
        </div>
      </div>
    </div>
  );
}
