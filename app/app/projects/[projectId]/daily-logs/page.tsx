'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { humanError } from '@/lib/errors';
import { useParams } from 'next/navigation';
import { getAuthHeaders } from '@/lib/supabase-browser';
import { Clipboard, ClipboardText, Thermometer, HardHat, CalendarBlank, WarningCircle, Plus, X } from '@phosphor-icons/react';
import { PremiumSurface, ModuleHero, StatCard, SectionCard, PremiumEmpty, StatStrip, InsightRow, AutoChip, goldButtonStyle } from '@/components/ui/premium';

const GOLD='#F59E0B',DARK='#0a0a0a',RAISED='#141416',BORDER='rgba(255,255,255,0.12)',DIM='#CBD5E1',TEXT='#FFFFFF';
const GREEN='#1a8a4a',RED='#c03030',BLUE='#F59E0B';

const WEATHER_OPTS = ['Clear','Partly Cloudy','Overcast','Rain','Thunderstorm','Snow','Fog','Windy'];

const fmtDay = (d?:string|null) => d ? new Date(d+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}) : '—';
/** Workdays (Mon-Fri) strictly between two ISO dates — 0 across a plain weekend. */
function missedWorkdays(fromIso:string,toIso:string){
  let n = 0;
  for(let d=new Date(fromIso+'T12:00:00').getTime()+86400000; d<new Date(toIso+'T12:00:00').getTime(); d+=86400000){
    const wd = new Date(d).getDay();
    if(wd!==0&&wd!==6) n++;
  }
  return n;
}

const EMPTY: Record<string,any> = {
  log_date: new Date().toISOString().split('T')[0],
  weather:'', high_temp:'', low_temp:'', crew_count:'', superintendent:'',
  work_performed:'', delays:'', safety_notes:'', materials_delivered:'', visitors:'', notes:'',
};

const inp: React.CSSProperties = {
  width:'100%', padding:'9px 12px', background:'#1c1c1e',
  border:'1px solid rgba(255,255,255,0.12)', borderRadius:7, color:'#FFFFFF',
  fontSize:13, outline:'none', boxSizing:'border-box',
};

function Field({label,hint,children}:{label:React.ReactNode;hint?:React.ReactNode;children:React.ReactNode}){
  return (
    <div>
      <label style={{display:'block',fontSize:11,fontWeight:700,color:DIM,
        textTransform:'uppercase',letterSpacing:.5,marginBottom:5}}>{label}</label>
      {children}
      {hint && <div style={{fontSize:11,color:'rgba(255,255,255,0.45)',marginTop:4,lineHeight:1.45}}>{hint}</div>}
    </div>
  );
}

function Section({label,value,warn}:{label:string;value?:string;warn?:boolean}){
  if(!value?.trim()) return null;
  return (
    <div style={{background:warn?'rgba(192,48,48,.07)':'#141416',
      border:`1px solid ${warn?'rgba(192,48,48,.25)':'rgba(255,255,255,0.12)'}`,
      borderRadius:8,padding:'12px 14px'}}>
      <div style={{fontSize:10,fontWeight:700,color:warn?'#f87171':DIM,
        textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>{label}</div>
      <div style={{fontSize:13,color:TEXT,lineHeight:1.6,whiteSpace:'pre-wrap'}}>{value}</div>
    </div>
  );
}

export default function DailyLogsPage(){
  const {projectId} = useParams() as {projectId:string};
  const [logs,setLogs]       = useState<any[]>([]);
  const [loading,setLoading] = useState(true);
  const [loadError,setLoadError] = useState('');
  const [selected,setSelected] = useState<any>(null);
  const [mode,setMode]       = useState<'view'|'edit'|'create'|null>(null);
  const [form,setForm]       = useState<Record<string,any>>({...EMPTY});
  const [saving,setSaving]   = useState(false);
  const [deleting,setDeleting]=useState(false);
  const [toast,setToast]     = useState<{msg:string;type:'success'|'error'}|null>(null);
  const [search,setSearch]   = useState('');
  const [monthFilter,setMonthFilter] = useState('');
  // Project snapshot (/api/project-context) — the page walks in knowing the job:
  // last log date, open items, schedule — so create prefills itself.
  const [ctx,setCtx]         = useState<any>(null);
  const [auto,setAuto]       = useState<{date?:boolean;crew?:boolean}>({});

  const showToast=(msg:string,type:'success'|'error'='success')=>{
    setToast({msg,type}); setTimeout(()=>setToast(null),4000);
  };

  const load = useCallback(async()=>{
    setLoading(true);
    try{
      setLoadError('');
      const h = await getAuthHeaders();
      const r = await fetch(`/api/daily-logs/list?projectId=${projectId}`,{headers:h});
      if (!r.ok) throw new Error('Failed to load data');
      const d = await r.json();
      setLogs(d.logs||[]);
    }catch{setLogs([]);setLoadError('Failed to load. Please try again.');}
    finally{setLoading(false);}
  },[projectId]);

  useEffect(()=>{load();},[load]);

  useEffect(()=>{
    (async()=>{
      try{
        const r = await fetch(`/api/project-context?projectId=${projectId}`);
        const c = await r.json();
        if(!c.error) setCtx(c);
      }catch{/* strip and prefill hints simply stay hidden */}
    })();
  },[projectId]);

  function openCreate(){
    // Walk in knowing the job: today's date, crew carried from the last log.
    // The GC only types what changed since the previous report.
    const prev = logs[0]; // list arrives sorted date-desc
    setForm({
      ...EMPTY,
      log_date: new Date().toISOString().split('T')[0],
      crew_count: prev?.crew_count ? String(prev.crew_count) : '',
    });
    setAuto({date:true, crew:!!(prev?.crew_count)});
    setMode('create'); setSelected(null);
  }
  function openEdit(log:any){
    setForm({
      log_date:log.log_date||'',weather:log.weather||'',
      high_temp:log.high_temp??'',low_temp:log.low_temp??'',
      superintendent:log.superintendent||'',
      crew_count:log.crew_count??'',work_performed:log.work_performed||'',
      delays:log.delays||'',safety_notes:log.safety_notes||'',
      materials_delivered:log.materials_delivered||'',visitors:log.visitors||'',notes:log.notes||'',
    });
    setSelected(log); setMode('edit');
  }
  function viewLog(log:any){ setSelected(log); setMode('view'); }
  function closePanel(){ setSelected(null); setMode(null); }

  async function save(){
    setSaving(true);
    try{
      const h = await getAuthHeaders();
      const payload: Record<string,any> = {
        ...form,
        crew_count:Number(form.crew_count)||0,
        high_temp:form.high_temp!==''?Number(form.high_temp):null,
        low_temp:form.low_temp!==''?Number(form.low_temp):null,
      };
      if(mode==='create'){
        const r = await fetch('/api/daily-logs/create',{
          method:'POST',
          headers:{...h,'Content-Type':'application/json'},
          body:JSON.stringify({...payload,projectId,
            logDate:payload.log_date,workPerformed:payload.work_performed,
            safetyNotes:payload.safety_notes,materialsDelivered:payload.materials_delivered,
            crewCount:payload.crew_count,
            temperatureHigh:payload.high_temp,temperatureLow:payload.low_temp,
          }),
        });
        if(!r.ok) throw new Error(await r.text());
        showToast('Daily log created');
      } else if(mode==='edit'&&selected){
        const r = await fetch(`/api/daily-logs/${selected.id}`,{
          method:'PUT',
          headers:{...h,'Content-Type':'application/json'},
          body:JSON.stringify(payload),
        });
        if(!r.ok) throw new Error(await r.text());
        showToast('Log updated');
      }
      await load(); closePanel();
    }catch(e:any){ console.error(e); showToast(humanError(e,'Save failed. Please try again.'),'error'); }
    finally{setSaving(false);}
  }

  async function deleteLog(log:any){
    if(!confirm(`Delete log for ${log.log_date}?`)) return;
    setDeleting(true);
    try{
      const h = await getAuthHeaders();
      const dr = await fetch(`/api/daily-logs/${log.id}`,{method:'DELETE',headers:h});
      if (!dr.ok) throw new Error('Delete failed');
      showToast('Log deleted');
      closePanel(); await load();
    }catch{showToast('Delete failed','error');}
    finally{setDeleting(false);}
  }

  const months = Array.from(new Set(logs.map(l=>(l.log_date||'').slice(0,7)))).sort().reverse();

  const filtered = logs.filter(l=>{
    const ms = !search || (l.work_performed||'').toLowerCase().includes(search.toLowerCase())
      ||(l.notes||'').toLowerCase().includes(search.toLowerCase())
      ||(l.log_date||'').includes(search);
    const mm = !monthFilter||(l.log_date||'').startsWith(monthFilter);
    return ms&&mm;
  });

  const totalCrew  = logs.reduce((s:number,l:any)=>s+(Number(l.crew_count)||0),0);
  const avgCrew    = logs.length?Math.round(totalCrew/logs.length):0;
  const delayDays  = logs.filter((l:any)=>l.delays?.trim()).length;
  const thisMonth  = logs.filter((l:any)=>(l.log_date||'').startsWith(new Date().toISOString().slice(0,7))).length;

  const panelOpen = mode!==null;

  return (
    <div style={{display:'flex',height:'100%',minHeight:0,position:'relative',background:DARK}}>
      {/* Toast */}
      {toast&&(
        <div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',zIndex:99999,
          padding:'12px 20px',borderRadius:8,color:'#fff',fontWeight:700,fontSize:14,pointerEvents:'none',
          background:toast.type==='success'?'rgba(26,138,74,.92)':'rgba(192,48,48,.92)'}}>
          {toast.msg}
        </div>
      )}

      {/* Main */}
      <div style={{flex:1,overflow:'auto',minWidth:0}}>
        <PremiumSurface maxWidth={1600}>
          {/* Header */}
          <ModuleHero
            eyebrow="FIELD REPORTS"
            eyebrowIcon={<ClipboardText size={13} weight="fill" color={GOLD}/>}
            title="Daily"
            accent="Logs"
            subtitle="Field reports — weather, crew, work performed, delays & safety"
            actions={
              <button onClick={openCreate} style={goldButtonStyle} className="pmBtn">
                <Plus size={15} weight="bold"/> New Daily Log
              </button>
            }
          />

          {/* KPIs */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12,marginBottom:24}}>
            <StatCard icon={<Clipboard size={19} weight="duotone" color={GOLD}/>}
              label="Total Logs" value={String(logs.length)} accent={GOLD} sub="all field reports" delay={0.02}/>
            <StatCard icon={<CalendarBlank size={19} weight="duotone" color={GOLD}/>}
              label="This Month" value={String(thisMonth)} sub="logged this month" delay={0.06}/>
            <StatCard icon={<HardHat size={19} weight="duotone" color={GOLD}/>}
              label="Avg Crew / Day" value={String(avgCrew)} accent={GOLD} sub="workers on site" delay={0.10}/>
            <StatCard icon={<WarningCircle size={19} weight="duotone" color={delayDays>0?RED:DIM}/>}
              label="Days w/ Delays" value={String(delayDays)} accent={delayDays>0?RED:undefined}
              sub={delayDays>0?'flagged delays':'none flagged'} delay={0.14}/>
          </div>

          {/* What the system already knows about this job */}
          {ctx && (()=>{
            const lastLog = ctx.recent?.lastDailyLogDate as string|null;
            const gap = lastLog ? missedWorkdays(lastLog, new Date().toISOString().split('T')[0]) : 0;
            return (
              <StatStrip items={[
                {label:'Last Log', value: lastLog ? fmtDay(lastLog) : 'None yet',
                  accent: gap>0 ? '#f87171' : (lastLog ? '#3dd68c' : undefined),
                  sub: lastLog ? (gap>0 ? `${gap} workday${gap===1?'':'s'} unlogged` : 'record is current') : 'start the record'},
                {label:'% Complete', value:`${Number(ctx.project?.percentComplete)||0}%`, sub: ctx.project?.status ? String(ctx.project.status).replace(/_/g,' ') : 'project status'},
                {label:'Schedule Tasks', value:String(ctx.counts?.scheduleTasks??0), sub: ctx.schedule?.criticalCount ? `${ctx.schedule.criticalCount} critical open` : 'on the schedule'},
                {label:'Open RFIs', value:String(ctx.counts?.openRfis??0), accent:(Number(ctx.counts?.openRfis)||0)>0?'#FBBF24':undefined, sub:'awaiting answers'},
                {label:'Open Submittals', value:String(ctx.counts?.openSubmittals??0), sub:'in review'},
                {label:'Open Punch', value:String(ctx.counts?.openPunch??0), accent:(Number(ctx.counts?.openPunch)||0)>0?'#f87171':undefined, sub:'items to close'},
              ]}/>
            );
          })()}

          {/* Filters + Log */}
          <SectionCard
            title="Log Entries"
            icon={<ClipboardText size={17} weight="duotone" color={GOLD}/>}
            action={<span style={{fontSize:12,fontWeight:700,color:DIM,whiteSpace:'nowrap'}}>{filtered.length} of {logs.length}</span>}
            flush
          >
            {/* Filters */}
            <div style={{display:'flex',gap:10,padding:'14px 16px',flexWrap:'wrap'}}>
              <input value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="Search logs…"
                style={{flex:1,minWidth:200,padding:'8px 12px',background:RAISED,
                  border:`1px solid ${BORDER}`,borderRadius:7,color:TEXT,fontSize:13,outline:'none'}}/>
              <select value={monthFilter} onChange={e=>setMonthFilter(e.target.value)}
                style={{padding:'8px 12px',background:RAISED,border:`1px solid ${BORDER}`,
                  borderRadius:7,color:monthFilter?TEXT:DIM,fontSize:13,outline:'none'}}>
                <option value="">All months</option>
                {months.map(m=><option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {loading&&<div style={{padding:40,textAlign:'center',color:DIM}}>Loading logs…</div>}

            {!loading&&loadError&&(
              <div style={{margin:'0 16px 14px',background:'rgba(192,48,48,.12)',border:'1px solid rgba(192,48,48,.3)',borderRadius:8,padding:'12px 16px',color:'#c03030',fontSize:13}}>
                {loadError}
              </div>
            )}

            {!loading&&filtered.length===0&&(
              <div style={{padding:'8px 8px 20px'}}>
                <PremiumEmpty
                  icon={<Clipboard size={30} weight="duotone" color={GOLD}/>}
                  title={logs.length===0?'No daily logs yet':'No logs match your filters'}
                  description={logs.length===0
                    ?'Start documenting your daily field activity.'
                    :'Try adjusting your search or month filter.'}
                  action={logs.length===0?(
                    <button onClick={openCreate} style={goldButtonStyle} className="pmBtn">
                      <Plus size={15} weight="bold"/> Create First Log
                    </button>
                  ):undefined}
                />
              </div>
            )}

            {/* Log list */}
            {!loading&&filtered.length>0&&(
              <div style={{display:'flex',flexDirection:'column',gap:10,padding:'4px 16px 16px',borderTop:`1px solid rgba(255,255,255,0.06)`}}>
                {filtered.map((log:any)=>{
                  const isSel = selected?.id===log.id && mode==='view';
                  return (
                    <div key={log.id} onClick={()=>viewLog(log)}
                      style={{background:isSel?'rgba(245, 158, 11,.08)':RAISED,
                        border:`1px solid ${isSel?GOLD:BORDER}`,borderRadius:10,
                        padding:'14px 18px',cursor:'pointer',transition:'all .15s'}}
                      onMouseEnter={e=>{if(!isSel)e.currentTarget.style.borderColor='rgba(245, 158, 11,.4)';}}
                      onMouseLeave={e=>{if(!isSel)e.currentTarget.style.borderColor=BORDER;}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
                        <div>
                          <div style={{fontWeight:800,fontSize:15,color:TEXT}}>
                            {new Date(log.log_date+'T12:00:00').toLocaleDateString('en-US',
                              {weekday:'short',month:'short',day:'numeric',year:'numeric'})}
                          </div>
                          <div style={{fontSize:12,color:DIM,marginTop:3,display:'flex',gap:12,flexWrap:'wrap'}}>
                            {log.weather&&<span>{log.weather}</span>}
                            {(log.high_temp||log.low_temp)&&
                              <span><Thermometer size={14} weight="fill" color={DIM} style={{verticalAlign:'middle'}}/> {log.high_temp??'?'}° / {log.low_temp??'?'}°F</span>}
                            {log.crew_count?<span><HardHat size={14} weight="fill" color={DIM} style={{verticalAlign:'middle'}}/> {log.crew_count} crew</span>:null}
                          </div>
                        </div>
                        <div style={{display:'flex',gap:6,flexShrink:0}}>
                          {log.delays?.trim()&&(
                            <span style={{fontSize:10,fontWeight:700,padding:'3px 8px',borderRadius:4,
                              background:'rgba(192,48,48,.15)',color:'#f87171',textTransform:'uppercase',letterSpacing:.3}}>
                              Delays
                            </span>
                          )}
                          {log.safety_notes?.trim()&&(
                            <span style={{fontSize:10,fontWeight:700,padding:'3px 8px',borderRadius:4,
                              background:'rgba(245, 158, 11,.15)',color:GOLD,textTransform:'uppercase',letterSpacing:.3}}>
                              Safety
                            </span>
                          )}
                        </div>
                      </div>
                      {log.work_performed&&(
                        <div style={{marginTop:8,fontSize:13,color:DIM,lineHeight:1.4,
                          overflow:'hidden',display:'-webkit-box',
                          WebkitLineClamp:2,WebkitBoxOrient:'vertical' as any}}>
                          {log.work_performed}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </PremiumSurface>
      </div>

      {/* Side panel */}
      {panelOpen&&(
        <div style={{width:480,borderLeft:`1px solid ${BORDER}`,background:DARK,
          overflow:'auto',flexShrink:0,display:'flex',flexDirection:'column'}}>
          {/* Panel header */}
          <div style={{padding:'16px 20px',borderBottom:`1px solid ${BORDER}`,
            display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{fontWeight:800,fontSize:15,color:TEXT}}>
              {mode==='create'?'New Daily Log':mode==='edit'?'Edit Log':'Log Detail'}
            </div>
            <div style={{display:'flex',gap:8}}>
              {mode==='view'&&selected&&(
                <>
                  <button onClick={()=>openEdit(selected)}
                    style={{padding:'6px 14px',background:'rgba(245,158,11,.12)',
                      border:`1px solid ${BLUE}44`,borderRadius:6,
                      color:'#FBBF24',fontSize:12,fontWeight:700,cursor:'pointer'}}>
                    Edit
                  </button>
                  <button onClick={()=>deleteLog(selected)} disabled={deleting}
                    style={{padding:'6px 14px',background:'rgba(192,48,48,.1)',
                      border:`1px solid ${RED}44`,borderRadius:6,
                      color:RED,fontSize:12,fontWeight:700,cursor:'pointer'}}>
                    {deleting?'…':'Delete'}
                  </button>
                </>
              )}
              <button onClick={closePanel}
                style={{padding:'6px 10px',background:'rgba(143,163,192,.1)',
                  border:`1px solid ${BORDER}`,borderRadius:6,color:DIM,fontSize:12,cursor:'pointer'}}>
                <X size={14} weight="bold" color={DIM}/>
              </button>
            </div>
          </div>

          <div style={{flex:1,overflow:'auto',padding:20}}>
            {(mode==='create'||mode==='edit')?(
              /* FORM */
              <div style={{display:'flex',flexDirection:'column',gap:16}}>
                {mode==='create' && (()=>{
                  const lastLog = ctx?.recent?.lastDailyLogDate || logs[0]?.log_date || null;
                  const gap = lastLog ? missedWorkdays(lastLog, new Date().toISOString().split('T')[0]) : 0;
                  const prev = logs[0];
                  return (
                    <div style={{background:gap>0?'rgba(192,48,48,.07)':RAISED,
                      border:`1px solid ${gap>0?'rgba(192,48,48,.3)':BORDER}`,borderRadius:10,padding:'12px 14px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,fontSize:12.5,fontWeight:700,color:gap>0?'#f87171':TEXT}}>
                        {gap>0 && <WarningCircle size={16} weight="fill" color="#f87171"/>}
                        {lastLog
                          ? gap>0
                            ? `Gap in the record — last log ${fmtDay(lastLog)}, ${gap} workday${gap===1?'':'s'} unlogged.`
                            : `Last log: ${fmtDay(lastLog)} — record is current.`
                          : 'First daily log on this project — it starts the field record.'}
                      </div>
                      {prev && (
                        <div style={{marginTop:8,paddingTop:8,borderTop:`1px solid rgba(255,255,255,0.08)`}}>
                          <InsightRow label="Prev crew" value={`${prev.crew_count||0} on site`}/>
                          {prev.weather ? <InsightRow label="Prev weather" value={`${prev.weather}${prev.high_temp!=null?` · ${prev.high_temp}°/${prev.low_temp??'—'}°F`:''}`}/> : null}
                          {prev.superintendent ? <InsightRow label="Prev super" value={prev.superintendent}/> : null}
                        </div>
                      )}
                    </div>
                  );
                })()}

                <Field label={<>Log Date{mode==='create'&&auto.date&&<AutoChip/>}</>}
                  hint={mode==='create'?'Defaulted to today — backfill any missed day.':undefined}>
                  <input type="date" value={form.log_date}
                    onChange={e=>setForm(f=>({...f,log_date:e.target.value}))}
                    style={inp}/>
                </Field>

                <Field label="Superintendent"
                  hint={mode==='create'&&logs[0]?.superintendent?`Last log: ${logs[0].superintendent}.`:undefined}>
                  <input value={form.superintendent}
                    onChange={e=>setForm(f=>({...f,superintendent:e.target.value}))}
                    style={inp} placeholder="Who ran the site today"/>
                </Field>

                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                  <Field label="Weather">
                    <input value={form.weather} list="sgWeatherOpts"
                      onChange={e=>setForm(f=>({...f,weather:e.target.value}))}
                      style={inp} placeholder="Clear, 10 mph W, dusty..."/>
                    <datalist id="sgWeatherOpts">
                      {WEATHER_OPTS.map(w=><option key={w} value={w}/>)}
                    </datalist>
                  </Field>
                  <Field label="High °F">
                    <input type="number" value={form.high_temp}
                      onChange={e=>setForm(f=>({...f,high_temp:e.target.value}))}
                      style={inp} placeholder="95"/>
                  </Field>
                  <Field label="Low °F">
                    <input type="number" value={form.low_temp}
                      onChange={e=>setForm(f=>({...f,low_temp:e.target.value}))}
                      style={inp} placeholder="72"/>
                  </Field>
                </div>

                <Field label={<>Crew Count{mode==='create'&&auto.crew&&<AutoChip/>}</>}
                  hint={mode==='create'&&auto.crew?`Carried from your last log (${fmtDay(logs[0]?.log_date)}) — adjust for today.`:undefined}>
                  <input type="number" value={form.crew_count}
                    onChange={e=>setForm(f=>({...f,crew_count:e.target.value}))}
                    style={inp} placeholder="0" min={0}/>
                </Field>

                <Field label="Work Performed">
                  <textarea value={form.work_performed}
                    onChange={e=>setForm(f=>({...f,work_performed:e.target.value}))}
                    rows={4} style={{...inp,resize:'vertical',lineHeight:1.5}}
                    placeholder="Describe work completed today…"/>
                </Field>

                <Field label="Delays / Issues">
                  <textarea value={form.delays}
                    onChange={e=>setForm(f=>({...f,delays:e.target.value}))}
                    rows={2} style={{...inp,resize:'vertical',lineHeight:1.5}}
                    placeholder="Any delays, blockers, or issues encountered…"/>
                </Field>

                <Field label="Safety Notes">
                  <textarea value={form.safety_notes}
                    onChange={e=>setForm(f=>({...f,safety_notes:e.target.value}))}
                    rows={2} style={{...inp,resize:'vertical',lineHeight:1.5}}
                    placeholder="Safety observations, incidents, toolbox talks…"/>
                </Field>

                <Field label="Materials Delivered">
                  <textarea value={form.materials_delivered}
                    onChange={e=>setForm(f=>({...f,materials_delivered:e.target.value}))}
                    rows={2} style={{...inp,resize:'vertical',lineHeight:1.5}}
                    placeholder="List materials received on site…"/>
                </Field>

                <Field label="Visitors / Inspections">
                  <input value={form.visitors}
                    onChange={e=>setForm(f=>({...f,visitors:e.target.value}))}
                    style={inp} placeholder="Inspector, owner rep, architect…"/>
                </Field>

                <Field label="General Notes">
                  <textarea value={form.notes}
                    onChange={e=>setForm(f=>({...f,notes:e.target.value}))}
                    rows={3} style={{...inp,resize:'vertical',lineHeight:1.5}}
                    placeholder="Any other notes…"/>
                </Field>

                <div style={{display:'flex',gap:10,paddingTop:4}}>
                  <button onClick={save} disabled={saving}
                    style={{flex:1,padding:'11px 0',
                      background:`linear-gradient(135deg,${GOLD},#FBBF24)`,
                      border:'none',borderRadius:8,color:'#1C1C1E',
                      fontSize:14,fontWeight:800,cursor:'pointer',opacity:saving?.6:1}}>
                    {saving?'Saving…':mode==='create'?'Create Log':'Save Changes'}
                  </button>
                  <button onClick={closePanel}
                    style={{padding:'11px 16px',background:'rgba(143,163,192,.1)',
                      border:`1px solid ${BORDER}`,borderRadius:8,color:DIM,
                      fontSize:14,cursor:'pointer'}}>
                    Cancel
                  </button>
                </div>
              </div>
            ):selected?(
              /* VIEW */
              <div style={{display:'flex',flexDirection:'column',gap:16}}>
                <div style={{background:RAISED,border:`1px solid ${BORDER}`,borderRadius:10,padding:16}}>
                  <div style={{fontSize:18,fontWeight:800,color:TEXT,marginBottom:6}}>
                    {new Date(selected.log_date+'T12:00:00').toLocaleDateString('en-US',
                      {weekday:'long',month:'long',day:'numeric',year:'numeric'})}
                  </div>
                  <div style={{display:'flex',gap:16,fontSize:13,color:DIM,flexWrap:'wrap'}}>
                    {selected.weather&&<span>{selected.weather}</span>}
                    {(selected.high_temp||selected.low_temp)&&(
                      <span><Thermometer size={15} weight="fill" color={DIM} style={{verticalAlign:'middle'}}/> {selected.high_temp??'?'}° / {selected.low_temp??'?'}°F</span>
                    )}
                    {selected.crew_count&&<span><HardHat size={15} weight="fill" color={DIM} style={{verticalAlign:'middle'}}/> {selected.crew_count} crew members</span>}
                    {selected.superintendent&&<span>Super: {selected.superintendent}</span>}
                  </div>
                </div>
                <Section label="Work Performed" value={selected.work_performed}/>
                <Section label="Delays / Issues" value={selected.delays} warn={!!selected.delays?.trim()}/>
                <Section label="Safety Notes" value={selected.safety_notes}/>
                <Section label="Materials Delivered" value={selected.materials_delivered}/>
                {selected.visitors&&<Section label="Visitors / Inspections" value={selected.visitors}/>}
                {selected.notes&&<Section label="General Notes" value={selected.notes}/>}
              </div>
            ):null}
          </div>
        </div>
      )}
    </div>
  );
}
