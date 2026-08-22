'use client';
/**
 * Time Clock (web) — real clock in/out wired to time_entries (timezone + GPS),
 * a weekly timesheet from the shared deterministic lib/timeclock engine (same as
 * iOS), PTO/sick logging, and manual add/edit. Resolves the signed-in user's
 * employees row by email. RLS-scoped browser client.
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import SaguaroDatePicker from '@/components/SaguaroDatePicker';
import { humanError } from '@/lib/errors';
import { getSupabaseBrowser, ensureBrowserSession } from '@/lib/supabase-browser';
import { computeTimesheet, weekKey, fmtHours, liveElapsed, type TimeEntry } from '@/lib/timeclock';
import { CSI_DIVISIONS } from '@/lib/construction-intelligence';
import { Clock, Play, Stop, Plus, Trash, PaperPlaneRight, Sun, Bandaids, MapPin, HardHat, Timer, CurrencyDollar } from '@phosphor-icons/react';
import { PremiumSurface, ModuleHero, SectionCard, StatStrip, FlowSteps, InsightRow, PremiumEmpty, IconChip, goldButtonStyle, ghostButtonStyle } from '@/components/ui/premium';
import { moduleAccent } from '@/lib/module-identity';

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
  const [csiDiv, setCsiDiv] = useState('');

  const loadEntries = useCallback(async (empId: string) => {
    const { data } = await sb.from('time_entries').select('id, project_id, work_date, clock_in, clock_out, hours_worked, regular_hours, overtime_hours, total_hours, status, timezone, entry_type, meal_break_mins, csi_division, cost_code_description').eq('employee_id', empId).order('work_date', { ascending: false }).order('clock_in', { ascending: false }).limit(80);
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
  // Week intelligence — the screen walks in knowing rates, OT exposure, and what's pending.
  const projName = projects.find((p) => p.id === projectId)?.name || '';
  const regRate = Number(emp?.regular_rate ?? 0) || 0;
  const otRate = Number(emp?.overtime_rate ?? 0) || round2(regRate * 1.5);
  const estGross = week ? round2((Number(week.regularHours) || 0) * regRate + (Number(week.overtimeHours) || 0) * otRate) : 0;
  const leaveHours = week ? round2(Object.entries(week.byType).filter(([k]) => k !== 'regular').reduce((s, [, v]) => s + (Number(v) || 0), 0)) : 0;
  const pendingCount = entries.filter((e) => e.status === 'pending').length;
  const fmtMoney = (n: number) => '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const clockIn = async () => {
    if (!emp || !projectId || busy) return; setBusy(true); setMsg('');
    try {
      const nowISO = new Date().toISOString(); const g = await geo();
      await sb.from('time_entries').insert({ tenant_id: tenantId, employee_id: emp.id, project_id: projectId, work_date: localDay(), clock_in: nowISO, status: 'clocked_in', timezone: TZ, entry_type: 'regular', ...(csiDiv ? { csi_division: csiDiv, cost_code_description: CSI_DIVISIONS[csiDiv]?.name || null } : {}), ...(g ? { gps_clock_in: g } : {}) });
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
      if (manual.id) await sb.from('time_entries').update({ work_date: manual.date, clock_in: inISO, clock_out: outISO, hours_worked: hrs, regular_hours: round2(regular), overtime_hours: round2(overtime), meal_break_mins: meal, csi_division: manual.csi || null, cost_code_description: manual.csi ? (CSI_DIVISIONS[manual.csi]?.name || null) : null, ...rates() }).eq('id', manual.id);
      else await sb.from('time_entries').insert({ tenant_id: tenantId, employee_id: emp.id, project_id: projectId, work_date: manual.date, clock_in: inISO, clock_out: outISO, hours_worked: hrs, regular_hours: round2(regular), overtime_hours: round2(overtime), meal_break_mins: meal, status: 'pending', timezone: TZ, entry_type: 'regular', ...(manual.csi ? { csi_division: manual.csi, cost_code_description: CSI_DIVISIONS[manual.csi]?.name || null } : {}), ...rates() });
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
    <PremiumSurface maxWidth={1140}>
      <ModuleHero
        eyebrow="Field Workforce"
        eyebrowIcon={<IconChip size={24} vivid={moduleAccent('time').vivid ?? moduleAccent('time').hex}><Clock size={13} weight="fill" color="#F8FAFC" /></IconChip>}
        accentColor={moduleAccent('time').hex}
        title="Time"
        accent="Clock"
        subtitle="Timezone-aware, GPS-stamped, CSI-coded labor — the same deterministic engine as the phone."
        actions={
          <>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ ...inp, width: 'auto', minWidth: 170 }}>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <select value={csiDiv} onChange={(e) => setCsiDiv(e.target.value)} style={{ ...inp, width: 'auto', maxWidth: 240 }} title="CSI cost code applied to the next clock-in">
              <option value="">No cost code</option>
              {Object.entries(CSI_DIVISIONS).map(([code, d]) => <option key={code} value={code}>Div {code} — {d.name}</option>)}
            </select>
          </>
        }
      />

      {/* Week intelligence strip — what the engine already knows */}
      <StatStrip items={[
        { label: 'Today', value: `${todayHours.toFixed(2)} h`, sub: clockedIn ? 'shift running now' : 'completed shifts', accent: clockedIn ? GREEN : undefined },
        { label: 'This Week', value: `${(week?.workedHours ?? 0).toFixed(2)} h`, sub: `week of ${fmtDate(thisWeekKey)}` },
        { label: 'Regular', value: `${(week?.regularHours ?? 0).toFixed(2)} h`, sub: 'inside the 40 h threshold' },
        { label: 'Overtime', value: `${(week?.overtimeHours ?? 0).toFixed(2)} h`, accent: (week?.overtimeHours ?? 0) > 0 ? GOLD : undefined, sub: 'past 40 h/week or 8 h/day' },
        { label: 'Leave', value: `${leaveHours.toFixed(2)} h`, sub: 'PTO / sick / holiday' },
        ...(regRate > 0
          ? [{ label: 'Est. Gross', value: fmtMoney(estGross), accent: GREEN, sub: `$${regRate}/h reg · $${otRate}/h OT` }]
          : [{ label: 'Pending Approval', value: String(pendingCount), sub: 'entries awaiting review' }]),
      ]} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 18, alignItems: 'start' }}>
        <div>

          {/* Shift console — walks in knowing the project, cost code, timezone, and GPS */}
          <SectionCard style={{ marginBottom: 16 }} bodyStyle={{ textAlign: 'center', padding: 26 }}>
            <div style={{ fontSize: 46, fontWeight: 800, letterSpacing: -1, color: clockedIn ? GREEN : DIM, fontVariantNumeric: 'tabular-nums' }}>
              {clockedIn ? (() => { const h = liveElapsed(openShift.clock_in, new Date(now).toISOString()); const s = Math.floor(h * 3600); return `${Math.floor(s / 3600)}:${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; })() : 'Clocked out'}
            </div>
            <div style={{ color: DIM, fontSize: 13, marginTop: 4 }}>{clockedIn ? `Since ${fmtTime(openShift.clock_in)} · ${openShift.timezone || TZ}` : (emp ? 'Ready to clock in' : 'Resolving your employee record…')}</div>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginTop: 12, fontSize: 12, color: DIM }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><HardHat size={13} color={GOLD} />{clockedIn ? (projects.find((p) => p.id === openShift.project_id)?.name || 'Project') : (projName || 'Pick a project above')}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Timer size={13} color={GOLD} />{clockedIn ? (openShift.csi_division ? `Div ${openShift.csi_division} — ${openShift.cost_code_description || CSI_DIVISIONS[openShift.csi_division]?.name || 'cost coded'}` : 'No cost code on this shift') : (csiDiv ? `Div ${csiDiv} — ${CSI_DIVISIONS[csiDiv]?.name}` : 'No cost code — pick one above')}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><MapPin size={13} color={GOLD} />GPS stamps in &amp; out</span>
            </div>
            <button onClick={clockedIn ? clockOut : clockIn} disabled={busy || !emp} className="pmBtn" style={{ ...btn, marginTop: 16, background: clockedIn ? RED : GREEN, color: '#fff', fontSize: 16, padding: '13px 26px', display: 'inline-flex', alignItems: 'center', gap: 8, opacity: busy || !emp ? 0.6 : 1, borderRadius: 12 }}>{clockedIn ? <Stop size={20} weight="fill" /> : <Play size={20} weight="fill" />}{clockedIn ? 'Clock out' : 'Clock in'}</button>
            {msg && <div style={{ color: msg.includes('submitted') || msg.includes('Clocked') || msg === 'Logged' ? GREEN : DIM, fontSize: 13, marginTop: 10 }}>{msg}</div>}
          </SectionCard>

          {week && (
            <SectionCard
              title={`Week of ${fmtDate(week.weekStart)}`}
              subtitle={`${week.regularHours.toFixed(2)} h regular · ${week.overtimeHours.toFixed(2)} h overtime${regRate > 0 ? ` · est. ${fmtMoney(estGross)} gross` : ''}`}
              icon={<Clock size={17} weight="duotone" color={GOLD} />}
              style={{ marginBottom: 16 }}
              action={<button onClick={submitWeek} className="pmBtn" style={{ ...ghostButtonStyle, padding: '7px 13px', fontSize: 12.5 }}><PaperPlaneRight size={14} />Submit week</button>}
            >
              {week.days.map((d) => {
                const hrs = Number(d.hours) || 0;
                return (
                  <div key={d.date} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '5px 0', fontSize: 13 }}>
                    <span style={{ width: 110, flexShrink: 0 }}>{fmtDate(d.date)}</span>
                    <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, (hrs / 10) * 100)}%`, borderRadius: 999, background: hrs > 8 ? `linear-gradient(90deg,${GOLD},#FBBF24)` : 'rgba(61,214,140,0.75)' }} />
                    </div>
                    <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', width: 56, textAlign: 'right' }}>{fmtHours(d.hours)}</span>
                  </div>
                );
              })}
              {Object.keys(week.byType).filter((k) => k !== 'regular').length > 0 && <div style={{ color: DIM, fontSize: 12.5, marginTop: 8 }}>Leave: {Object.entries(week.byType).filter(([k]) => k !== 'regular').map(([k, v]) => `${v}h ${k}`).join(' · ')}</div>}
            </SectionCard>
          )}

          {/* actions */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <button onClick={() => setManual({ date: localDay(), in: '07:00', out: '15:30', meal: '30', csi: csiDiv })} className="pmBtn" style={ghostButtonStyle}><Plus size={15} />Add time</button>
            <button onClick={() => setLeave({ date: localDay(), type: 'pto', hours: '8' })} className="pmBtn" style={ghostButtonStyle}><Sun size={15} weight="fill" color={GOLD} />PTO / Sick</button>
          </div>

          <SectionCard title="Recent Entries" subtitle={entries.length > 0 ? `${entries.length} shown · ${pendingCount} pending approval` : undefined} icon={<Timer size={17} weight="duotone" color={GOLD} />} bodyStyle={{ padding: 14 }}>
            {entries.length === 0 ? (
              <PremiumEmpty
                compact
                icon={<Clock size={28} weight="duotone" color={GOLD} />}
                title="No time on the books yet"
                description="Clock in above to start a GPS-stamped shift, or backfill a day with Add time. Entries land as pending, roll into the weekly timesheet, and hit job cost under their CSI division."
                action={<button onClick={() => setManual({ date: localDay(), in: '07:00', out: '15:30', meal: '30', csi: csiDiv })} className="pmBtn" style={goldButtonStyle}><Plus size={15} weight="bold" />Add time</button>}
              />
            ) : entries.map((e) => {
              const leaveType = e.entry_type && e.entry_type !== 'regular';
              return (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12, marginBottom: 8 }}>
                  {leaveType ? <Bandaids size={18} color={GOLD} /> : null}
                  <div style={{ flex: 1, minWidth: 0, cursor: leaveType ? 'default' : 'pointer' }} onClick={() => !leaveType && e.status !== 'clocked_in' && setManual({ id: e.id, date: e.work_date, in: e.clock_in ? new Date(e.clock_in).toTimeString().slice(0, 5) : '07:00', out: e.clock_out ? new Date(e.clock_out).toTimeString().slice(0, 5) : '15:30', meal: String(e.meal_break_mins ?? 30), csi: e.csi_division || '' })}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{fmtDate(e.work_date)}{leaveType ? ` · ${e.entry_type.toUpperCase()}` : ''}</div>
                    <div style={{ color: DIM, fontSize: 12.5 }}>
                      {leaveType ? `${e.hours_worked ?? e.total_hours ?? 8}h` : `${fmtTime(e.clock_in)} – ${e.status === 'clocked_in' ? 'now' : fmtTime(e.clock_out)}`}
                      {!leaveType && e.project_id ? ` · ${projects.find((p) => p.id === e.project_id)?.name || 'Project'}` : ''}
                    </div>
                    {e.csi_division ? <span style={{ display: 'inline-flex', alignItems: 'center', marginTop: 4, padding: '1px 8px', borderRadius: 999, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)', color: '#FBBF24', fontSize: 10.5, fontWeight: 700 }}>Div {e.csi_division} · {e.cost_code_description || CSI_DIVISIONS[e.csi_division]?.name || 'Cost coded'}</span> : null}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{e.status === 'clocked_in' ? '—' : `${(Number(e.total_hours ?? e.hours_worked ?? 0) || 0).toFixed(2)}h`}</div>
                    <div style={{ fontSize: 10.5, color: e.status === 'clocked_in' ? GREEN : e.status === 'approved' ? '#FBBF24' : GOLD, fontWeight: 700, textTransform: 'uppercase' }}>{e.status}</div>
                  </div>
                  {e.status !== 'clocked_in' && e.status !== 'approved' ? <button onClick={() => del(e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><Trash size={15} color={RED} /></button> : null}
                </div>
              );
            })}
          </SectionCard>
        </div>

        {/* Context rail — what the system does with these hours */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SectionCard title="This Week at a Glance" icon={<CurrencyDollar size={17} weight="duotone" color={GOLD} />}>
            <InsightRow label="Worked hours" value={`${(week?.workedHours ?? 0).toFixed(2)} h`} />
            <InsightRow label="Regular / OT" value={`${(week?.regularHours ?? 0).toFixed(2)} / ${(week?.overtimeHours ?? 0).toFixed(2)}`} accent={(week?.overtimeHours ?? 0) > 0 ? GOLD : undefined} />
            <InsightRow label="Leave logged" value={`${leaveHours.toFixed(2)} h`} />
            <InsightRow label="Pending approval" value={String(pendingCount)} />
            {regRate > 0 && <InsightRow label="Est. gross" value={fmtMoney(estGross)} accent={GREEN} strong />}
            <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5, marginTop: 8 }}>Overtime splits automatically past 40 h/week and 8 h/shift. Rates come from your employee record.</div>
          </SectionCard>
          <SectionCard title="After You Clock Out" icon={<PaperPlaneRight size={17} weight="duotone" color={GOLD} />}>
            <FlowSteps title="" steps={[
              { title: 'Entry lands as pending', desc: 'GPS-stamped, timezone-aware, meal break deducted.' },
              { title: 'CSI division prices the labor', desc: csiDiv ? `Coding to Div ${csiDiv} — ${CSI_DIVISIONS[csiDiv]?.name}.` : 'Pick a cost code above so hours hit the right budget line.' },
              { title: 'Submit the week', desc: 'One click sends the whole timesheet for approval.' },
              { title: 'Approved hours hit job cost', desc: 'Labor cost rolls into the project budget and reports.' },
            ]} />
          </SectionCard>
        </div>
      </div>

      {manual && (
        <Modal title={manual.id ? 'Edit time' : 'Add time'} onClose={() => setManual(null)}>
          <SaguaroDatePicker value={manual.date} onChange={(v) => setManual({ ...manual, date: v })} style={inp} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}><input type="time" value={manual.in} onChange={(e) => setManual({ ...manual, in: e.target.value })} style={inp} /><input type="time" value={manual.out} onChange={(e) => setManual({ ...manual, out: e.target.value })} style={inp} /></div>
          <input value={manual.meal} onChange={(e) => setManual({ ...manual, meal: e.target.value })} placeholder="Meal break (min)" style={{ ...inp, marginTop: 8 }} />
          <select value={manual.csi ?? ''} onChange={(e) => setManual({ ...manual, csi: e.target.value })} style={{ ...inp, marginTop: 8 }}>
            <option value="">No cost code</option>
            {Object.entries(CSI_DIVISIONS).map(([code, d]) => <option key={code} value={code}>Div {code} — {d.name}</option>)}
          </select>
          <div style={{ color: DIM, fontSize: 11.5, marginTop: 6, lineHeight: 1.45 }}>The CSI division routes these hours to the right budget line in job cost.</div>
          <button onClick={saveManual} style={{ ...btn, marginTop: 14, width: '100%' }}>{manual.id ? 'Save' : 'Log time'}</button>
        </Modal>
      )}
      {leave && (
        <Modal title="Log PTO / Sick" onClose={() => setLeave(null)}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>{['pto', 'sick', 'holiday', 'vacation'].map((t) => <button key={t} onClick={() => setLeave({ ...leave, type: t })} style={{ ...btn, background: leave.type === t ? GOLD : 'transparent', color: leave.type === t ? DARK : TEXT, border: `1px solid ${BORDER}`, padding: '7px 12px', fontSize: 13, textTransform: 'capitalize' }}>{t}</button>)}</div>
          <SaguaroDatePicker value={leave.date} onChange={(v) => setLeave({ ...leave, date: v })} style={inp} />
          <input value={leave.hours} onChange={(e) => setLeave({ ...leave, hours: e.target.value })} placeholder="Hours" style={{ ...inp, marginTop: 8 }} />
          <button onClick={saveLeave} style={{ ...btn, marginTop: 14, width: '100%' }}>Log {leave.type}</button>
        </Modal>
      )}
    </PremiumSurface>
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
