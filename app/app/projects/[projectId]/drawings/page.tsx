'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { humanError } from '@/lib/errors';
import { useParams } from 'next/navigation';
import { getAuthHeaders } from '@/lib/supabase-browser';
import { Plus, Ruler, X, Stack, CheckCircle, Eye, SquaresFour } from '@phosphor-icons/react';
import { PremiumSurface, ModuleHero, SectionCard, StatCard, PremiumEmpty, goldButtonStyle, ghostButtonStyle } from '@/components/ui/premium';

const GOLD='#F59E0B',DARK='#0a0a0a',RAISED='#141416',BORDER='rgba(255,255,255,0.12)',DIM='#CBD5E1',TEXT='#FFFFFF';
const GREEN='#1a8a4a',RED='#c03030';
// Premium kit surface language (match components/ui/premium.tsx) --------------
const PSURFACE='linear-gradient(160deg, rgba(255,255,255,0.045), rgba(255,255,255,0.012))';
const PBORDER='rgba(255,255,255,0.08)';

const DISCIPLINES=['Architectural','Structural','Mechanical','Electrical','Plumbing','Civil','Landscape','Other'];
const STATUSES=['current','superseded','for_review','void'];
const STATUS_LABELS:Record<string,string>={
  current:'Current',
  superseded:'Superseded',
  for_review:'For Review',
  void:'Void',
};
const STATUS_COLORS:Record<string,string>={
  current:GREEN,
  superseded:DIM,
  for_review:GOLD,
  void:RED,
};

const DISCIPLINE_COLORS:Record<string,string>={
  Architectural:'#FBBF24',
  Structural:'#f97316',
  Mechanical:'#a78bfa',
  Electrical:GOLD,
  Plumbing:'#22d3ee',
  Civil:GREEN,
  Landscape:'#84cc16',
  Other:DIM,
};

const inp:React.CSSProperties={
  width:'100%',padding:'9px 12px',background:'#1c1c1e',
  border:`1px solid ${BORDER}`,borderRadius:7,color:TEXT,
  fontSize:13,outline:'none',boxSizing:'border-box',
};

const EMPTY_FORM={
  drawing_number:'',title:'',discipline:'Architectural',
  revision:0,revision_date:'',status:'current',url:'',notes:'',
};

function Pill({label,color}:{label:string;color:string}){
  return(
    <span style={{fontSize:10,fontWeight:700,padding:'3px 9px',borderRadius:20,
      background:`${color}22`,color,textTransform:'uppercase',letterSpacing:.3,whiteSpace:'nowrap'}}>
      {label}
    </span>
  );
}

function FieldLabel({label}:{label:string}){
  return(
    <label style={{display:'block',fontSize:11,fontWeight:700,color:DIM,
      textTransform:'uppercase',letterSpacing:.5,marginBottom:5}}>{label}</label>
  );
}

function InfoCard({label,value}:{label:string;value:string|undefined|null}){
  if(!value) return null;
  return(
    <div style={{background:PSURFACE,border:`1px solid ${PBORDER}`,borderRadius:10,padding:'10px 12px'}}>
      <div style={{fontSize:10,fontWeight:700,color:DIM,textTransform:'uppercase',letterSpacing:.5,marginBottom:4}}>{label}</div>
      <div style={{fontSize:13,color:TEXT}}>{value}</div>
    </div>
  );
}

function fmtDate(s:string|null|undefined){
  if(!s) return '—';
  return new Date(s+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}

export default function DrawingsPage(){
  const {projectId}=useParams() as {projectId:string};
  const [drawings,setDrawings]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState('');
  const [selected,setSelected]=useState<any>(null);
  const [mode,setMode]=useState<'view'|'edit'|'create'|null>(null);
  const [form,setForm]=useState<Record<string,any>>({...EMPTY_FORM});
  const [saving,setSaving]=useState(false);
  const [deleting,setDeleting]=useState(false);
  const [toast,setToast]=useState<{msg:string;type:'success'|'error'}|null>(null);
  const [search,setSearch]=useState('');
  const [filterDiscipline,setFilterDiscipline]=useState('all');
  const [filterStatus,setFilterStatus]=useState('all');
  const [groupByDiscipline,setGroupByDiscipline]=useState(true);

  const showToast=(msg:string,type:'success'|'error'='success')=>{
    setToast({msg,type}); setTimeout(()=>setToast(null),4000);
  };

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      setLoadError('');
      const h=await getAuthHeaders();
      const r=await fetch(`/api/drawings/list?projectId=${projectId}`,{headers:h});
      if (!r.ok) throw new Error('Failed to load data');
      const d=await r.json();
      setDrawings(d.drawings||[]);
    }catch{setDrawings([]);setLoadError('Failed to load. Please try again.');}
    finally{setLoading(false);}
  },[projectId]);

  useEffect(()=>{load();},[load]);

  function openCreate(){
    setForm({...EMPTY_FORM});
    setMode('create');setSelected(null);
  }
  function openEdit(drawing:any){
    setForm({
      drawing_number:drawing.drawing_number||'',
      title:drawing.title||'',
      discipline:drawing.discipline||'Architectural',
      revision:drawing.revision??0,
      revision_date:drawing.revision_date?drawing.revision_date.substring(0,10):'',
      status:drawing.status||'current',
      url:drawing.url||'',
      notes:drawing.notes||'',
    });
    setSelected(drawing);setMode('edit');
  }
  function viewDrawing(drawing:any){setSelected(drawing);setMode('view');}
  function closePanel(){setSelected(null);setMode(null);}

  async function save(){
    if(!form.drawing_number.trim()||!form.title.trim()){
      showToast('Drawing number and title are required','error');return;
    }
    setSaving(true);
    try{
      const h=await getAuthHeaders();
      const payload={
        ...form,
        revision:Number(form.revision)||0,
        revision_date:form.revision_date||null,
      };
      if(mode==='create'){
        const r=await fetch('/api/drawings/create',{
          method:'POST',
          headers:{...h,'Content-Type':'application/json'},
          body:JSON.stringify({...payload,projectId}),
        });
        if(!r.ok) throw new Error(await r.text());
        showToast('Drawing added');
      }else if(mode==='edit'&&selected){
        const r=await fetch(`/api/drawings/${selected.id}`,{
          method:'PUT',
          headers:{...h,'Content-Type':'application/json'},
          body:JSON.stringify(payload),
        });
        if(!r.ok) throw new Error(await r.text());
        showToast('Drawing updated');
      }
      await load();closePanel();
    }catch(e:any){console.error(e);showToast(humanError(e,'Save failed. Please try again.'),'error');}
    finally{setSaving(false);}
  }

  async function deleteDrawing(drawing:any){
    if(!confirm(`Delete drawing "${drawing.drawing_number} - ${drawing.title}"?`)) return;
    setDeleting(true);
    try{
      const h=await getAuthHeaders();
      const dr=await fetch(`/api/drawings/${drawing.id}`,{method:'DELETE',headers:h});
      if (!dr.ok) throw new Error('Delete failed');
      showToast('Drawing deleted');closePanel();await load();
    }catch{showToast('Delete failed','error');}
    finally{setDeleting(false);}
  }

  const total=drawings.length;
  const current=drawings.filter(d=>d.status==='current').length;
  const forReview=drawings.filter(d=>d.status==='for_review').length;
  const disciplineCount=new Set(drawings.map(d=>d.discipline).filter(Boolean)).size;

  const filtered=drawings.filter(d=>{
    const ms=!search
      ||(d.drawing_number||'').toLowerCase().includes(search.toLowerCase())
      ||(d.title||'').toLowerCase().includes(search.toLowerCase());
    const md=filterDiscipline==='all'||d.discipline===filterDiscipline;
    const mst=filterStatus==='all'||d.status===filterStatus;
    return ms&&md&&mst;
  });

  // Group by discipline
  const grouped:Record<string,any[]>={};
  if(groupByDiscipline){
    for(const d of filtered){
      const disc=d.discipline||'Other';
      if(!grouped[disc]) grouped[disc]=[];
      grouped[disc].push(d);
    }
  }

  function DrawingRow({drawing}:{drawing:any}){
    const isSel=selected?.id===drawing.id&&mode==='view';
    return(
      <tr
        onClick={()=>viewDrawing(drawing)}
        style={{background:isSel?'rgba(245, 158, 11,.07)':'transparent',
          borderBottom:`1px solid rgba(255,255,255,0.06)`,cursor:'pointer',transition:'background .1s'}}
        onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background='rgba(255,255,255,0.03)';}}
        onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background='transparent';}}>
        <td style={{padding:'11px 14px',color:GOLD,fontWeight:700,whiteSpace:'nowrap'}}>
          {drawing.drawing_number||'—'}
        </td>
        <td style={{padding:'11px 14px',color:TEXT,maxWidth:240}}>
          <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
            {drawing.title||'—'}
          </div>
        </td>
        <td style={{padding:'11px 14px'}}>
          <Pill label={drawing.discipline||'Other'}
            color={DISCIPLINE_COLORS[drawing.discipline]||DIM}/>
        </td>
        <td style={{padding:'11px 14px',color:DIM,textAlign:'center'}}>
          R{drawing.revision??0}
        </td>
        <td style={{padding:'11px 14px',color:DIM,whiteSpace:'nowrap'}}>
          {fmtDate(drawing.revision_date)}
        </td>
        <td style={{padding:'11px 14px'}}>
          <Pill label={STATUS_LABELS[drawing.status]||drawing.status}
            color={STATUS_COLORS[drawing.status]||DIM}/>
        </td>
        <td style={{padding:'11px 14px'}}>
          {drawing.url?(
            <a href={drawing.url} target="_blank" rel="noreferrer"
              onClick={e=>e.stopPropagation()}
              style={{padding:'4px 10px',background:'rgba(245,158,11,.1)',
                border:'1px solid rgba(245,158,11,.3)',borderRadius:6,
                color:'#FBBF24',fontSize:11,fontWeight:700,textDecoration:'none',
                whiteSpace:'nowrap'}}>
              View PDF
            </a>
          ):(
            <span style={{fontSize:11,color:DIM}}>No link</span>
          )}
        </td>
      </tr>
    );
  }

  const tableHead=(
    <thead>
      <tr style={{background:'rgba(255,255,255,0.02)'}}>
        {['Drawing #','Title','Discipline','Rev','Rev Date','Status','Link'].map(h=>(
          <th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:700,
            textTransform:'uppercase',letterSpacing:.5,color:DIM,
            borderBottom:`1px solid ${PBORDER}`,whiteSpace:'nowrap'}}>
            {h}
          </th>
        ))}
      </tr>
    </thead>
  );

  return(
    <>
      <style>{`@keyframes drawerIn{from{transform:translateX(100%);opacity:.4}to{transform:translateX(0);opacity:1}}`}</style>

      {toast&&(
        <div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',zIndex:99999,
          padding:'12px 20px',borderRadius:8,color:'#fff',fontWeight:700,fontSize:14,pointerEvents:'none',
          background:toast.type==='success'?'rgba(26,138,74,.92)':'rgba(192,48,48,.92)'}}>
          {toast.msg}
        </div>
      )}

      <PremiumSurface maxWidth={1600}>
        {/* Header */}
        <ModuleHero
          eyebrow="Drawings"
          eyebrowIcon={<Ruler size={13} weight="fill" color={GOLD}/>}
          title="Drawing"
          accent="Register"
          subtitle="Architectural and engineering drawing sets"
          actions={
            <button onClick={openCreate} style={goldButtonStyle} className="pmBtn">
              <Plus size={15} weight="bold"/> Add Drawing
            </button>
          }
        />

        {/* KPIs */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12,marginBottom:24}}>
          <StatCard icon={<Stack size={19} weight="duotone" color="#FBBF24"/>} label="Total Drawings" value={String(total)} accent="#FBBF24" sub="in register" delay={0.02}/>
          <StatCard icon={<CheckCircle size={19} weight="duotone" color={GREEN}/>} label="Current" value={String(current)} accent={GREEN} sub="active sheets" delay={0.06}/>
          <StatCard icon={<Eye size={19} weight="duotone" color={GOLD}/>} label="For Review" value={String(forReview)} accent={GOLD} sub="awaiting review" delay={0.10}/>
          <StatCard icon={<SquaresFour size={19} weight="duotone" color="#a78bfa"/>} label="Disciplines" value={String(disciplineCount)} accent="#a78bfa" sub="represented" delay={0.14}/>
        </div>

        {/* Filters + view toggle */}
        <div style={{display:'flex',gap:10,marginBottom:18,flexWrap:'wrap',alignItems:'center'}}>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search drawings..."
            style={{flex:1,minWidth:180,padding:'9px 14px',background:RAISED,
              border:`1px solid ${PBORDER}`,borderRadius:10,color:TEXT,fontSize:13,outline:'none'}}/>
          <select value={filterDiscipline} onChange={e=>setFilterDiscipline(e.target.value)}
            style={{padding:'9px 14px',background:RAISED,border:`1px solid ${PBORDER}`,
              borderRadius:10,color:filterDiscipline!=='all'?TEXT:DIM,fontSize:13,outline:'none'}}>
            <option value="all">All Disciplines</option>
            {DISCIPLINES.map(d=><option key={d} value={d}>{d}</option>)}
          </select>
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
            style={{padding:'9px 14px',background:RAISED,border:`1px solid ${PBORDER}`,
              borderRadius:10,color:filterStatus!=='all'?TEXT:DIM,fontSize:13,outline:'none'}}>
            <option value="all">All Statuses</option>
            {STATUSES.map(s=><option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          {/* View toggle */}
          <div style={{display:'flex',background:RAISED,border:`1px solid ${PBORDER}`,borderRadius:10,overflow:'hidden'}}>
            <button onClick={()=>setGroupByDiscipline(true)}
              style={{padding:'9px 15px',border:'none',cursor:'pointer',fontSize:12,fontWeight:700,
                background:groupByDiscipline?GOLD:'transparent',
                color:groupByDiscipline?DARK:DIM}}>
              By Discipline
            </button>
            <button onClick={()=>setGroupByDiscipline(false)}
              style={{padding:'9px 15px',border:'none',cursor:'pointer',fontSize:12,fontWeight:700,
                background:!groupByDiscipline?GOLD:'transparent',
                color:!groupByDiscipline?DARK:DIM}}>
              Flat List
            </button>
          </div>
        </div>

        {loading&&(
          <SectionCard>
            <div style={{padding:24,textAlign:'center',color:DIM}}>Loading drawings...</div>
          </SectionCard>
        )}

        {!loading&&loadError&&(
          <div style={{background:'rgba(192,48,48,.12)',border:'1px solid rgba(192,48,48,.3)',borderRadius:12,padding:'12px 16px',marginBottom:20,color:'#f0a0a0',fontSize:13}}>
            {loadError}
          </div>
        )}

        {!loading&&filtered.length===0&&(
          <SectionCard>
            <PremiumEmpty
              icon={<Ruler size={30} weight="duotone" color={GOLD}/>}
              title={drawings.length===0?'No drawings yet':'No drawings match your filters'}
              description={drawings.length===0?'Add drawing sheets to track the project drawing set.':'Try adjusting your search or filters.'}
              action={drawings.length===0?(
                <button onClick={openCreate} style={goldButtonStyle} className="pmBtn">
                  <Plus size={15} weight="bold"/> Add First Drawing
                </button>
              ):undefined}
            />
          </SectionCard>
        )}

        {!loading&&filtered.length>0&&groupByDiscipline&&(
          <div style={{display:'flex',flexDirection:'column',gap:20}}>
            {Object.entries(grouped).map(([discipline,discDrawings])=>(
              <SectionCard
                key={discipline}
                flush
                accent={DISCIPLINE_COLORS[discipline]||DIM}
                icon={<div style={{width:13,height:13,borderRadius:4,background:DISCIPLINE_COLORS[discipline]||DIM}}/>}
                title={discipline}
                subtitle={`${discDrawings.length} sheet${discDrawings.length===1?'':'s'}`}
              >
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                    {tableHead}
                    <tbody>
                      {discDrawings.map(d=><DrawingRow key={d.id} drawing={d}/>)}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            ))}
          </div>
        )}

        {!loading&&filtered.length>0&&!groupByDiscipline&&(
          <SectionCard flush icon={<Ruler size={17} weight="duotone" color={GOLD}/>} title="All Drawings" subtitle={`${filtered.length} sheet${filtered.length===1?'':'s'}`}>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                {tableHead}
                <tbody>
                  {filtered.map(d=><DrawingRow key={d.id} drawing={d}/>)}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}
      </PremiumSurface>

      {/* Side Panel — premium slide-over */}
      {mode!==null&&(
        <div style={{position:'fixed',top:0,right:0,bottom:0,width:'min(460px,100%)',zIndex:600,
          background:'#0b1119',borderLeft:`1px solid ${PBORDER}`,
          boxShadow:'-28px 0 70px -24px rgba(0,0,0,.75)',
          overflow:'auto',display:'flex',flexDirection:'column',
          animation:'drawerIn .28s cubic-bezier(.2,.7,.3,1)'}}>
          <div style={{padding:'16px 20px',borderBottom:`1px solid ${PBORDER}`,
            display:'flex',alignItems:'center',justifyContent:'space-between',
            position:'sticky',top:0,background:'#0b1119',zIndex:2}}>
            <div style={{fontWeight:800,fontSize:15,color:TEXT}}>
              {mode==='create'?'Add Drawing':mode==='edit'?'Edit Drawing':'Drawing Detail'}
            </div>
            <div style={{display:'flex',gap:8}}>
              {mode==='view'&&selected&&(
                <>
                  <button onClick={()=>openEdit(selected)}
                    style={{padding:'6px 14px',background:'rgba(245,158,11,.12)',
                      border:'1px solid rgba(245,158,11,.35)',borderRadius:8,
                      color:'#FBBF24',fontSize:12,fontWeight:700,cursor:'pointer'}}>
                    Edit
                  </button>
                  <button onClick={()=>deleteDrawing(selected)} disabled={deleting}
                    style={{padding:'6px 14px',background:'rgba(192,48,48,.12)',
                      border:`1px solid ${RED}55`,borderRadius:8,
                      color:'#e88a8a',fontSize:12,fontWeight:700,cursor:'pointer'}}>
                    {deleting?'...':'Delete'}
                  </button>
                </>
              )}
              <button onClick={closePanel}
                style={{padding:'6px 10px',background:'rgba(255,255,255,0.04)',
                  border:`1px solid ${PBORDER}`,borderRadius:8,color:DIM,fontSize:12,cursor:'pointer',display:'inline-flex',alignItems:'center'}}>
                <X size={14} weight="bold" color={DIM}/>
              </button>
            </div>
          </div>

          <div style={{flex:1,padding:20}}>
            {(mode==='create'||mode==='edit')?(
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  <div>
                    <FieldLabel label="Drawing # *"/>
                    <input value={form.drawing_number}
                      onChange={e=>setForm(f=>({...f,drawing_number:e.target.value}))}
                      style={inp} placeholder="e.g. A1.01"/>
                  </div>
                  <div>
                    <FieldLabel label="Revision"/>
                    <input type="number" min={0} value={form.revision}
                      onChange={e=>setForm(f=>({...f,revision:e.target.value}))}
                      style={inp}/>
                  </div>
                </div>
                <div>
                  <FieldLabel label="Title *"/>
                  <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}
                    style={inp} placeholder="e.g. Floor Plan - Level 1"/>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  <div>
                    <FieldLabel label="Discipline"/>
                    <select value={form.discipline}
                      onChange={e=>setForm(f=>({...f,discipline:e.target.value}))}
                      style={{...inp,padding:'9px 10px'}}>
                      {DISCIPLINES.map(d=><option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <FieldLabel label="Status"/>
                    <select value={form.status}
                      onChange={e=>setForm(f=>({...f,status:e.target.value}))}
                      style={{...inp,padding:'9px 10px'}}>
                      {STATUSES.map(s=><option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <FieldLabel label="Revision Date"/>
                  <input type="date" value={form.revision_date}
                    onChange={e=>setForm(f=>({...f,revision_date:e.target.value}))}
                    style={inp}/>
                </div>
                <div>
                  <FieldLabel label="PDF / Drawing URL"/>
                  <input value={form.url} onChange={e=>setForm(f=>({...f,url:e.target.value}))}
                    style={inp} placeholder="https://..."/>
                </div>
                <div>
                  <FieldLabel label="Notes"/>
                  <textarea value={form.notes}
                    onChange={e=>setForm(f=>({...f,notes:e.target.value}))}
                    rows={3} style={{...inp,resize:'vertical',lineHeight:1.5}}
                    placeholder="Revision notes, superseded by, etc."/>
                </div>
                <div style={{display:'flex',gap:10,paddingTop:4}}>
                  <button onClick={save} disabled={saving} className="pmBtn"
                    style={{...goldButtonStyle,flex:1,opacity:saving?0.6:1,cursor:saving?'not-allowed':'pointer'}}>
                    {saving?'Saving...':mode==='create'?'Add Drawing':'Save Changes'}
                  </button>
                  <button onClick={closePanel} style={{...ghostButtonStyle}}>
                    Cancel
                  </button>
                </div>
              </div>
            ):selected?(
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                {/* Header card */}
                <div style={{background:PSURFACE,border:`1px solid ${PBORDER}`,borderRadius:12,padding:16}}>
                  <div style={{fontSize:12,color:GOLD,fontWeight:700,marginBottom:4}}>
                    {selected.drawing_number||'—'} &bull; R{selected.revision??0}
                  </div>
                  <div style={{fontSize:16,fontWeight:800,color:TEXT,marginBottom:10}}>
                    {selected.title}
                  </div>
                  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                    <Pill label={selected.discipline||'Other'}
                      color={DISCIPLINE_COLORS[selected.discipline]||DIM}/>
                    <Pill label={STATUS_LABELS[selected.status]||selected.status}
                      color={STATUS_COLORS[selected.status]||DIM}/>
                  </div>
                </div>

                {/* Metadata */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <InfoCard label="Revision #" value={`R${selected.revision??0}`}/>
                  <InfoCard label="Revision Date" value={fmtDate(selected.revision_date)}/>
                  <InfoCard label="Status" value={STATUS_LABELS[selected.status]||selected.status}/>
                  <InfoCard label="Discipline" value={selected.discipline}/>
                </div>

                {selected.notes&&(
                  <div style={{background:PSURFACE,border:`1px solid ${PBORDER}`,borderRadius:10,padding:'12px 14px'}}>
                    <div style={{fontSize:10,fontWeight:700,color:DIM,textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>Notes</div>
                    <div style={{fontSize:13,color:TEXT,lineHeight:1.6,whiteSpace:'pre-wrap'}}>{selected.notes}</div>
                  </div>
                )}

                {selected.url&&(
                  <a href={selected.url} target="_blank" rel="noreferrer"
                    style={{display:'block',padding:'12px 14px',
                      background:'rgba(245,158,11,.1)',
                      border:'1px solid rgba(245,158,11,.3)',borderRadius:10,
                      color:'#FBBF24',fontSize:13,fontWeight:700,textDecoration:'none',
                      textAlign:'center'}}>
                    View PDF / Drawing
                  </a>
                )}
              </div>
            ):null}
          </div>
        </div>
      )}
    </>
  );
}
