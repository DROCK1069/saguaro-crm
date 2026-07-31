'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { humanError } from '@/lib/errors';
import { useParams } from 'next/navigation';
import { getAuthHeaders } from '@/lib/supabase-browser';
import { SkeletonKPI, SkeletonRow } from '@/components/ui/Skeleton';
import { WarningCircle, CalendarBlank, X, Plus, TrendUp, CheckCircle, Clock, ListChecks } from '@phosphor-icons/react';
import { PremiumSurface, ModuleHero, StatCard, SectionCard, PremiumEmpty, goldButtonStyle, goldOutlineButtonStyle } from '@/components/ui/premium';

const GOLD='#F59E0B',DARK='#0a0a0a',RAISED='#141416',BORDER='rgba(255,255,255,0.12)',DIM='#CBD5E1',TEXT='#FFFFFF';
const GREEN='#1a8a4a',RED='#c03030',ORANGE='#B85C2A',BLUE='#F59E0B';

const STATUSES=['not_started','in_progress','completed','delayed','on_hold'];
const STATUS_LABELS:Record<string,string>={
  not_started:'Not Started',in_progress:'In Progress',
  completed:'Completed',delayed:'Delayed',on_hold:'On Hold',
};
const STATUS_COLORS:Record<string,string>={
  not_started:DIM,in_progress:GOLD,completed:GREEN,delayed:RED,on_hold:ORANGE,
};
const PHASES=['Pre-Construction','Foundation','Framing','MEP Rough','Insulation',
  'Drywall','Finishes','MEP Trim','Punch List','Closeout','Other'];

const inp:React.CSSProperties={
  width:'100%',padding:'9px 12px',background:'#1c1c1e',
  border:'1px solid rgba(255,255,255,0.12)',borderRadius:7,color:'#FFFFFF',
  fontSize:13,outline:'none',boxSizing:'border-box',
};
const EMPTY:Record<string,any>={
  name:'',phase:'',start_date:'',end_date:'',
  pct_complete:0,status:'not_started',predecessor:'',assigned_to:'',notes:'',
};

function Field({label,children}:{label:string;children:React.ReactNode}){
  return(
    <div>
      <label style={{display:'block',fontSize:11,fontWeight:700,color:DIM,
        textTransform:'uppercase',letterSpacing:.5,marginBottom:5}}>{label}</label>
      {children}
    </div>
  );
}

function daysBetween(a:string,b:string){
  return Math.max(1,Math.round((new Date(b).getTime()-new Date(a).getTime())/86400000));
}

/* ── Gantt bar chart ────────────────────────────────────────────── */
function GanttChart({tasks}:{tasks:any[]}){
  const withDates = tasks.filter(t=>
    t.start_date&&t.end_date
    &&!Number.isNaN(Date.parse(t.start_date))
    &&!Number.isNaN(Date.parse(t.end_date))
  );
  if(!withDates.length) return(
    <div style={{padding:40,textAlign:'center',color:DIM,fontSize:13}}>
      Add tasks with start &amp; end dates to see the Gantt chart.
    </div>
  );

  const allDates = withDates.flatMap(t=>[t.start_date,t.end_date]);
  const minDate  = new Date(allDates.reduce((m,d)=>d<m?d:m));
  const maxDate  = new Date(allDates.reduce((m,d)=>d>m?d:m));
  // Add padding
  minDate.setDate(minDate.getDate()-2);
  maxDate.setDate(maxDate.getDate()+5);
  const totalDays = daysBetween(minDate.toISOString().split('T')[0], maxDate.toISOString().split('T')[0]);

  function pct(date:string){
    return Math.max(0,Math.min(100,
      daysBetween(minDate.toISOString().split('T')[0],date)/totalDays*100
    ));
  }

  // Generate week markers
  const markers:Date[]=[];
  const cur=new Date(minDate);
  while(cur<=maxDate){
    markers.push(new Date(cur));
    cur.setDate(cur.getDate()+7);
  }

  const today=new Date().toISOString().split('T')[0];
  const todayPct=pct(today);

  return(
    <div style={{overflow:'auto'}}>
      {/* Week header */}
      <div style={{display:'flex',borderBottom:`1px solid ${BORDER}`,paddingBottom:6,marginBottom:4,
        paddingLeft:200,fontSize:10,color:DIM,position:'relative',minWidth:700}}>
        {markers.map(m=>(
          <div key={m.toISOString()} style={{
            position:'absolute',
            left:`calc(200px + ${pct(m.toISOString().split('T')[0])}%)`,
            fontSize:10,color:DIM,whiteSpace:'nowrap',transform:'translateX(-50%)',
          }}>
            {m.toLocaleDateString('en-US',{month:'short',day:'numeric'})}
          </div>
        ))}
        &nbsp;
      </div>

      {/* Rows */}
      {withDates.map(task=>{
        const left=pct(task.start_date);
        const width=Math.max(.5,pct(task.end_date)-left);
        const color=STATUS_COLORS[task.status]||DIM;
        const isDone=task.status==='completed';
        return(
          <div key={task.id} style={{display:'flex',alignItems:'center',
            minHeight:36,borderBottom:`1px solid rgba(255,255,255,0.08)`,minWidth:700}}>
            {/* Label */}
            <div style={{width:200,flexShrink:0,paddingRight:12,
              fontSize:12,fontWeight:600,color:isDone?DIM:TEXT,
              overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',
              textDecoration:isDone?'line-through':'none'}}>
              {task.name}
            </div>
            {/* Bar area */}
            <div style={{flex:1,position:'relative',height:24}}>
              {/* Today line */}
              <div style={{position:'absolute',left:`${todayPct}%`,top:0,bottom:0,
                width:1,background:'rgba(245, 158, 11,.5)',zIndex:1}}/>
              {/* Bar background */}
              <div style={{position:'absolute',left:`${left}%`,width:`${width}%`,
                top:4,height:16,borderRadius:3,
                background:`${color}33`,border:`1px solid ${color}66`}}>
                {/* Progress fill */}
                <div style={{
                  height:'100%',borderRadius:2,
                  background:color,opacity:.8,
                  width:`${task.pct_complete??0}%`,
                  transition:'width .3s',
                }}/>
                {/* Label on bar */}
                {width>8&&(
                  <div style={{position:'absolute',top:0,left:4,right:4,
                    fontSize:9,fontWeight:700,color:'#fff',
                    lineHeight:'16px',overflow:'hidden',whiteSpace:'nowrap',
                    textOverflow:'ellipsis',textShadow:'0 1px 2px rgba(0,0,0,.6)'}}>
                    {task.pct_complete??0}%
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function SchedulePage(){
  const {projectId}=useParams() as {projectId:string};
  const [tasks,setTasks]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState('');
  const [selected,setSelected]=useState<any>(null);
  const [mode,setMode]=useState<'view'|'edit'|'create'|null>(null);
  const [form,setForm]=useState<Record<string,any>>({...EMPTY});
  const [saving,setSaving]=useState(false);
  const [deleting,setDeleting]=useState(false);
  const [toast,setToast]=useState<{msg:string;type:'success'|'error'}|null>(null);
  const [viewMode,setViewMode]=useState<'gantt'|'list'>('gantt');
  const [search,setSearch]=useState('');
  const [filterStatus,setFilterStatus]=useState('all');
  const [filterPhase,setFilterPhase]=useState('all');

  const showToast=(msg:string,type:'success'|'error'='success')=>{
    setToast({msg,type}); setTimeout(()=>setToast(null),4000);
  };

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      setLoadError('');
      const h=await getAuthHeaders();
      const r=await fetch(`/api/schedule/list?projectId=${projectId}`,{headers:h});
      if (!r.ok) throw new Error('Failed to load data');
      const d=await r.json();
      setTasks(d.tasks||[]);
    }catch{setTasks([]);setLoadError('Failed to load. Please try again.');}
    finally{setLoading(false);}
  },[projectId]);

  useEffect(()=>{load();},[load]);

  function openCreate(){setForm({...EMPTY});setMode('create');setSelected(null);}
  function openEdit(task:any){
    setForm({name:task.name||'',phase:task.phase||'',
      start_date:task.start_date||'',end_date:task.end_date||'',
      pct_complete:task.pct_complete??0,status:task.status||'not_started',
      predecessor:task.predecessor||'',assigned_to:task.assigned_to||'',notes:task.notes||''});
    setSelected(task);setMode('edit');
  }
  function viewTask(task:any){setSelected(task);setMode('view');}
  function closePanel(){setSelected(null);setMode(null);}

  async function save(){
    if(!form.name.trim()){showToast('Task name is required','error');return;}
    setSaving(true);
    try{
      const h=await getAuthHeaders();
      if(mode==='create'){
        const r=await fetch('/api/schedule/create',{
          method:'POST',
          headers:{...h,'Content-Type':'application/json'},
          body:JSON.stringify({...form,projectId}),
        });
        if(!r.ok) throw new Error(await r.text());
        showToast('Task added');
      }else if(mode==='edit'&&selected){
        const r=await fetch(`/api/schedule/${selected.id}`,{
          method:'PUT',
          headers:{...h,'Content-Type':'application/json'},
          body:JSON.stringify({...form,pct_complete:Number(form.pct_complete)||0}),
        });
        if(!r.ok) throw new Error(await r.text());
        showToast('Task updated');
      }
      await load();closePanel();
    }catch(e:any){console.error(e);showToast(humanError(e,'Save failed. Please try again.'),'error');}
    finally{setSaving(false);}
  }

  async function deleteTask(task:any){
    if(!confirm(`Delete task "${task.name}"?`)) return;
    setDeleting(true);
    try{
      const h=await getAuthHeaders();
      const dr=await fetch(`/api/schedule/${task.id}`,{method:'DELETE',headers:h});
      if (!dr.ok) throw new Error('Delete failed');
      showToast('Task deleted');closePanel();await load();
    }catch{showToast('Delete failed','error');}
    finally{setDeleting(false);}
  }

  async function updatePct(task:any,pct:number){
    const newStatus=pct===100?'completed':pct>0?'in_progress':'not_started';
    try{
      const h=await getAuthHeaders();
      const pr=await fetch(`/api/schedule/${task.id}`,{
        method:'PUT',
        headers:{...h,'Content-Type':'application/json'},
        body:JSON.stringify({pct_complete:pct,status:newStatus}),
      });
      if (!pr.ok) throw new Error('Update failed');
      await load();
    }catch(e:any){console.error(e);showToast(humanError(e,'Something went wrong. Please try again.'),'error');}
  }

  const phases=Array.from(new Set(tasks.map((t:any)=>t.phase).filter(Boolean)));
  const filtered=tasks.filter((t:any)=>{
    const ms=!search||(t.name||'').toLowerCase().includes(search.toLowerCase())
      ||(t.phase||'').toLowerCase().includes(search.toLowerCase());
    const mst=filterStatus==='all'||t.status===filterStatus;
    const mp=filterPhase==='all'||t.phase===filterPhase;
    return ms&&mst&&mp;
  });

  const today=new Date().toISOString().split('T')[0];
  const allEnds=tasks.filter((t:any)=>t.end_date).map((t:any)=>t.end_date);
  const projectEnd=allEnds.length?allEnds.reduce((m,d)=>d>m?d:m):'';
  const daysLeft=projectEnd?Math.max(0,daysBetween(today,projectEnd)):0;
  const avgPct=tasks.length?Math.round(tasks.reduce((s:number,t:any)=>s+(t.pct_complete??0),0)/tasks.length):0;
  const delayedCount=tasks.filter((t:any)=>t.status==='delayed').length;
  const completedCount=tasks.filter((t:any)=>t.status==='completed').length;

  return(
    <div style={{display:'flex',height:'100%',minHeight:0,position:'relative'}}>
      {toast&&(
        <div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',zIndex:99999,
          padding:'12px 20px',borderRadius:8,color:'#fff',fontWeight:700,fontSize:14,pointerEvents:'none',
          background:toast.type==='success'?'rgba(26,138,74,.92)':'rgba(192,48,48,.92)'}}>
          {toast.msg}
        </div>
      )}

      <div style={{flex:1,overflow:'auto',minWidth:0}}>
        <PremiumSurface maxWidth={1600}>
          {/* Header */}
          <ModuleHero
            eyebrow="Schedule"
            eyebrowIcon={<CalendarBlank size={13} weight="fill" color={GOLD} />}
            title="Project"
            accent="Schedule"
            subtitle="Tasks, milestones & Gantt timeline"
            actions={<>
              {/* View toggle */}
              <div style={{display:'flex',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:12,overflow:'hidden'}}>
                {(['gantt','list'] as const).map(v=>(
                  <button key={v} onClick={()=>setViewMode(v)} className="pmBtn"
                    style={{padding:'9px 16px',background:viewMode===v?`rgba(245, 158, 11,.15)`:'transparent',
                      border:'none',color:viewMode===v?GOLD:DIM,fontSize:12,fontWeight:700,
                      cursor:'pointer',textTransform:'uppercase',letterSpacing:.5}}>
                    {v==='gantt'?'Gantt':'List'}
                  </button>
                ))}
              </div>
              <button onClick={openCreate} style={goldButtonStyle} className="pmBtn">
                <Plus size={15} weight="bold" /> Add Task
              </button>
            </>}
          />

          {/* KPIs */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12,marginBottom:24}}>
            {loading||loadError
              ? Array.from({length:4}).map((_,i)=><SkeletonKPI key={i}/>)
              : <>
                  <StatCard icon={<TrendUp size={19} weight="duotone" color={GREEN} />}
                    label="% Complete" value={`${avgPct}%`} accent={GREEN} sub="avg completion" delay={0.02} />
                  <StatCard icon={<Clock size={19} weight="duotone" color={GOLD} />}
                    label="Days Remaining" value={daysLeft?String(daysLeft):'—'} sub="to project end" delay={0.06} />
                  <StatCard icon={<CheckCircle size={19} weight="duotone" color={GOLD} />}
                    label="Tasks Complete" value={`${completedCount}/${tasks.length}`} accent={GOLD} sub="tasks finished" delay={0.10} />
                  <StatCard icon={<WarningCircle size={19} weight="duotone" color={delayedCount?RED:DIM} />}
                    label="Delayed" value={String(delayedCount)} accent={delayedCount?RED:undefined}
                    sub={delayedCount?'need attention':'on track'} delay={0.14} />
                </>}
          </div>

          {/* Gantt view */}
          {viewMode==='gantt'&&!loading&&!loadError&&tasks.length>0&&(
            <SectionCard title="Timeline" subtitle="Today marked with a gold line"
              icon={<CalendarBlank size={17} weight="duotone" color={GOLD} />}
              style={{marginBottom:20}} bodyStyle={{overflowX:'auto'}}>
              <GanttChart tasks={filtered.length?filtered:tasks}/>
            </SectionCard>
          )}

          {/* Filters (list view) */}
          {viewMode==='list'&&!loading&&!loadError&&tasks.length>0&&(
            <div style={{display:'flex',gap:10,marginBottom:18,flexWrap:'wrap'}}>
              <input value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="Search tasks…"
                style={{flex:1,minWidth:180,padding:'10px 12px',background:'rgba(255,255,255,0.04)',
                  border:'1px solid rgba(255,255,255,0.08)',borderRadius:10,color:TEXT,fontSize:13,outline:'none'}}/>
              <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
                style={{padding:'10px 12px',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',
                  borderRadius:10,color:filterStatus!=='all'?TEXT:DIM,fontSize:13,outline:'none'}}>
                <option value="all">All Statuses</option>
                {STATUSES.map(s=><option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
              <select value={filterPhase} onChange={e=>setFilterPhase(e.target.value)}
                style={{padding:'10px 12px',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',
                  borderRadius:10,color:filterPhase!=='all'?TEXT:DIM,fontSize:13,outline:'none'}}>
                <option value="all">All Phases</option>
                {phases.map((p:any)=><option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}

          {/* LOADING — skeleton rows, never computed zeros */}
          {loading&&(
            <SectionCard flush>
              {Array.from({length:6}).map((_,i)=><SkeletonRow key={i}/>)}
            </SectionCard>
          )}

          {/* ERROR — clear block with Retry, never fake/empty data */}
          {!loading&&loadError&&(
            <SectionCard>
              <PremiumEmpty
                tone="error"
                icon={<WarningCircle size={30} weight="duotone" color={RED} />}
                title="Couldn't load schedule"
                description="We couldn't load the project schedule. Check your connection and try again."
                action={<button onClick={load} style={goldOutlineButtonStyle} className="pmBtn">Retry</button>}
              />
            </SectionCard>
          )}

          {/* EMPTY — genuine zero results on success only */}
          {!loading&&!loadError&&tasks.length===0&&(
            <SectionCard>
              <PremiumEmpty
                icon={<CalendarBlank size={30} weight="duotone" color={GOLD} />}
                title="No tasks yet"
                description="Add your first task to start building the project schedule."
                action={<button onClick={openCreate} style={goldButtonStyle} className="pmBtn"><Plus size={15} weight="bold" /> Add First Task</button>}
              />
            </SectionCard>
          )}

          {/* List view */}
          {!loading&&!loadError&&viewMode==='list'&&filtered.length>0&&(
            <SectionCard title="Tasks" flush
              icon={<ListChecks size={17} weight="duotone" color={GOLD} />}
              action={<span style={{fontSize:12,color:DIM,fontWeight:700}}>{filtered.length} shown</span>}>
              <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead>
                  <tr style={{background:DARK}}>
                    {['Task','Phase','Start','End','Duration','Status','% Done','Assigned'].map(h=>(
                      <th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:11,
                        fontWeight:700,textTransform:'uppercase',letterSpacing:.5,
                        color:DIM,borderBottom:`1px solid ${BORDER}`,whiteSpace:'nowrap'}}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((task:any)=>{
                    const dur=task.start_date&&task.end_date?daysBetween(task.start_date,task.end_date):null;
                    const color=STATUS_COLORS[task.status]||DIM;
                    return(
                      <tr key={task.id}
                        onClick={()=>viewTask(task)}
                        style={{borderBottom:`1px solid rgba(255,255,255,0.08)`,cursor:'pointer',
                          background:selected?.id===task.id&&mode==='view'?'rgba(245, 158, 11,.05)':''}}
                        onMouseEnter={e=>e.currentTarget.style.background='rgba(245, 158, 11,.04)'}
                        onMouseLeave={e=>e.currentTarget.style.background=selected?.id===task.id&&mode==='view'?'rgba(245, 158, 11,.05)':''}>
                        <td style={{padding:'11px 14px',fontWeight:700,color:TEXT}}>{task.name}</td>
                        <td style={{padding:'11px 14px',color:DIM}}>{task.phase||'—'}</td>
                        <td style={{padding:'11px 14px',color:DIM,whiteSpace:'nowrap'}}>{task.start_date||'—'}</td>
                        <td style={{padding:'11px 14px',color:DIM,whiteSpace:'nowrap'}}>{task.end_date||'—'}</td>
                        <td style={{padding:'11px 14px',color:DIM}}>{dur?`${dur}d`:'—'}</td>
                        <td style={{padding:'11px 14px'}}>
                          <span style={{fontSize:10,fontWeight:700,padding:'3px 8px',borderRadius:20,
                            background:`${color}22`,color,textTransform:'uppercase',letterSpacing:.3}}>
                            {STATUS_LABELS[task.status]||task.status}
                          </span>
                        </td>
                        <td style={{padding:'11px 14px'}}>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <div style={{width:60,height:6,background:'rgba(255,255,255,0.12)',borderRadius:3,overflow:'hidden'}}>
                              <div style={{height:'100%',borderRadius:3,background:color,
                                width:`${task.pct_complete??0}%`}}/>
                            </div>
                            <span style={{fontSize:12,color,fontWeight:700}}>{task.pct_complete??0}%</span>
                          </div>
                        </td>
                        <td style={{padding:'11px 14px',color:DIM}}>{task.assigned_to||'—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </SectionCard>
          )}
        </PremiumSurface>
      </div>

      {/* Side panel */}
      {mode!==null&&(
        <div style={{width:460,borderLeft:`1px solid ${BORDER}`,background:DARK,
          overflow:'auto',flexShrink:0,display:'flex',flexDirection:'column'}}>
          <div style={{padding:'16px 20px',borderBottom:`1px solid ${BORDER}`,
            display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{fontWeight:800,fontSize:15,color:TEXT}}>
              {mode==='create'?'New Task':mode==='edit'?'Edit Task':'Task Detail'}
            </div>
            <div style={{display:'flex',gap:8}}>
              {mode==='view'&&selected&&(
                <>
                  <button onClick={()=>openEdit(selected)}
                    style={{padding:'6px 14px',background:'rgba(245,158,11,.1)',
                      border:`1px solid ${BLUE}44`,borderRadius:6,
                      color:'#FBBF24',fontSize:12,fontWeight:700,cursor:'pointer'}}>
                    Edit
                  </button>
                  <button onClick={()=>deleteTask(selected)} disabled={deleting}
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
                <X size={14} weight="regular" color={DIM} />
              </button>
            </div>
          </div>

          <div style={{flex:1,overflow:'auto',padding:20}}>
            {(mode==='create'||mode==='edit')?(
              <div style={{display:'flex',flexDirection:'column',gap:16}}>
                <Field label="Task Name *">
                  <input value={form.name}
                    onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                    style={inp} placeholder="Foundation excavation…"/>
                </Field>

                <Field label="Phase">
                  <select value={form.phase}
                    onChange={e=>setForm(f=>({...f,phase:e.target.value}))}
                    style={{...inp,padding:'9px 10px'}}>
                    <option value="">— Select Phase —</option>
                    {PHASES.map(p=><option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>

                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  <Field label="Start Date">
                    <input type="date" value={form.start_date}
                      onChange={e=>setForm(f=>({...f,start_date:e.target.value}))}
                      style={inp}/>
                  </Field>
                  <Field label="End Date">
                    <input type="date" value={form.end_date}
                      onChange={e=>setForm(f=>({...f,end_date:e.target.value}))}
                      style={inp}/>
                  </Field>
                </div>

                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  <Field label="Status">
                    <select value={form.status}
                      onChange={e=>setForm(f=>({...f,status:e.target.value}))}
                      style={{...inp,padding:'9px 10px'}}>
                      {STATUSES.map(s=><option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  </Field>
                  <Field label="% Complete">
                    <input type="number" min={0} max={100} value={form.pct_complete}
                      onChange={e=>setForm(f=>({...f,pct_complete:Number(e.target.value)}))}
                      style={inp}/>
                  </Field>
                </div>

                <Field label="Assigned To">
                  <input value={form.assigned_to}
                    onChange={e=>setForm(f=>({...f,assigned_to:e.target.value}))}
                    style={inp} placeholder="Subcontractor or person"/>
                </Field>

                <Field label="Predecessor (task name or #)">
                  <input value={form.predecessor}
                    onChange={e=>setForm(f=>({...f,predecessor:e.target.value}))}
                    style={inp} placeholder="e.g. Foundation"/>
                </Field>

                <Field label="Notes">
                  <textarea value={form.notes}
                    onChange={e=>setForm(f=>({...f,notes:e.target.value}))}
                    rows={3} style={{...inp,resize:'vertical',lineHeight:1.5}}
                    placeholder="Any additional notes…"/>
                </Field>

                <div style={{display:'flex',gap:10,paddingTop:4}}>
                  <button onClick={save} disabled={saving} className="pmBtn"
                    style={{...goldButtonStyle,flex:1,padding:'11px 0',opacity:saving?.6:1}}>
                    {saving?'Saving…':mode==='create'?'Add Task':'Save Changes'}
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
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                {/* Task header */}
                <div style={{background:RAISED,border:`1px solid ${BORDER}`,borderRadius:10,padding:16}}>
                  <div style={{fontSize:16,fontWeight:800,color:TEXT,marginBottom:8}}>{selected.name}</div>
                  <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
                    {selected.phase&&(
                      <span style={{fontSize:11,fontWeight:700,padding:'3px 9px',borderRadius:20,
                        background:'rgba(245,158,11,.15)',color:'#FBBF24',
                        textTransform:'uppercase',letterSpacing:.3}}>
                        {selected.phase}
                      </span>
                    )}
                    <span style={{fontSize:11,fontWeight:700,padding:'3px 9px',borderRadius:20,
                      background:`${STATUS_COLORS[selected.status]||DIM}22`,
                      color:STATUS_COLORS[selected.status]||DIM,
                      textTransform:'uppercase',letterSpacing:.3}}>
                      {STATUS_LABELS[selected.status]||selected.status}
                    </span>
                  </div>
                  {/* Progress slider */}
                  <div style={{marginBottom:8}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                      <span style={{fontSize:11,color:DIM}}>Progress</span>
                      <span style={{fontSize:12,fontWeight:800,color:STATUS_COLORS[selected.status]||GREEN}}>
                        {selected.pct_complete??0}%
                      </span>
                    </div>
                    <div style={{background:'rgba(255,255,255,0.12)',borderRadius:4,height:10,overflow:'hidden'}}>
                      <div style={{height:'100%',borderRadius:4,
                        background:STATUS_COLORS[selected.status]||GREEN,
                        width:`${selected.pct_complete??0}%`,transition:'width .3s'}}/>
                    </div>
                  </div>
                  {/* Quick update buttons */}
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    {[25,50,75,100].map(pct=>(
                      <button key={pct} onClick={()=>updatePct(selected,pct)}
                        style={{flex:1,padding:'6px 0',background:'rgba(245, 158, 11,.1)',
                          border:`1px solid rgba(245, 158, 11,.3)`,borderRadius:6,
                          color:GOLD,fontSize:11,fontWeight:700,cursor:'pointer'}}>
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  {[
                    {l:'Start Date',v:selected.start_date},
                    {l:'End Date',v:selected.end_date},
                    {l:'Duration',v:selected.start_date&&selected.end_date?
                      `${daysBetween(selected.start_date,selected.end_date)} days`:null},
                    {l:'Assigned To',v:selected.assigned_to},
                    {l:'Predecessor',v:selected.predecessor},
                  ].filter(x=>x.v).map(x=>(
                    <div key={x.l} style={{background:'#141416',border:`1px solid ${BORDER}`,
                      borderRadius:8,padding:'10px 12px'}}>
                      <div style={{fontSize:10,fontWeight:700,color:DIM,textTransform:'uppercase',
                        letterSpacing:.5,marginBottom:4}}>{x.l}</div>
                      <div style={{fontSize:13,color:TEXT}}>{x.v}</div>
                    </div>
                  ))}
                </div>

                {selected.notes&&(
                  <div style={{background:'#141416',border:`1px solid ${BORDER}`,borderRadius:8,padding:'12px 14px'}}>
                    <div style={{fontSize:10,fontWeight:700,color:DIM,textTransform:'uppercase',
                      letterSpacing:.5,marginBottom:6}}>Notes</div>
                    <div style={{fontSize:13,color:TEXT,lineHeight:1.6,whiteSpace:'pre-wrap'}}>{selected.notes}</div>
                  </div>
                )}
              </div>
            ):null}
          </div>
        </div>
      )}
    </div>
  );
}
