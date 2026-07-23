'use client';
/**
 * Daily Log Detail — wired to GET /api/daily-logs/[id].
 * Renders a single field daily log (date, weather, temps, crew, work performed,
 * delays, safety notes, materials, visitors, notes, photos).
 *
 * Matches the daily-logs list page (app/app/daily-logs/page.tsx) and the sibling
 * invoice detail page (app/app/invoicing/[id]/page.tsx) for design tokens and
 * @phosphor-icons/react usage (no emoji). Auth is cookie-based via getUser on the
 * route, so a plain same-origin fetch carries the session.
 *
 * API surface:
 *   GET /api/daily-logs/[id] -> { log }
 *
 * Note: the daily_logs table stores temperatures as high_temp / low_temp; this
 * page reads those columns (the GET route returns raw rows). Photos are rendered
 * defensively only when the row carries a photos/photo_urls array.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Warning, ClipboardText, Sun, Thermometer, UsersThree,
  HourglassMedium, ShieldCheck, Package, UserCircle, NotePencil, ImageSquare,
  HardHat, Wrench, CloudRain, Wind,
} from '@phosphor-icons/react';
import { colors, font, radius, space } from '@/lib/design-tokens';

interface DailyLog {
  id: string;
  project_id: string | null;
  log_date: string | null;
  weather: string | null;
  high_temp: number | null;
  low_temp: number | null;
  crew_count: number | null;
  work_performed: string | null;
  delays: string | null;
  safety_notes: string | null;
  materials_delivered: string | null;
  visitors: string | null;
  notes: string | null;
  // Mobile-app text columns (app/daily.tsx) — surfaced here so a log created on
  // the native app renders fully on web instead of showing partial data.
  superintendent: string | null;
  precipitation: string | null;
  wind_conditions: string | null;
  phase_of_work: string | null;
  equipment: string | null;
  photos?: string[] | null;
  photo_urls?: string[] | null;
  created_at: string | null;
}

interface Project { id: string; name: string; }

function dateStr(v: string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function tempStr(high: number | null | undefined, low: number | null | undefined): string {
  if (high == null && low == null) return '—';
  return `${high ?? '—'}° / ${low ?? '—'}°`;
}

export default function DailyLogDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params['id'] as string;

  const [log, setLog] = useState<DailyLog | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  const loadLog = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotFound(false);
    try {
      const res = await fetch(`/api/daily-logs/${id}`);
      if (res.status === 404) { setNotFound(true); return; }
      if (!res.ok) throw new Error('Failed to load daily log');
      const data = await res.json();
      const row: DailyLog = data.log ?? data;
      setLog(row);
      if (row?.project_id) {
        fetch(`/api/projects?limit=200`)
          .then(r => r.ok ? r.json() : null)
          .then(d => {
            if (!d) return;
            const list: Project[] = Array.isArray(d) ? d : d.projects ?? [];
            const match = list.find(p => p.id === row.project_id);
            if (match) setProjectName(match.name);
          })
          .catch(() => {});
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load daily log');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadLog(); }, [loadLog]);

  // ── Styles ───────────────────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    background: colors.raised, border: `1px solid ${colors.border}`,
    borderRadius: radius.xl, overflow: 'hidden', marginBottom: space.xl,
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
  const blockStyle: React.CSSProperties = {
    padding: '16px 18px', fontSize: font.size.md, color: colors.text,
    lineHeight: 1.7, whiteSpace: 'pre-wrap',
  };

  // ── Loading / Not found / Error ──────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 320, color: colors.textMuted, fontSize: font.size.lg }}>
        Loading daily log...
      </div>
    );
  }

  if (notFound || (!log && !error)) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: colors.textMuted }}>
        <ClipboardText size={40} color={colors.textDim} style={{ marginBottom: 12 }} />
        <div style={{ fontSize: font.size.xl, fontWeight: font.weight.bold, color: colors.text, marginBottom: 8 }}>Daily log not found</div>
        <button onClick={() => router.push('/app/daily-logs')} style={{ ...ghostBtn, margin: '12px auto 0' }}>
          <ArrowLeft size={14} /> Back to Daily Logs
        </button>
      </div>
    );
  }

  if (error && !log) {
    return (
      <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,.1)', border: `1px solid rgba(239,68,68,.3)`, borderRadius: radius.md, color: colors.red, fontSize: font.size.md, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Warning size={16} /> {error}
        </div>
        <button onClick={() => router.push('/app/daily-logs')} style={ghostBtn}>
          <ArrowLeft size={14} /> Back to Daily Logs
        </button>
      </div>
    );
  }

  const l = log as DailyLog;
  const photos = (l.photos ?? l.photo_urls ?? []).filter(Boolean);

  const summaryCards = [
    { l: 'Superintendent', v: l.superintendent || '—', icon: <HardHat size={16} color={colors.gold} /> },
    { l: 'Phase of Work', v: l.phase_of_work || '—', icon: <ClipboardText size={16} color={colors.gold} /> },
    { l: 'Weather', v: l.weather || '—', icon: <Sun size={16} color={colors.gold} /> },
    { l: 'Temp High / Low', v: tempStr(l.high_temp, l.low_temp), icon: <Thermometer size={16} color={colors.gold} /> },
    { l: 'Precipitation', v: l.precipitation || '—', icon: <CloudRain size={16} color={colors.gold} /> },
    { l: 'Wind', v: l.wind_conditions || '—', icon: <Wind size={16} color={colors.gold} /> },
    { l: 'Crew', v: l.crew_count != null ? String(l.crew_count) : '0', icon: <UsersThree size={16} color={colors.gold} /> },
  ];

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Back link */}
      <button
        onClick={() => router.push('/app/daily-logs')}
        style={{ background: 'none', border: 'none', color: colors.textMuted, fontSize: font.size.md, cursor: 'pointer', padding: 0, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <ArrowLeft size={14} /> Daily Logs
      </button>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,.1)', border: `1px solid rgba(239,68,68,.3)`, borderRadius: radius.md, color: colors.red, fontSize: font.size.md, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Warning size={16} /> {error}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: font.size['3xl'], fontWeight: font.weight.black, color: colors.text }}>
            {dateStr(l.log_date)}
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: font.size.md, color: colors.textMuted }}>
            {projectName || l.project_id || 'Daily Log'}
          </p>
        </div>
      </div>

      {/* Summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        {summaryCards.map(k => (
          <div key={k.l} style={{ background: colors.raised, border: `1px solid ${colors.border}`, borderRadius: radius.xl, padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: font.size.xs, fontWeight: font.weight.bold, textTransform: 'uppercase', letterSpacing: 0.5, color: colors.textMuted, marginBottom: 6 }}>
              {k.icon} {k.l}
            </div>
            <div style={{ fontSize: font.size['2xl'], fontWeight: font.weight.black, color: colors.text }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Work Performed */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}><ClipboardText size={16} color={colors.textMuted} /> Work Performed</div>
        <div style={{ ...blockStyle, color: l.work_performed ? colors.text : colors.textDim }}>
          {l.work_performed || 'No work recorded for this day.'}
        </div>
      </div>

      {/* Equipment On Site (mobile-app column) — only shown when recorded */}
      {l.equipment && (
        <div style={cardStyle}>
          <div style={cardHeaderStyle}><Wrench size={16} color={colors.textMuted} /> Equipment On Site</div>
          <div style={blockStyle}>{l.equipment}</div>
        </div>
      )}

      {/* Delays */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}><HourglassMedium size={16} color={colors.textMuted} /> Delays</div>
        <div style={{ ...blockStyle, color: l.delays ? colors.orange : colors.textDim }}>
          {l.delays || 'No delays reported.'}
        </div>
      </div>

      {/* Safety Notes */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}><ShieldCheck size={16} color={colors.textMuted} /> Safety Notes</div>
        <div style={{ ...blockStyle, color: l.safety_notes ? colors.text : colors.green }}>
          {l.safety_notes || 'No safety issues reported.'}
        </div>
      </div>

      {/* Materials & Visitors */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}><Package size={16} color={colors.textMuted} /> Materials &amp; Visitors</div>
        <div style={{ padding: '16px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
          {[
            { l: 'Materials Delivered', v: l.materials_delivered || '—', icon: <Package size={14} color={colors.textDim} /> },
            { l: 'Visitors', v: l.visitors || '—', icon: <UserCircle size={14} color={colors.textDim} /> },
          ].map(f => (
            <div key={f.l}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: font.size.xs, fontWeight: font.weight.bold, textTransform: 'uppercase', letterSpacing: 0.5, color: colors.textMuted, marginBottom: 4 }}>
                {f.icon} {f.l}
              </div>
              <div style={{ fontSize: font.size.md, color: colors.text, wordBreak: 'break-word' }}>{f.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      {l.notes && (
        <div style={cardStyle}>
          <div style={cardHeaderStyle}><NotePencil size={16} color={colors.textMuted} /> Notes</div>
          <div style={blockStyle}>{l.notes}</div>
        </div>
      )}

      {/* Photos (rendered only when the row carries a photo array) */}
      {photos.length > 0 && (
        <div style={cardStyle}>
          <div style={cardHeaderStyle}><ImageSquare size={16} color={colors.textMuted} /> Photos</div>
          <div style={{ padding: '16px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            {photos.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <a key={i} href={src} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                <img
                  src={src}
                  alt={`Daily log photo ${i + 1}`}
                  style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: radius.lg, border: `1px solid ${colors.border}`, display: 'block' }}
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Meta */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>Meta</div>
        <div style={{ padding: '16px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
          {[
            { l: 'Project', v: projectName || l.project_id || '—' },
            { l: 'Log Date', v: dateStr(l.log_date) },
            { l: 'Created', v: dateStr(l.created_at) },
          ].map(f => (
            <div key={f.l}>
              <div style={{ fontSize: font.size.xs, fontWeight: font.weight.bold, textTransform: 'uppercase', letterSpacing: 0.5, color: colors.textMuted, marginBottom: 4 }}>{f.l}</div>
              <div style={{ fontSize: font.size.md, color: colors.text, wordBreak: 'break-word' }}>{f.v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
