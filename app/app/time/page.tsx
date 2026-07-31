'use client';
/**
 * Time Clock (web) — real clock in/out wired to time_entries (timezone + GPS),
 * a weekly timesheet from the shared deterministic lib/timeclock engine (same as
 * iOS), PTO/sick logging, and manual add/edit. Resolves the signed-in user's
 * employees row by email. RLS-scoped browser client.
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { humanError } from '@/lib/errors';
import { getSupabaseBrowser, ensureBrowserSession } from '@/lib/supabase-browser';
import { computeTimesheet, weekKey, fmtHours, liveElapsed, type TimeEntry } from '@/lib/timeclock';
import { Clock, Play, Stop, Plus, Trash, PaperPlaneRight, Sun, Bandaids } from '@phosphor-icons/react';

const GOLD = '#F59E0B', DARK = '#0a0a0a', RAISED = '#141416', BORDER = 'rgba(255,255,255,0.12)';
const DIM = '#CBD5E1', TEXT = '#FFFFFF', GREEN = '#3dd68c', RED = '#ef4444';
/* eslint-disable @typescript-eslint/no-explicit-any */
const TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; } })();
const localDay = (d = new Date()) => { const o = d.getTimezoneOffset() * 60000; return new Date(d.getTime() - o).toISOString().slice(0, 10); };
const fmtTime = (iso: string | null) => { if (!iso) return '--'; const d = new Date(iso); return isNaN(d.getTime()) ? '--' : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
const fmtDate = (s: string) => { const d = new Date(s + 'T12:00:00'); return isNaN(d.getTime()) ? s : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); };
const splitOT = (h: number) => ({ regular: Math.min(h, 8), overtime: Math.max(0, h - 8) });
const round2 = (n: number) => Math.round(n * 100) / 100;

async function geo(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((res) => { if (!navigator.geolocation) return res(null); navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res(null), { timeout: 6000 }); });
}

export default function TimeClockPage() {
  const sb = getSupabaseBrowser();
  const [emp, setEmp] = useState<any>(null);
  const [tenantId, setTenantId] = useState<string>('');
  const [entries, setEntries] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [projectId, setProjectId] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [msg, setMsg] = useState('');
  const [manual, setManual] = useState<any | null>(null);
  const [leave, setLeave] = useState<any | null>(null);

  const loadEntries = useCallback(async (empId: string) => {
    const { data } = await sb.from('time_entries').select('id, project_id, work_date, clock_in, clock_out, hours_worked, regular_hours, overtime_hours, total_hours, status, timezone, entry_type, meal_break_mins').eq('employee_id', empId).order('work_date', { ascending: false }).order('clock_in', { ascending: false }).limit(80);
    setEntries(data ?? []);
  }, [sb]);

  useEffect(() => {
    (async () => {
      await ensureBrowserSession(); // the app auths via server cookies — hydrate the browser client or every query below is signed out
      const { data: { user } } = await sb.auth.getUser();
      sb.from('projects').select('id, name').order('name').then(({ data }) => { setProjects(data ?? []); if (data?.[0]) setProjectId(data[0].id); });
      if (!user?.email) return;
      // Resolve the signed-in user's tenant so every write is tenant-scoped (RLS/NOT NULL) — without
      // this, the employees insert below is silently rejected and the page hangs on "Resolving…".
      const { data: prof } = await sb.from('profiles').select('tenant_id').eq('id', user.id).maybeSingle();
      const tid = (prof as any)?.tenant_id ?? user.id;
      setTenantId(tid);
      let { data: e } = await sb.from('employees').select('id, regular_rate, overtime_rate, full_name, first_name').eq('email', user.email).maybeSingle();
      if (!e) { const ins = await sb.from('employees').insert({ tenant_id: tid, email: user.email, first_name: user.email.split('@')[0], last_name: '—', is_active: true }).select('id, regular_rate, overtime_rate, full_name, first_name').maybeSingle(); e = ins.data; }
      if (e) { setEmp(e); loadEntries(e.id); }
    })();
  }, [sb, loadEntries]);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const openShift = useMemo(() => entries.find((e) => e.status === 'clocked_in') ?? null, [entries]);
  const rates = () => { const reg = Number(emp?.regular_rate ?? 0) || 0; return { regular_rate_used: reg, overtime_rate_used: Number(emp?.overtime_rate ?? 0) || round2(reg * 1.5), doubletime_rate_used: round2(reg * 2) }; };

  // Map rows → engine entries → this week's timesheet.
  const sheet = useMemo(() => {
    const te: TimeEntry[] = entries.map((e) => {
      const worked = !e.entry_type || e.entry_type === 'regular';
      return worked
        ? { id: e.id, employeeId: emp?.id ?? '', projectId: e.project_id, type: 'regular', clockIn: e.clock_in, clockOut: e.clock_out, breakMinutes: e.meal_break_mins || 0, timezone: e.timezone || TZ }
        : { id: e.id, employeeId: emp?.id ?? '', type: e.entry_type, hours: Number(e.total_hours ?? e.hours_worked ?? 8), timezone: e.timezone || TZ, clockIn: (e.work_date || localDay()) + 'T12:00:00' };
    });
    return computeTimesheet(te, { weeklyOtThreshold: 40 });
  }, [entries, emp]);
  const thisWeekKey = weekKey(new Date().toISOString(), TZ, 0);
  const week = sheet.weeks.find((w) => w.weekStart === thisWeekKey) ?? null;
  const todayStr = localDay();
  const todayHours = round2(entries.filter((e) => e.work_date === todayStr && e.clock_out).reduce((s, e) => s + (Number(e.total_hours ?? e.hours_worked ?? 0) || 0), 0));

  const clockIn = async () => {
    if (!emp || !projectId || busy) return; setBusy(true); setMsg('');
    try {
      const nowISO = new Date().toISOString(); const g = await geo();
      await sb.from('time_entries').insert({ tenant_id: tenantId, employee_id: emp.id, project_id: projectId, work_date: localDay(), clock_in: nowISO, status: 'clocked_in', timezone: TZ, entry_type: 'regular', ...(g ? { gps_clock_in: g } : {}) });
      await loadEntries(emp.id); setMsg('Clocked in');
    } catch (e: any) { console.error(e); setMsg(humanError(e, 'Something went wrong. Please try again.')); } setBusy(false);
  };
  const clockOut = async () => {
    if (!openShift || busy) return; setBusy(true);
    try {
      const nowISO = new Date().toISOString(); const g = await geo();
      const meal = Number(openShift.meal_break_mins ?? 30) || 0;
      const gross = Math.max(0, (Date.parse(nowISO) - Date.parse(openShift.clock_in)) / 3600000);
      const hrs = round2(Math.max(0, gross - meal / 60)); const { regular, overtime } = splitOT(hrs);
      await sb.from('time_entries').update({ clock_out: nowISO, hours_worked: hrs, regular_hours: round2(regular), overtime_hours: round2(overtime), meal_break_mins: meal, status: 'pending', ...rates(), ...(g ? { gps_clock_out: g } : {}) }).eq('id', openShift.id);
      await loadEntries(emp.id); setMsg(`Clocked out — ${hrs.toFixed(2)} h`);
    } catch (e: any) { console.error(e); setMsg(humanError(e, 'Something went wrong. Please try again.')); } setBusy(false);
  };

  const saveManual = async () => {
    if (!emp || !manual) return;
    const inISO = new Date(`${manual.date}T${manual.in}:00`).toISOString();
    const outISO = new Date(`${manual.date}T${manual.out}:00`).toISOString();
    const meal = Math.max(0, parseInt(manual.meal) || 0);
    const gross = Math.max(0, (Date.parse(outISO) - Date.parse(inISO)) / 3600000);
    const hrs = round2(Math.max(0, gross - meal / 60)); const { regular, overtime } = splitOT(hrs);
    try {
      if (manual.id) await sb.from('time_entries').update({ work_date: manual.date, clock_in: inISO, clock_out: outISO, hours_worked: hrs, regular_hours: round2(regular), overtime_hours: round2(overtime), meal_break_mins: meal, ...rates() }).eq('id', manual.id);
      else await sb.from('time_entries').insert({ tenant_id: tenantId, employee_id: emp.id, project_id: projectId, work_date: manual.date, clock_in: inISO, clock_out: outISO, hours_worked: hrs, regular_hours: round2(regular), overtime_hours: round2(overtime), meal_break_mins: meal, status: 'pending', timezone: TZ, entry_type: 'regular', ...rates() });
      setManual(null); await loadEntries(emp.id);
    } catch (e: any) { console.error(e); setMsg(humanError(e, 'Something went wrong. Please try again.')); }
  };
  const saveLeave = async () => {
    if (!emp || !leave) return;
    try { await sb.from('time_entries').insert({ tenant_id: tenantId, employee_id: emp.id, work_date: leave.date, entry_type: leave.type, hours_worked: parseFloat(leave.hours) || 8, total_hours: parseFloat(leave.hours) || 8, status: 'pending', timezone: TZ }); setLeave(null); await loadEntries(emp.id); setMsg('Logged'); } catch (e: any) { console.error(e); setMsg(humanError(e, 'Something went wrong. Please try again.')); }
  };
  const del = async (id: string) => { await sb.from('time_entries').delete().eq('id', id); if (emp) loadEntries(emp.id); };
  const submitWeek = async () => {
    if (!week || !emp) return;
    try { await sb.from('timesheets').insert({ tenant_id: tenantId, employee_id: emp.id, employee_name: emp.full_name || emp.first_name, week_ending: localDay(new Date(new Date(thisWeekKey + 'T12:00').getTime() + 6 * 86400000)), hours_regular: week.regularHours, hours_overtime: week.overtimeHours, status: 'submitted', submitted_at: new Date().toISOString() }); setMsg('Week submitted for approval'); } catch (e: any) { console.error(e); setMsg(humanError(e, 'Something went wrong. Please try again.')); }
  };

  const inp: React.CSSProperties = { background: DARK, border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, padding: '9px 11px', fontSize: 14, width: '100%' };
  const btn: React.CSSProperties = { background: GOLD, color: DARK, fontWeight: 700, border: 'none', borderRadius: 8, padding: '10px 18px', cursor: 'pointer', fontSize: 14 };
  const clockedIn = !!openShift;

  return (
    <div style={{ background: DARK, color: TEXT, minHeight: '100vh', fontFamily: 'system-ui,Segoe UI,sans-serif' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 20px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Clock size={26} weight="fill" color={GOLD} />
          <div style={{ flex: 1 }}><h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Time Clock</h1><p style={{ color: DIM, margin: 0, fontSize: 13.5 }}>Timezone-aware, GPS-stamped, with weekly overtime — same engine as the phone.</p></div>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ ...inp, width: 'auto' }}>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        </div>

        {/* status */}
        <div style={{ background: RAISED, border: `1px solid ${clockedIn ? GREEN : BORDER}`, borderRadius: 16, padding: 26, marginTop: 18, textAlign: 'center' }}>
          <div style={{ fontSize: 46, fontWeight: 800, letterSpacing: -1, color: clockedIn ? GREEN : DIM, fontVariantNumeric: 'tabular-nums' }}>
            {clockedIn ? (() => { const h = liveElapsed(openShift.clock_in, new Date(now).toISOString()); const s = Math.floor(h * 3600); return `${Math.floor(s / 3600)}:${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; })() : 'Clocked out'}
          </div>
          <div style={{ color: DIM, fontSize: 13, marginTop: 4 }}>{clockedIn ? `Since ${fmtTime(openShift.clock_in)} · ${openShift.timezone || TZ}` : (emp ? 'Ready to clock in' : 'Resolving your employee record…')}</div>
          <button onClick={clockedIn ? clockOut : clockIn} disabled={busy || !emp} style={{ ...btn, marginTop: 16, background: clockedIn ? RED : GREEN, color: '#fff', fontSize: 16, padding: '13px 26px', display: 'inline-flex', alignItems: 'center', gap: 8, opacity: busy || !emp ? 0.6 : 1 }}>{clockedIn ? <Stop size={20} weight="fill" /> : <Play size={20} weight="fill" />}{clockedIn ? 'Clock out' : 'Clock in'}</button>
          {msg && <div style={{ color: msg.includes('submitted') || msg.includes('Clocked') || msg === 'Logged' ? GREEN : DIM, fontSize: 13, marginTop: 10 }}>{msg}</div>}
        </div>

        {/* week summary */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 16 }}>
          {[['Today', todayHours], ['This week', week?.workedHours ?? 0], ['Overtime', week?.overtimeHours ?? 0]].map(([l, v]) => (
            <div key={l as string} style={{ background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, textAlign: 'center' }}><div style={{ fontSize: 24, fontWeight: 800, color: l === 'Overtime' && (v as number) > 0 ? GOLD : TEXT, fontVariantNumeric: 'tabular-nums' }}>{(v as number).toFixed(2)}</div><div style={{ color: DIM, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>{l} (h)</div></div>
          ))}
        </div>

        {week && (
          <div style={{ background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, marginTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: DIM, fontWeight: 700, letterSpacing: 0.8, flex: 1 }}>WEEK OF {fmtDate(week.weekStart).toUpperCase()} · {week.regularHours.toFixed(2)} REG · {week.overtimeHours.toFixed(2)} OT</div>
              <button onClick={submitWeek} style={{ ...btn, background: 'transparent', color: TEXT, border: `1px solid ${BORDER}`, padding: '6px 12px', fontSize: 13, display: 'inline-flex', gap: 6, alignItems: 'center' }}><PaperPlaneRight size={14} />Submit week</button>
            </div>
            {week.days.map((d) => <div key={d.date} style={{ display: 'flex', padding: '5px 0', borderBottom: `1px solid ${BORDER}`, fontSize: 13.5 }}><span style={{ flex: 1 }}>{fmtDate(d.date)}</span><span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtHours(d.hours)}</span></div>)}
            {Object.keys(week.byType).filter((k) => k !== 'regular').length > 0 && <div style={{ color: DIM, fontSize: 12.5, marginTop: 8 }}>Leave: {Object.entries(week.byType).filter(([k]) => k !== 'regular').map(([k, v]) => `${v}h ${k}`).join(' · ')}</div>}
          </div>
        )}

        {/* actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <button onClick={() => setManual({ date: localDay(), in: '07:00', out: '15:30', meal: '30' })} style={{ ...btn, background: 'transparent', color: TEXT, border: `1px solid ${BORDER}`, display: 'inline-flex', gap: 6, alignItems: 'center' }}><Plus size={15} />Add time</button>
          <button onClick={() => setLeave({ date: localDay(), type: 'pto', hours: '8' })} style={{ ...btn, background: 'transparent', color: TEXT, border: `1px solid ${BORDER}`, display: 'inline-flex', gap: 6, alignItems: 'center' }}><Sun size={15} weight="fill" color={GOLD} />PTO / Sick</button>
        </div>

        {/* entries */}
        <div style={{ fontSize: 12, color: DIM, fontWeight: 700, letterSpacing: 0.8, marginTop: 22, marginBottom: 10 }}>RECENT ENTRIES</div>
        {entries.length === 0 ? <div style={{ color: DIM, fontSize: 13 }}>No entries yet. Clock in or add time.</div> : entries.map((e) => {
          const leaveType = e.entry_type && e.entry_type !== 'regular';
          return (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12, marginBottom: 8 }}>
              {leaveType ? <Bandaids size={18} color={GOLD} /> : null}
              <div style={{ flex: 1, cursor: leaveType ? 'default' : 'pointer' }} onClick={() => !leaveType && e.status !== 'clocked_in' && setManual({ id: e.id, date: e.work_date, in: e.clock_in ? new Date(e.clock_in).toTimeString().slice(0, 5) : '07:00', out: e.clock_out ? new Date(e.clock_out).toTimeString().slice(0, 5) : '15:30', meal: String(e.meal_break_mins ?? 30) })}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{fmtDate(e.work_date)}{leaveType ? ` · ${e.entry_type.toUpperCase()}` : ''}</div>
                <div style={{ color: DIM, fontSize: 12.5 }}>{leaveType ? `${e.hours_worked ?? e.total_hours ?? 8}h` : `${fmtTime(e.clock_in)} – ${e.status === 'clocked_in' ? 'now' : fmtTime(e.clock_out)}`}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{e.status === 'clocked_in' ? '—' : `${(Number(e.total_hours ?? e.hours_worked ?? 0) || 0).toFixed(2)}h`}</div>
                <div style={{ fontSize: 10.5, color: e.status === 'clocked_in' ? GREEN : e.status === 'approved' ? '#FBBF24' : GOLD, fontWeight: 700, textTransform: 'uppercase' }}>{e.status}</div>
              </div>
              {e.status !== 'clocked_in' && e.status !== 'approved' ? <button onClick={() => del(e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><Trash size={15} color={RED} /></button> : null}
            </div>
          );
        })}
      </div>

      {manual && (
        <Modal title={manual.id ? 'Edit time' : 'Add time'} onClose={() => setManual(null)}>
          <input type="date" value={manual.date} onChange={(e) => setManual({ ...manual, date: e.target.value })} style={inp} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}><input type="time" value={manual.in} onChange={(e) => setManual({ ...manual, in: e.target.value })} style={inp} /><input type="time" value={manual.out} onChange={(e) => setManual({ ...manual, out: e.target.value })} style={inp} /></div>
          <input value={manual.meal} onChange={(e) => setManual({ ...manual, meal: e.target.value })} placeholder="Meal break (min)" style={{ ...inp, marginTop: 8 }} />
          <button onClick={saveManual} style={{ ...btn, marginTop: 14, width: '100%' }}>{manual.id ? 'Save' : 'Log time'}</button>
        </Modal>
      )}
      {leave && (
        <Modal title="Log PTO / Sick" onClose={() => setLeave(null)}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>{['pto', 'sick', 'holiday', 'vacation'].map((t) => <button key={t} onClick={() => setLeave({ ...leave, type: t })} style={{ ...btn, background: leave.type === t ? GOLD : 'transparent', color: leave.type === t ? DARK : TEXT, border: `1px solid ${BORDER}`, padding: '7px 12px', fontSize: 13, textTransform: 'capitalize' }}>{t}</button>)}</div>
          <input type="date" value={leave.date} onChange={(e) => setLeave({ ...leave, date: e.target.value })} style={inp} />
          <input value={leave.hours} onChange={(e) => setLeave({ ...leave, hours: e.target.value })} placeholder="Hours" style={{ ...inp, marginTop: 8 }} />
          <button onClick={saveLeave} style={{ ...btn, marginTop: 14, width: '100%' }}>Log {leave.type}</button>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18, width: 'min(400px, 100%)' }}>
        <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 14 }}>{title}</div>{children}
      </div>
    </div>
  );
}
