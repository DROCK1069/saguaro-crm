'use client';
/**
 * Saguaro Control Systems — Field Clock In / Out
 *
 * SERVER IS THE TRUTH. This screen owns no clock state of its own: on-clock
 * status, elapsed shift, and hours all come from GET /api/timeclock/status,
 * and punches go through POST /api/timeclock/in | /api/timeclock/out, which
 * write the canonical `time_entries` row (plus the clock_punches audit trail).
 *
 * Deliberately absent:
 *   - /api/clock/* (wrote timesheet_entries with the anon key; every insert was
 *     rejected by RLS and clock-out returned a fake `demo:true` success).
 *   - localStorage as the source of truth for on-clock state.
 *   - client-computed hours posted to the server.
 *   - offline queueing of punches — a queued punch cannot be reconciled against
 *     server-side open-shift detection, and this screen never claims a success
 *     the server did not give it.
 */
import React, { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CSI_DIVISIONS } from '@/lib/construction-intelligence';
import FieldPageHeader from '../FieldPageHeader';
import { scopedFieldIcon } from '../field-icons';
import {
  getCurrentPosition,
  hapticSuccess,
  hapticError,
  hapticMedium,
  showToast,
  onAppResume,
} from '@/lib/native';

// ─── Canonical contract types (app/api/timeclock/*) ──────────────────────────

interface Shift {
  id: string;
  projectId: string | null;
  workDate: string;
  clockIn: string;
  clockOut: string | null;
  status: string;
  timezone: string | null;
  costCodeId: string | null;
  csiDivision: string | null;
  hoursWorked: number | null;
  mealBreakMins: number | null;
}

interface StatusPayload {
  onClock: boolean;
  shift: Shift | null;
  todayHours: number;
  weekHours: number;
  employee: { id: string; name: string } | null;
  /** Optional — rendered only if the server actually sends it. */
  recentShifts?: Shift[];
}

interface ClockOutPayload {
  ok: true;
  shift: Shift;
  hours: { worked: number; regular: number; overtime: number; doubletime: number };
}

interface ProjectRow { id: string; name: string }
interface CostCodeRow { id: string; code: string; name: string }

type Banner = { tone: 'ok' | 'warn' | 'error'; text: string };
type GpsState = 'idle' | 'getting' | 'ok' | 'unavailable';

// ─── Cost-code select encoding ───────────────────────────────────────────────
// One glove-friendly picker feeds two contract fields. Project cost codes are
// sent as costCodeId; CSI divisions as csiDivision.
const CC_PREFIX = 'cc:';
const CSI_PREFIX = 'csi:';

// ─── Formatting ──────────────────────────────────────────────────────────────

const pad = (n: number) => n.toString().padStart(2, '0');

/** HH:MM:SS — the big ticking shift clock. */
function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

function formatTime(iso: string | null): string {
  if (!iso) return '--';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '--' : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatDayLabel(workDate: string | null): string {
  if (!workDate) return '';
  const d = new Date(`${workDate}T12:00:00`);
  return isNaN(d.getTime()) ? workDate : d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

const hrs = (n: number | null | undefined) => `${(Number(n) || 0).toFixed(2)}h`;

/** Pull the server's real message off a non-2xx response — never invent one. */
async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    const msg = body && typeof body.error === 'string' ? body.error.trim() : '';
    if (msg) return msg;
  } catch {
    /* body was not JSON — fall through to the status line */
  }
  return `${fallback} (HTTP ${res.status})`;
}

function netMessage(e: unknown): string {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'No connection. The punch was NOT recorded — reconnect and try again.';
  }
  return e instanceof Error && e.message ? e.message : 'Could not reach the server. The punch was NOT recorded.';
}

// ─── Page ────────────────────────────────────────────────────────────────────

function ClockPage() {
  const searchParams = useSearchParams();
  const urlProjectId = searchParams.get('projectId') || '';

  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [banner, setBanner] = useState<Banner | null>(null);

  const [pending, setPending] = useState<'in' | 'out' | null>(null);
  const inFlight = useRef(false);

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [costCodes, setCostCodes] = useState<CostCodeRow[]>([]);
  const [projectId, setProjectId] = useState(urlProjectId);
  const [costSel, setCostSel] = useState('');
  const [mealBreak, setMealBreak] = useState('0');

  const [gps, setGps] = useState<GpsState>('idle');
  const [online, setOnline] = useState(true);
  const [tick, setTick] = useState(() => Date.now());

  // ─── Server status — the single source of truth ────────────────────────────

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await fetch('/api/timeclock/status', { cache: 'no-store' });
      if (res.status === 401) {
        setLoadError('Your session has expired. Sign in again to use the clock.');
        return;
      }
      if (!res.ok) throw new Error(await readError(res, 'Could not load your clock status.'));
      const data = (await res.json()) as StatusPayload;
      setStatus(data);
      setLoadError('');
    } catch (e) {
      // Keep the last known server truth on screen rather than blanking it —
      // but say plainly that this view may be stale.
      setLoadError(netMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Re-sync whenever the screen comes back to the user.
  useEffect(() => {
    const refresh = () => { void load(true); };
    const onVis = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVis);
    const offResume = onAppResume(refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVis);
      offResume();
    };
  }, [load]);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  const shift = status?.onClock ? status.shift : null;
  const onClock = shift !== null;

  // One-second tick, only while a shift is open. Keyed on the clock-in stamp so
  // a background status refresh does not churn the interval.
  const shiftStart = shift?.clockIn ?? null;
  useEffect(() => {
    if (!shiftStart) return;
    setTick(Date.now());
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [shiftStart]);

  // ─── Pickers ───────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/projects/list')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const rows: ProjectRow[] = (d?.projects || [])
          .filter((p: { id?: string; name?: string }) => p?.id)
          .map((p: { id: string; name?: string }) => ({ id: p.id, name: p.name || 'Untitled project' }));
        setProjects(rows);
      })
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    if (!projectId) { setCostCodes([]); return; }
    let cancelled = false;
    fetch(`/api/cost-codes/list?projectId=${encodeURIComponent(projectId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        const rows: CostCodeRow[] = (d?.costCodes || [])
          .filter((c: { id?: string; is_active?: boolean | null }) => c?.id && c.is_active !== false)
          .map((c: { id: string; code?: string; name?: string }) => ({
            id: c.id, code: c.code || '', name: c.name || 'Cost code',
          }));
        setCostCodes(rows);
      })
      .catch(() => { if (!cancelled) setCostCodes([]); });
    return () => { cancelled = true; };
  }, [projectId]);

  const projectName = useCallback(
    (id: string | null) => (id ? projects.find((p) => p.id === id)?.name || 'Project' : ''),
    [projects],
  );

  /** Human label for whatever cost code the OPEN shift actually carries. */
  const shiftCostLabel = useMemo(() => {
    if (!shift) return '';
    if (shift.csiDivision) {
      return `Div ${shift.csiDivision} — ${CSI_DIVISIONS[shift.csiDivision]?.name || 'cost coded'}`;
    }
    if (shift.costCodeId) {
      const cc = costCodes.find((c) => c.id === shift.costCodeId);
      return cc ? `${cc.code} — ${cc.name}` : 'Cost coded';
    }
    return '';
  }, [shift, costCodes]);

  // ─── GPS — best effort, never blocks the punch ─────────────────────────────

  const captureGps = useCallback(async (): Promise<{ lat: number; lng: number } | null> => {
    setGps('getting');
    let timer: ReturnType<typeof setTimeout> | undefined;
    const bail = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), 5000); });
    try {
      const pos = await Promise.race([getCurrentPosition(5000).catch(() => null), bail]);
      if (pos) { setGps('ok'); return { lat: pos.lat, lng: pos.lng }; }
      setGps('unavailable');
      return null;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }, []);

  // ─── Punches ───────────────────────────────────────────────────────────────

  const clockIn = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending('in');
    setBanner(null);
    hapticMedium().catch(() => {});

    const coords = await captureGps();
    const costCodeId = costSel.startsWith(CC_PREFIX) ? costSel.slice(CC_PREFIX.length) : undefined;
    const csiDivision = costSel.startsWith(CSI_PREFIX) ? costSel.slice(CSI_PREFIX.length) : undefined;

    try {
      const res = await fetch('/api/timeclock/in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectId || undefined,
          costCodeId,
          csiDivision,
          lat: coords?.lat,
          lng: coords?.lng,
          clientTime: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error(await readError(res, 'Clock-in failed.'));
      const data = (await res.json()) as { ok: true; shift: Shift; alreadyOpen: boolean };

      setStatus((prev) => (prev ? { ...prev, onClock: true, shift: data.shift } : prev));
      if (data.alreadyOpen) {
        setBanner({ tone: 'warn', text: `You were already on the clock since ${formatTime(data.shift.clockIn)} — no second shift was started.` });
      } else {
        setBanner({ tone: 'ok', text: `On the clock since ${formatTime(data.shift.clockIn)}${coords ? '' : ' — no GPS on this punch'}.` });
        hapticSuccess().catch(() => {});
        showToast('Clocked in').catch(() => {});
      }
      await load(true);
    } catch (e) {
      hapticError().catch(() => {});
      setBanner({ tone: 'error', text: netMessage(e) });
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }, [captureGps, costSel, projectId, load]);

  const clockOut = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending('out');
    setBanner(null);
    hapticMedium().catch(() => {});

    const coords = await captureGps();
    const breakMinutes = Math.max(0, Math.floor(Number(mealBreak) || 0));

    try {
      const res = await fetch('/api/timeclock/out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftId: shift?.id,
          breakMinutes,
          lat: coords?.lat,
          lng: coords?.lng,
          clientTime: new Date().toISOString(),
        }),
      });

      if (res.status === 409) {
        const msg = await readError(res, 'You are not on the clock.');
        hapticError().catch(() => {});
        setBanner({ tone: 'error', text: `${msg} Your clock has been re-synced from the server.` });
        await load(true);
        return;
      }
      if (!res.ok) throw new Error(await readError(res, 'Clock-out failed.'));

      const data = (await res.json()) as ClockOutPayload;
      setStatus((prev) => (prev ? { ...prev, onClock: false, shift: null } : prev));
      const ot = data.hours.overtime > 0 ? ` · ${hrs(data.hours.overtime)} OT` : '';
      const dt = data.hours.doubletime > 0 ? ` · ${hrs(data.hours.doubletime)} DT` : '';
      setBanner({ tone: 'ok', text: `Clocked out — ${hrs(data.hours.worked)} logged${ot}${dt}.` });
      hapticSuccess().catch(() => {});
      showToast(`${hrs(data.hours.worked)} logged`).catch(() => {});
      setMealBreak('0');
      await load(true);
    } catch (e) {
      hapticError().catch(() => {});
      setBanner({ tone: 'error', text: netMessage(e) });
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }, [captureGps, mealBreak, shift, load]);

  // ─── Render ────────────────────────────────────────────────────────────────

  const gpsLine =
    gps === 'ok' ? 'GPS captured on this punch'
      : gps === 'getting' ? 'Getting location…'
        : gps === 'unavailable' ? 'No GPS on this punch — location unavailable'
          : 'GPS is captured when you punch';

  const recent = status?.recentShifts?.filter((s) => s && s.id) ?? [];

  return (
    <div className="fc-wrap">
      <FieldPageHeader
        title="Clock In / Out"
        subtitle="Server-verified time · GPS stamped"
        icon={scopedFieldIcon('clockIn', 'ph')}
      />

      {!online && (
        <div className="fc-note fc-note-error" role="status">
          Offline — punches need a connection. Nothing is queued, so nothing can be lost or duplicated.
        </div>
      )}

      {loadError && (
        <div className="fc-note fc-note-error" role="alert">
          <span>{loadError}</span>
          <button className="fc-retry" onClick={() => { void load(); }}>Retry</button>
        </div>
      )}

      {banner && (
        <div
          className={`fc-note ${banner.tone === 'ok' ? 'fc-note-ok' : banner.tone === 'warn' ? 'fc-note-warn' : 'fc-note-error'}`}
          role={banner.tone === 'error' ? 'alert' : 'status'}
        >
          {banner.text}
        </div>
      )}

      {loading && !status ? (
        <div className="fc-card fc-center">
          <p className="fc-muted">Checking your clock with the server…</p>
        </div>
      ) : !status ? (
        <div className="fc-card fc-center">
          <p className="fc-muted">Your clock status is unavailable right now. Nothing has been punched.</p>
          <button className="fc-secondary" onClick={() => { void load(); }}>Try again</button>
        </div>
      ) : onClock && shift ? (
        /* ═══ ON THE CLOCK ═══ */
        <div className="fc-card fc-card-live">
          <div className="fc-live-row">
            <span className="fc-dot" />
            <span className="fc-live-label">On the clock</span>
          </div>

          <p className="fc-timer" aria-live="off">{formatElapsed(tick - new Date(shift.clockIn).getTime())}</p>
          <p className="fc-since">
            Since {formatTime(shift.clockIn)}
            {shift.workDate ? ` · ${formatDayLabel(shift.workDate)}` : ''}
          </p>

          <div className="fc-chips">
            <span className="fc-chip">{shift.projectId ? projectName(shift.projectId) : 'No project on this shift'}</span>
            {shiftCostLabel
              ? <span className="fc-chip fc-chip-gold">{shiftCostLabel}</span>
              : <span className="fc-chip">No cost code on this shift</span>}
            {status.employee && <span className="fc-chip">{status.employee.name}</span>}
          </div>

          <div className="fc-break">
            <span className="fc-break-label">Meal break</span>
            <div className="fc-break-picks">
              {['0', '30', '60'].map((m) => (
                <button
                  key={m}
                  className={`fc-break-pick${mealBreak === m ? ' is-on' : ''}`}
                  onClick={() => setMealBreak(m)}
                  disabled={pending !== null}
                >
                  {m === '0' ? 'None' : `${m}m`}
                </button>
              ))}
              <input
                className="fc-break-input"
                type="number"
                inputMode="numeric"
                min={0}
                max={480}
                value={mealBreak}
                onChange={(e) => setMealBreak(e.target.value)}
                disabled={pending !== null}
                aria-label="Meal break minutes"
              />
              <span className="fc-break-unit">min</span>
            </div>
          </div>

          <p className="fc-gps">{gpsLine}</p>

          <button
            className="fc-big fc-big-out"
            onClick={() => { void clockOut(); }}
            disabled={pending !== null}
          >
            {pending === 'out' ? 'Clocking out…' : 'Clock Out'}
          </button>
        </div>
      ) : (
        /* ═══ OFF THE CLOCK ═══ */
        <div className="fc-card">
          <p className="fc-off-label">Off the clock</p>
          <p className="fc-off-name">{status.employee ? status.employee.name : 'Signed in — your employee record will be linked on your first punch'}</p>

          <label className="fc-label" htmlFor="fc-project">Project</label>
          <select
            id="fc-project"
            className="fc-select"
            value={projectId}
            onChange={(e) => { setProjectId(e.target.value); setCostSel(''); }}
            disabled={pending !== null}
          >
            <option value="">No project</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <label className="fc-label" htmlFor="fc-cost">Cost code</label>
          <select
            id="fc-cost"
            className="fc-select"
            value={costSel}
            onChange={(e) => setCostSel(e.target.value)}
            disabled={pending !== null}
          >
            <option value="">No cost code</option>
            {costCodes.length > 0 && (
              <optgroup label="Project cost codes">
                {costCodes.map((c) => (
                  <option key={c.id} value={`${CC_PREFIX}${c.id}`}>{c.code ? `${c.code} — ${c.name}` : c.name}</option>
                ))}
              </optgroup>
            )}
            <optgroup label="CSI divisions">
              {Object.entries(CSI_DIVISIONS).map(([code, d]) => (
                <option key={code} value={`${CSI_PREFIX}${code}`}>Div {code} — {d.name}</option>
              ))}
            </optgroup>
          </select>

          {!projectId && <p className="fc-warnline">No project selected — these hours will not land on a job budget.</p>}

          <p className="fc-gps">{gpsLine}</p>

          <button
            className="fc-big fc-big-in"
            onClick={() => { void clockIn(); }}
            disabled={pending !== null}
          >
            {pending === 'in' ? 'Clocking in…' : 'Clock In'}
          </button>
        </div>
      )}

      {status && (
        <div className="fc-hours">
          <div className="fc-hour-cell">
            <span className="fc-hour-k">Today</span>
            <span className="fc-hour-v">{hrs(status.todayHours)}</span>
          </div>
          <div className="fc-hour-cell">
            <span className="fc-hour-k">This week</span>
            <span className="fc-hour-v">{hrs(status.weekHours)}</span>
          </div>
        </div>
      )}

      {recent.length > 0 && (
        <div className="fc-card fc-recent">
          <p className="fc-recent-h">Recent shifts</p>
          {recent.map((s) => (
            <div key={s.id} className="fc-recent-row">
              <div className="fc-recent-l">
                <p className="fc-recent-d">{formatDayLabel(s.workDate)}</p>
                <p className="fc-recent-t">
                  {formatTime(s.clockIn)} – {s.clockOut ? formatTime(s.clockOut) : 'still open'}
                  {s.projectId ? ` · ${projectName(s.projectId)}` : ''}
                </p>
              </div>
              <span className="fc-recent-h2">{s.clockOut ? hrs(s.hoursWorked) : 'open'}</span>
            </div>
          ))}
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .fc-wrap { padding: 0 16px 28px; max-width: 640px; margin: 0 auto; }
        .fc-card { background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: var(--radius-xl); padding: 22px 18px; margin-bottom: 14px; box-shadow: var(--shadow-md); }
        .fc-card-live { border: 2px solid var(--success); text-align: center; }
        .fc-center { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 14px; }
        .fc-muted { margin: 0; font-size: 14px; color: var(--text-secondary); }

        .fc-note { border-radius: var(--radius-md); padding: 12px 14px; margin-bottom: 12px; font-size: 13.5px; font-weight: 600; line-height: 1.45; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .fc-note-ok    { background: rgba(34,197,94,0.10);  border: 1px solid rgba(34,197,94,0.30);  color: var(--success); }
        .fc-note-warn  { background: var(--gold-soft);      border: 1px solid var(--gold-ring);      color: var(--gold-bright); }
        .fc-note-error { background: rgba(239,68,68,0.10);  border: 1px solid rgba(239,68,68,0.30);  color: var(--danger); }
        .fc-retry, .fc-secondary { background: transparent; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); padding: 8px 14px; color: var(--text-primary); font-size: 13px; font-weight: 700; cursor: pointer; flex-shrink: 0; min-height: 40px; }

        .fc-live-row { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 10px; }
        .fc-dot { width: 12px; height: 12px; border-radius: 50%; background: var(--success); box-shadow: 0 0 12px var(--success); animation: fcPulse 2s infinite; }
        .fc-live-label { font-size: 12px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--success); }
        @keyframes fcPulse { 0%,100% { opacity: 1 } 50% { opacity: .35 } }

        .fc-timer { margin: 0; font-size: 54px; line-height: 1.05; font-weight: 800; letter-spacing: -0.02em; color: var(--text-primary); font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }
        .fc-since { margin: 6px 0 14px; font-size: 13px; color: var(--text-secondary); }

        .fc-chips { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin-bottom: 16px; }
        .fc-chip { background: var(--bg-surface-2); border: 1px solid var(--border-default); border-radius: var(--radius-pill); padding: 6px 12px; font-size: 12px; font-weight: 600; color: var(--text-secondary); }
        .fc-chip-gold { background: var(--gold-soft); border-color: var(--gold-ring); color: var(--gold-bright); }

        .fc-break { background: var(--bg-surface-2); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 12px; margin-bottom: 14px; }
        .fc-break-label { display: block; font-size: 10.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-tertiary); margin-bottom: 8px; }
        .fc-break-picks { display: flex; align-items: center; justify-content: center; gap: 6px; flex-wrap: wrap; }
        .fc-break-pick { min-height: 44px; min-width: 60px; background: transparent; border: 1px solid var(--border-default); border-radius: var(--radius-md); color: var(--text-secondary); font-size: 14px; font-weight: 700; cursor: pointer; padding: 0 12px; }
        .fc-break-pick.is-on { background: var(--gold-soft); border-color: var(--gold-ring); color: var(--gold-bright); }
        .fc-break-pick:disabled { opacity: .5; cursor: not-allowed; }
        .fc-break-input { width: 74px; min-height: 44px; background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: var(--radius-md); color: var(--text-primary); font-size: 15px; text-align: center; outline: none; }
        .fc-break-unit { font-size: 13px; color: var(--text-secondary); }

        .fc-gps { margin: 0 0 16px; font-size: 12px; color: var(--text-tertiary); text-align: center; }

        .fc-big { width: 100%; min-height: 84px; border: none; border-radius: var(--radius-xl); font-size: 21px; font-weight: 900; letter-spacing: 0.02em; cursor: pointer; transition: transform .08s ease, filter .12s ease; -webkit-tap-highlight-color: transparent; }
        .fc-big:active:not(:disabled) { transform: scale(0.985); filter: brightness(0.92); }
        .fc-big:disabled { opacity: .62; cursor: progress; }
        .fc-big-in  { background: var(--success); color: #06210F; }
        .fc-big-out { background: var(--danger);  color: #FFFFFF; }

        .fc-off-label { margin: 0 0 4px; font-size: 12px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-tertiary); }
        .fc-off-name { margin: 0 0 18px; font-size: 18px; font-weight: 700; color: var(--text-primary); }
        .fc-label { display: block; font-size: 10.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-tertiary); margin-bottom: 6px; }
        .fc-select { width: 100%; min-height: 52px; background: var(--bg-surface-2); border: 1px solid var(--border-default); border-radius: var(--radius-md); padding: 12px 14px; color: var(--text-primary); font-size: 16px; outline: none; margin-bottom: 14px; }
        .fc-select:disabled { opacity: .6; }
        .fc-warnline { margin: -4px 0 14px; font-size: 12.5px; font-weight: 600; color: var(--gold-bright); }

        .fc-hours { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
        .fc-hour-cell { background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: var(--radius-lg); padding: 14px; text-align: center; }
        .fc-hour-k { display: block; font-size: 10.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-tertiary); margin-bottom: 4px; }
        .fc-hour-v { display: block; font-size: 26px; font-weight: 800; color: var(--gold); font-variant-numeric: tabular-nums; }

        .fc-recent { padding: 16px 18px; }
        .fc-recent-h { margin: 0 0 8px; font-size: 10.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-tertiary); }
        .fc-recent-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; border-top: 1px solid var(--border-subtle); }
        .fc-recent-row:first-of-type { border-top: none; }
        .fc-recent-l { min-width: 0; }
        .fc-recent-d { margin: 0; font-size: 14px; font-weight: 700; color: var(--text-primary); }
        .fc-recent-t { margin: 2px 0 0; font-size: 12px; color: var(--text-secondary); }
        .fc-recent-h2 { font-size: 16px; font-weight: 800; color: var(--gold); flex-shrink: 0; font-variant-numeric: tabular-nums; }

        @media (min-width: 1000px) { .fc-wrap { padding: 0 28px 32px; } }
      ` }} />
    </div>
  );
}

export default function FieldClockPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32, color: 'var(--text-secondary)', textAlign: 'center' }}>Loading…</div>}>
      <ClockPage />
    </Suspense>
  );
}
