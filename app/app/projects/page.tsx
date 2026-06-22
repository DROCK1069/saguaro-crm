'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { FolderOpen, MagnifyingGlass, Plus, ArrowRight } from '@phosphor-icons/react';
import { colors, radius, shadow } from '../../../lib/design-tokens';
import SelectMenu from '../../../components/ui/SelectMenu';

// Flat EDITORIAL palette — no boxes, content on the page separated by hairline rules.
const GOLD='#C8881C';
const TEXT='#1C1917';
const DIM='#57534E';
const DIM2='#8A847E';
const HAIRLINE='#EAE8E4';
const STRONG='#1C1917';
const PAGE_BG='#FAFAF9';
const GREEN='#15803D';
const RED='#B42318';
const fmt = (n:number) => '$'+((n||0).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0}));

function statusStyle(s:string):{bg:string,c:string}{
  if(s==='active')    return {bg:'rgba(21,128,61,.10)',c:GREEN};
  if(s==='bidding')   return {bg:'rgba(200,136,28,.14)',c:GOLD};
  if(s==='planning')  return {bg:'rgba(99,102,241,.12)',c:colors.blue};
  if(s==='closed'||s==='complete') return {bg:'rgba(28,25,23,.05)',c:DIM};
  return {bg:'rgba(28,25,23,.05)',c:DIM};
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
    <div style={{padding:'28px 32px',maxWidth:1400,margin:'0 auto',background:PAGE_BG}}>
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20,paddingBottom:14,borderBottom:`2px solid ${STRONG}`,flexWrap:'wrap',gap:14}}>
        <div>
          <h1 style={{margin:0,fontSize:24,fontWeight:700,lineHeight:1.2,letterSpacing:'-0.02em',color:TEXT}}>Projects</h1>
          <div style={{fontSize:13,color:DIM,marginTop:6}}>
            {loading ? 'Loading…' : `${filtered.length} project${filtered.length!==1?'s':''}`}
          </div>
        </div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
          <div style={{position:'relative',display:'flex',alignItems:'center'}}>
            <MagnifyingGlass size={15} weight="bold" color={DIM2} style={{position:'absolute',left:12,pointerEvents:'none'}}/>
            <input
              value={search}
              onChange={e=>setSearch(e.target.value)}
              placeholder="Search projects…"
              style={{padding:'9px 14px 9px 34px',background:'#FFFFFF',border:`1px solid ${HAIRLINE}`,borderRadius:radius.lg,color:TEXT,fontSize:13,outline:'none',width:220}}
              onFocus={e=>{e.currentTarget.style.borderColor=GOLD;e.currentTarget.style.boxShadow=`0 0 0 3px rgba(200,136,28,.12)`}}
              onBlur={e=>{e.currentTarget.style.borderColor=HAIRLINE;e.currentTarget.style.boxShadow='none'}}
            />
          </div>
          <SelectMenu
            aria-label="Filter by status"
            value={statusFilter}
            onChange={setStatusFilter}
            triggerStyle={{borderColor:HAIRLINE,color:TEXT,borderRadius:radius.lg}}
            options={[
              {value:'all',label:'All Status'},
              {value:'active',label:'Active'},
              {value:'planning',label:'Planning'},
              {value:'bidding',label:'Bidding'},
              {value:'complete',label:'Complete'},
              {value:'closed',label:'Closed'},
            ]}
          />
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
        <div style={{background:'rgba(180,35,24,.08)',border:`1px solid rgba(180,35,24,.28)`,borderRadius:radius.lg,padding:'12px 16px',marginBottom:20,color:RED,fontSize:13}}>
          {error}
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(360px,1fr))',gap:0}}>
          {[1,2,3,4].map(i=>(
            <div key={i} style={{borderTop:`1px solid ${HAIRLINE}`,padding:'22px 18px',height:190,animation:'pulse 1.6s ease-in-out infinite'}}>
              <div style={{height:16,background:HAIRLINE,borderRadius:6,marginBottom:10,width:'60%'}}/>
              <div style={{height:12,background:HAIRLINE,borderRadius:6,marginBottom:18,width:'40%'}}/>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div style={{height:52,borderTop:`2px solid rgba(28,25,23,0.14)`}}/>
                <div style={{height:52,borderTop:`2px solid rgba(28,25,23,0.14)`}}/>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length===0 && (
        <div style={{
          display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',
          padding:'64px 24px',maxWidth:520,margin:'0 auto',
        }}>
          <div style={{
            width:64,height:64,borderRadius:radius['2xl'],display:'flex',alignItems:'center',justifyContent:'center',
            background:'rgba(200,136,28,.10)',border:`1px solid rgba(200,136,28,.20)`,marginBottom:20,
          }}>
            {projects.length===0
              ? <FolderOpen size={30} weight="duotone" color={GOLD}/>
              : <MagnifyingGlass size={28} weight="bold" color={DIM2}/>}
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
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(360px,1fr))',columnGap:32,rowGap:0}}>
          {filtered.map((p:any)=>{
            const st = statusStyle(p.status||'');
            const contract = Number(p.contract_amount||0);
            return (
              <div key={p.id}
                style={{background:'transparent',borderTop:`1px solid ${HAIRLINE}`,padding:'22px 4px',transition:'background .18s',cursor:'pointer'}}
                onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background='rgba(200,136,28,0.05)'}}
                onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background='transparent'}}
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
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
                  <div style={{borderTop:`2px solid rgba(28,25,23,0.14)`,paddingTop:8}}>
                    <div style={{fontSize:10,color:DIM2,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:.6,marginBottom:4}}>Contract Value</div>
                    <div style={{fontSize:15,fontWeight:700,color:contract>0?GOLD:DIM2}}>{contract>0?fmt(contract):'—'}</div>
                  </div>
                  <div style={{borderTop:`2px solid rgba(28,25,23,0.14)`,paddingTop:8}}>
                    <div style={{fontSize:10,color:DIM2,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:.6,marginBottom:4}}>Type</div>
                    <div style={{fontSize:14,fontWeight:600,color:TEXT,textTransform:'capitalize' as const}}>{(p.project_type||'—').replace(/_/g,' ')}</div>
                  </div>
                </div>

                {/* Footer */}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:11,color:DIM2}}>
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

          {/* New Project CTA */}
          <Link href="/app/projects/new" style={{textDecoration:'none'}}>
            <div style={{background:'transparent',borderTop:`1px solid ${HAIRLINE}`,padding:'22px 4px',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12,minHeight:190,transition:'background .18s'}}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background='rgba(200,136,28,0.05)'}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background='transparent'}}
            >
              <div style={{width:50,height:50,borderRadius:radius['2xl'],background:'rgba(200,136,28,.14)',display:'flex',alignItems:'center',justifyContent:'center',color:GOLD}}>
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
