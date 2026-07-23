'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { FolderOpen, MagnifyingGlass, Plus, ArrowRight } from '@phosphor-icons/react';
import { colors, radius, shadow } from '../../../lib/design-tokens';

// Reconciled to the design-token ramp (no more bluish slab literals).
const GOLD=colors.gold,RAISED=colors.raised,BORDER=colors.border,DIM=colors.textMuted,TEXT=colors.text;
const SUNKEN=colors.dark;            // inset stat tiles on a raised card
const BORDER_STRONG='rgba(255,255,255,0.16)';
const fmt = (n:number) => '$'+((n||0).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0}));

function statusStyle(s:string):{bg:string,c:string}{
  if(s==='active')    return {bg:'rgba(34,197,94,.12)',c:colors.green};
  if(s==='bidding')   return {bg:'rgba(245, 158, 11,.14)',c:GOLD};
  if(s==='planning')  return {bg:'rgba(99,102,241,.14)',c:colors.blue};
  if(s==='closed'||s==='complete') return {bg:'rgba(255,255,255,.06)',c:colors.textDim};
  return {bg:'rgba(255,255,255,.06)',c:colors.textDim};
}

export default function ProjectsPage() {
  const [projects,setProjects]  = useState<any[]>([]);
  const [loading,setLoading]    = useState(true);
  const [error,setError]        = useState('');
  const [search,setSearch]      = useState('');
  const [statusFilter,setStatusFilter] = useState('all');

  useEffect(()=>{
    (async()=>{
      try{
        const r = await fetch('/api/projects/list');
        if(!r.ok) throw new Error(await r.text());
        const d = await r.json();
        setProjects(d.projects ?? []);
      }catch(e:any){
        setError(e.message||'Failed to load projects');
      }finally{
        setLoading(false);
      }
    })();
  },[]);

  const filtered = projects.filter(p=>{
    const matchStatus = statusFilter==='all'||p.status===statusFilter;
    const matchSearch = !search||p.name?.toLowerCase().includes(search.toLowerCase())||p.address?.toLowerCase().includes(search.toLowerCase());
    return matchStatus&&matchSearch;
  });

  return (
    <div style={{padding:'28px 32px',maxWidth:1400,margin:'0 auto'}}>
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:28,flexWrap:'wrap',gap:14}}>
        <div>
          <h1 style={{margin:0,fontSize:24,fontWeight:700,lineHeight:1.2,letterSpacing:'-0.02em',color:TEXT}}>Projects</h1>
          <div style={{fontSize:13,color:DIM,marginTop:6}}>
            {loading ? 'Loading…' : `${filtered.length} project${filtered.length!==1?'s':''}`}
          </div>
        </div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
          <div style={{position:'relative',display:'flex',alignItems:'center'}}>
            <MagnifyingGlass size={15} weight="bold" color={colors.textDim} style={{position:'absolute',left:12,pointerEvents:'none'}}/>
            <input
              value={search}
              onChange={e=>setSearch(e.target.value)}
              placeholder="Search projects…"
              style={{padding:'9px 14px 9px 34px',background:RAISED,border:`1px solid ${BORDER}`,borderRadius:radius.xl,color:TEXT,fontSize:13,outline:'none',width:220}}
              onFocus={e=>{e.currentTarget.style.borderColor=colors.gold;e.currentTarget.style.boxShadow=`0 0 0 3px rgba(245, 158, 11,.12)`}}
              onBlur={e=>{e.currentTarget.style.borderColor=BORDER;e.currentTarget.style.boxShadow='none'}}
            />
          </div>
          <select
            value={statusFilter}
            onChange={e=>setStatusFilter(e.target.value)}
            style={{padding:'9px 12px',background:RAISED,border:`1px solid ${BORDER}`,borderRadius:radius.xl,color:TEXT,fontSize:13,cursor:'pointer',outline:'none'}}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="planning">Planning</option>
            <option value="bidding">Bidding</option>
            <option value="complete">Complete</option>
            <option value="closed">Closed</option>
          </select>
          <Link
            href="/app/projects/new"
            style={{display:'inline-flex',alignItems:'center',gap:7,padding:'9px 18px',background:`linear-gradient(135deg,${GOLD},${colors.goldLight})`,color:colors.darkAlt,borderRadius:radius.xl,fontWeight:700,fontSize:13,textDecoration:'none',boxShadow:shadow.sm}}
          >
            <Plus size={15} weight="bold"/> New Project
          </Link>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{background:'rgba(239,68,68,.10)',border:`1px solid rgba(239,68,68,.28)`,borderRadius:radius.xl,padding:'12px 16px',marginBottom:20,color:colors.red,fontSize:13}}>
          {error}
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(360px,1fr))',gap:18}}>
          {[1,2,3,4].map(i=>(
            <div key={i} style={{background:RAISED,border:`1px solid ${BORDER}`,borderRadius:14,padding:22,height:190,boxShadow:shadow.sm,animation:'pulse 1.6s ease-in-out infinite'}}>
              <div style={{height:16,background:colors.raisedAlt,borderRadius:6,marginBottom:10,width:'60%'}}/>
              <div style={{height:12,background:colors.raisedAlt,borderRadius:6,marginBottom:18,width:'40%'}}/>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div style={{height:52,background:SUNKEN,border:`1px solid ${colors.borderDim}`,borderRadius:radius.lg}}/>
                <div style={{height:52,background:SUNKEN,border:`1px solid ${colors.borderDim}`,borderRadius:radius.lg}}/>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length===0 && (
        <div style={{
          display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',
          padding:'64px 24px',background:RAISED,border:`1px solid ${BORDER}`,
          borderRadius:14,boxShadow:shadow.sm,maxWidth:520,margin:'0 auto',
        }}>
          <div style={{
            width:64,height:64,borderRadius:radius['2xl'],display:'flex',alignItems:'center',justifyContent:'center',
            background:'rgba(245, 158, 11,.10)',border:`1px solid rgba(245, 158, 11,.20)`,marginBottom:20,
          }}>
            {projects.length===0
              ? <FolderOpen size={30} weight="duotone" color={GOLD}/>
              : <MagnifyingGlass size={28} weight="bold" color={colors.textDim}/>}
          </div>
          <div style={{fontSize:18,fontWeight:700,color:TEXT,marginBottom:8}}>
            {projects.length===0 ? 'No projects yet' : 'No projects match your filters'}
          </div>
          <div style={{fontSize:14,color:DIM,lineHeight:1.5,marginBottom:projects.length===0?28:0,maxWidth:380}}>
            {projects.length===0 ? 'Create your first project to get started tracking your construction work.' : 'Try adjusting your search or status filter.'}
          </div>
          {projects.length===0 && (
            <Link
              href="/app/projects/new"
              style={{display:'inline-flex',alignItems:'center',gap:8,padding:'11px 24px',background:`linear-gradient(135deg,${GOLD},${colors.goldLight})`,color:colors.darkAlt,borderRadius:radius.xl,fontWeight:700,fontSize:14,textDecoration:'none',boxShadow:shadow.sm}}
            >
              <Plus size={16} weight="bold"/> Create Your First Project
            </Link>
          )}
        </div>
      )}

      {/* Grid */}
      {!loading && filtered.length>0 && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(360px,1fr))',gap:18}}>
          {filtered.map((p:any)=>{
            const st = statusStyle(p.status||'');
            const contract = Number(p.contract_amount||0);
            return (
              <div key={p.id}
                style={{background:RAISED,border:`1px solid ${BORDER}`,borderRadius:14,padding:22,boxShadow:shadow.sm,transition:'border-color .18s,box-shadow .18s,transform .18s',cursor:'pointer'}}
                onMouseEnter={e=>{const t=e.currentTarget as HTMLElement;t.style.borderColor=BORDER_STRONG;t.style.boxShadow=shadow.md;t.style.transform='translateY(-2px)'}}
                onMouseLeave={e=>{const t=e.currentTarget as HTMLElement;t.style.borderColor=BORDER;t.style.boxShadow=shadow.sm;t.style.transform='none'}}
              >
                {/* Name + badge */}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
                  <div style={{flex:1,marginRight:12}}>
                    <div style={{fontWeight:600,fontSize:16,color:TEXT,marginBottom:4,lineHeight:1.3}}>{p.name}</div>
                    <div style={{fontSize:12,color:DIM}}>{p.address||'No address set'}</div>
                  </div>
                  <span style={{fontSize:10,fontWeight:700,letterSpacing:.4,padding:'4px 10px',borderRadius:radius.full,background:st.bg,color:st.c,whiteSpace:'nowrap' as const}}>
                    {(p.status||'unknown').replace(/_/g,' ').toUpperCase()}
                  </span>
                </div>

                {/* Stats */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
                  <div style={{background:SUNKEN,border:`1px solid ${colors.borderDim}`,borderRadius:radius.lg,padding:'10px 12px'}}>
                    <div style={{fontSize:10,color:colors.textDim,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:.6,marginBottom:4}}>Contract Value</div>
                    <div style={{fontSize:15,fontWeight:700,color:contract>0?GOLD:colors.textDim}}>{contract>0?fmt(contract):'—'}</div>
                  </div>
                  <div style={{background:SUNKEN,border:`1px solid ${colors.borderDim}`,borderRadius:radius.lg,padding:'10px 12px'}}>
                    <div style={{fontSize:10,color:colors.textDim,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:.6,marginBottom:4}}>Type</div>
                    <div style={{fontSize:14,fontWeight:600,color:TEXT,textTransform:'capitalize' as const}}>{(p.project_type||'—').replace(/_/g,' ')}</div>
                  </div>
                </div>

                {/* Footer */}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:11,color:colors.textDim}}>
                    {p.start_date ? new Date(p.start_date).toLocaleDateString('en-US',{month:'short',year:'numeric'}) : 'No start date'}
                  </span>
                  <Link
                    href={`/app/projects/${p.id}`}
                    style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:12,fontWeight:600,color:GOLD,textDecoration:'none'}}
                  >
                    View Project <ArrowRight size={13} weight="bold"/>
                  </Link>
                </div>
              </div>
            );
          })}

          {/* New Project Card */}
          <Link href="/app/projects/new" style={{textDecoration:'none'}}>
            <div style={{background:'rgba(245, 158, 11,.04)',border:`1px dashed rgba(245, 158, 11,.3)`,borderRadius:14,padding:40,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12,minHeight:190,transition:'background .18s,border-color .18s'}}
              onMouseEnter={e=>{const t=e.currentTarget as HTMLElement;t.style.background='rgba(245, 158, 11,.08)';t.style.borderColor='rgba(245, 158, 11,.5)'}}
              onMouseLeave={e=>{const t=e.currentTarget as HTMLElement;t.style.background='rgba(245, 158, 11,.04)';t.style.borderColor='rgba(245, 158, 11,.3)'}}
            >
              <div style={{width:50,height:50,borderRadius:radius['2xl'],background:'rgba(245, 158, 11,.14)',display:'flex',alignItems:'center',justifyContent:'center',color:GOLD}}>
                <Plus size={24} weight="bold"/>
              </div>
              <div style={{fontWeight:700,color:GOLD,fontSize:15}}>New Project</div>
              <div style={{fontSize:12,color:DIM,textAlign:'center' as const}}>Start from scratch or import from a won bid</div>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
