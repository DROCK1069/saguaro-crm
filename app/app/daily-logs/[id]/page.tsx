'use client';
/**
 * Daily Log Detail — wired to GET /api/daily-logs/[id].
 * Renders a single field daily log (date, weather, temps, crew, work performed,
 * delays, safety notes, materials, visitors, notes, photos).
 *
 * Machined to the premium kit standard (components/ui/premium): PremiumSurface
 * wrapper, hero-lite ModuleHero (module accent 'daily' on the eyebrow/chips
 * only), StatStrip conditions band, and a SectionCard per log section.
 * Auth is cookie-based via getUser on the route, so a plain same-origin fetch
 * carries the session.
 *
 * API surface:
 *   GET /api/daily-logs/[id] -> { log }
 *
 * Note: the daily_logs table stores temperatures as high_temp / low_temp; this
 * page reads those columns (the GET route returns raw rows). Photos are rendered
 * defensively only when the row carries a photos/photo_urls array.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { humanError } from '@/lib/errors';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Warning, ClipboardText, Sun, Thermometer, UsersThree,
  HourglassMedium, ShieldCheck, Package, UserCircle, NotePencil, ImageSquare,
  HardHat, Wrench, CloudRain, Wind, Info,
} from '@phosphor-icons/react';
import { PremiumSurface, ModuleHero, SectionCard, PremiumEmpty, StatStrip, ghostButtonStyle } from '@/components/ui/premium';
import { moduleAccent } from '@/lib/module-identity';
import { ModuleSkeleton } from '@/components/ui/PageSkeleton';

const ACCENT = moduleAccent('daily'); // sun amber — chips, eyebrow, section markers only
const TEXT = '#FFFFFF';
const DIM = 'rgba(255,255,255,0.62)';
const FAINT = 'rgba(255,255,255,0.45)';
const RED = '#EF4444';
const GREEN = '#22C55E';
const ORANGE = '#F97316';
const HAIRLINE = 'rgba(255,255,255,0.08)';

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
      console.error(e); setError(humanError(e, 'Failed to load the daily log. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadLog(); }, [loadLog]);

  // ── Shared bits ──────────────────────────────────────────────────────────
  const backBtn = (
    <button onClick={() => router.push('/app/daily-logs')} style={{ ...ghostButtonStyle, padding: '8px 14px', fontSize: 12.5 }}>
      <ArrowLeft size={14} /> Daily Logs
    </button>
  );
  const proseStyle: React.CSSProperties = {
    fontSize: 13.5, color: TEXT, lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0,
  };
  const labelStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 800,
    textTransform: 'uppercase', letterSpacing: '0.09em', color: FAINT, marginBottom: 5,
  };

  // ── Loading / Not found / Error ──────────────────────────────────────────
  if (loading) {
    return (
      <PremiumSurface maxWidth={1100}>
        <ModuleSkeleton kpis={0} rows={6} />
      </PremiumSurface>
    );
  }

  if (notFound || (!log && !error)) {
    return (
      <PremiumSurface maxWidth={1100}>
        <SectionCard flush>
          <PremiumEmpty
            icon={<ClipboardText size={30} weight="duotone" color={ACCENT.hex} />}
            title="Daily log not found"
            description="This log may have been deleted, or the link is stale."
            action={backBtn}
          />
        </SectionCard>
      </PremiumSurface>
    );
  }

  if (error && !log) {
    return (
      <PremiumSurface maxWidth={1100}>
        <SectionCard flush>
          <PremiumEmpty
            tone="error"
            icon={<Warning size={30} weight="duotone" color={RED} />}
            title="Failed to load the daily log"
            description={error}
            action={backBtn}
          />
        </SectionCard>
      </PremiumSurface>
    );
  }

  const l = log as DailyLog;
  const photos = (l.photos ?? l.photo_urls ?? []).filter(Boolean);

  const conditions = [
    { label: 'Superintendent', value: l.superintendent || '—', icon: <HardHat size={12} weight="fill" color={ACCENT.hex} /> },
    { label: 'Phase of Work', value: l.phase_of_work || '—', icon: <ClipboardText size={12} weight="fill" color={ACCENT.hex} /> },
    { label: 'Weather', value: l.weather || '—', icon: <Sun size={12} weight="fill" color={ACCENT.hex} /> },
    { label: 'Temp High / Low', value: tempStr(l.high_temp, l.low_temp), icon: <Thermometer size={12} weight="fill" color={ACCENT.hex} /> },
    { label: 'Precipitation', value: l.precipitation || '—', icon: <CloudRain size={12} weight="fill" color={ACCENT.hex} /> },
    { label: 'Wind', value: l.wind_conditions || '—', icon: <Wind size={12} weight="fill" color={ACCENT.hex} /> },
    { label: 'Crew', value: l.crew_count != null ? String(l.crew_count) : '0', sub: 'on site', icon: <UsersThree size={12} weight="fill" color={ACCENT.hex} /> },
  ];

  return (
    <PremiumSurface maxWidth={1100}>
      {/* Back link */}
      <button
        onClick={() => router.push('/app/daily-logs')}
        style={{ background: 'none', border: 'none', color: DIM, fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <ArrowLeft size={14} /> Daily Logs
      </button>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,.1)', border: `1px solid rgba(239,68,68,.3)`, borderRadius: 12, color: RED, fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Warning size={16} /> {error}
        </div>
      )}

      {/* Hero-lite */}
      <ModuleHero
        eyebrow="Field Report"
        eyebrowIcon={<ClipboardText size={13} weight="fill" color={ACCENT.hex} />}
        title={dateStr(l.log_date)}
        subtitle={projectName || l.project_id || 'Daily Log'}
        style={{ marginBottom: 22 }}
      />

      {/* Conditions band */}
      <StatStrip items={conditions} />

      {/* Work Performed */}
      <SectionCard
        title="Work Performed"
        icon={<ClipboardText size={16} weight="duotone" color={ACCENT.hex} />}
        accent={ACCENT.hex}
        style={{ marginBottom: 16 }}
      >
        <p style={{ ...proseStyle, color: l.work_performed ? TEXT : FAINT }}>
          {l.work_performed || 'No work recorded for this day.'}
        </p>
      </SectionCard>

      {/* Equipment On Site (mobile-app column) — only shown when recorded */}
      {l.equipment && (
        <SectionCard
          title="Equipment On Site"
          icon={<Wrench size={16} weight="duotone" color={ACCENT.hex} />}
          accent={ACCENT.hex}
          style={{ marginBottom: 16 }}
        >
          <p style={proseStyle}>{l.equipment}</p>
        </SectionCard>
      )}

      {/* Delays */}
      <SectionCard
        title="Delays"
        icon={<HourglassMedium size={16} weight="duotone" color={ACCENT.hex} />}
        accent={ACCENT.hex}
        style={{ marginBottom: 16 }}
      >
        <p style={{ ...proseStyle, color: l.delays ? ORANGE : FAINT }}>
          {l.delays || 'No delays reported.'}
        </p>
      </SectionCard>

      {/* Safety Notes */}
      <SectionCard
        title="Safety Notes"
        icon={<ShieldCheck size={16} weight="duotone" color={ACCENT.hex} />}
        accent={ACCENT.hex}
        style={{ marginBottom: 16 }}
      >
        <p style={{ ...proseStyle, color: l.safety_notes ? TEXT : GREEN }}>
          {l.safety_notes || 'No safety issues reported.'}
        </p>
      </SectionCard>

      {/* Materials & Visitors */}
      <SectionCard
        title={'Materials & Visitors'}
        icon={<Package size={16} weight="duotone" color={ACCENT.hex} />}
        accent={ACCENT.hex}
        style={{ marginBottom: 16 }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
          {[
            { l: 'Materials Delivered', v: l.materials_delivered || '—', icon: <Package size={12} color={FAINT} /> },
            { l: 'Visitors', v: l.visitors || '—', icon: <UserCircle size={12} color={FAINT} /> },
          ].map(f => (
            <div key={f.l}>
              <div style={labelStyle}>{f.icon} {f.l}</div>
              <div style={{ fontSize: 13.5, color: TEXT, wordBreak: 'break-word', lineHeight: 1.55 }}>{f.v}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Notes */}
      {l.notes && (
        <SectionCard
          title="Notes"
          icon={<NotePencil size={16} weight="duotone" color={ACCENT.hex} />}
          accent={ACCENT.hex}
          style={{ marginBottom: 16 }}
        >
          <p style={proseStyle}>{l.notes}</p>
        </SectionCard>
      )}

      {/* Photos (rendered only when the row carries a photo array) */}
      {photos.length > 0 && (
        <SectionCard
          title="Photos"
          subtitle={`${photos.length} attached`}
          icon={<ImageSquare size={16} weight="duotone" color={ACCENT.hex} />}
          accent={ACCENT.hex}
          style={{ marginBottom: 16 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            {photos.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <a key={i} href={src} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                <img
                  src={src}
                  alt={`Daily log photo ${i + 1}`}
                  style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 12, border: `1px solid ${HAIRLINE}`, display: 'block' }}
                />
              </a>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Meta */}
      <SectionCard
        title="Meta"
        icon={<Info size={16} weight="duotone" color={ACCENT.hex} />}
        accent={ACCENT.hex}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
          {[
            { l: 'Project', v: projectName || l.project_id || '—' },
            { l: 'Log Date', v: dateStr(l.log_date) },
            { l: 'Created', v: dateStr(l.created_at) },
          ].map(f => (
            <div key={f.l}>
              <div style={labelStyle}>{f.l}</div>
              <div style={{ fontSize: 13.5, color: TEXT, wordBreak: 'break-word' }}>{f.v}</div>
            </div>
          ))}
        </div>
      </SectionCard>
    </PremiumSurface>
  );
}
