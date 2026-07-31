'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { humanError } from '@/lib/errors';
import { useParams } from 'next/navigation';
import { CheckCircle, Hourglass, Lightning, FileText, DownloadSimple } from '@phosphor-icons/react';
import SaguaroDatePicker from '../../../../../components/SaguaroDatePicker';
import { PremiumSurface, ModuleHero, SectionCard, StatCard, PremiumEmpty, goldButtonStyle, ghostButtonStyle, goldOutlineButtonStyle } from '@/components/ui/premium';

const GOLD='#F59E0B',DARK='#0a0a0a',RAISED='#141416',BORDER='rgba(255,255,255,0.12)',DIM='#CBD5E1',TEXT='#FFFFFF',GREEN='#1a8a4a',RED='#c03030',ORANGE='#B85C2A';
const fmt = (n:number) => '$'+((n||0).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0}));

const WAIVER_TYPES = [
  {key:'conditional_partial',   label:'Conditional Partial'},
  {key:'unconditional_partial', label:'Unconditional Partial'},
  {key:'conditional_final',     label:'Conditional Final'},
  {key:'unconditional_final',   label:'Unconditional Final'},
];

const INP:React.CSSProperties = {padding:'8px 12px',background:DARK,border:`1px solid ${BORDER}`,borderRadius:7,color:TEXT,fontSize:13,outline:'none',width:'100%',boxSizing:'border-box'};
const LBL:React.CSSProperties = {display:'block',fontSize:11,fontWeight:700,color:DIM,textTransform:'uppercase',letterSpacing:.5,marginBottom:6};

type WaiverStatus = 'signed'|'pending'|null;

interface MatrixRow {
  subId: string;
  subName: string;
  waivers: Record<string,{id:string,status:string,pdf_url?:string}|null>;
}

function buildMatrix(waivers:any[]):MatrixRow[]{
  const bySubId:Record<string,MatrixRow> = {};
  for(const w of waivers){
    const subId   = w.sub_id||w.subId||w.id;
    const subName = (w.subcontractors as any)?.name||w.sub_name||w.claimant_name||'Unknown';
    if(!bySubId[subId]){
      bySubId[subId] = {subId,subName,waivers:{}};
    }
    bySubId[subId].waivers[w.waiver_type] = {id:w.id,status:w.status,pdf_url:w.pdf_url};
  }
  return Object.values(bySubId);
}

function CellIcon({status,pdfUrl}:{status:string|undefined|null,pdfUrl?:string}){
  if(status==='signed'){
    return (
      <div style={{display:'flex',flexDirection:'column' as const,alignItems:'center',gap:4}}>
        <span style={{display:'inline-flex',color:'#3dd68c'}}><CheckCircle size={16} weight="fill" color="#3dd68c" /></span>
        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noreferrer"
            style={{fontSize:10,color:GOLD,textDecoration:'none',padding:'2px 7px',border:`1px solid rgba(245, 158, 11,.3)`,borderRadius:4}}>
            PDF
          </a>
        )}
      </div>
    );
  }
  if(status==='pending'){
    return <span style={{display:'inline-flex',verticalAlign:'middle',color:'#f59e0b'}} title="Pending signature"><Hourglass size={16} weight="fill" color="#f59e0b" /></span>;
  }
  return <span style={{fontSize:14,color:BORDER}}>—</span>;
}

export default function LienWaiversPage() {
  const params    = useParams();
  const projectId = params['projectId'] as string;

  const [waivers,setWaivers]   = useState<any[]>([]);
  const [loading,setLoading]   = useState(true);
  const [error,setError]       = useState('');
  const [showForm,setShowForm] = useState(false);
  const [generating,setGenerating] = useState(false);
  const [genAll,setGenAll]     = useState(false);

  // form
  const [fType,setFType]         = useState('conditional_partial');
  const [fState,setFState]       = useState('AZ');
  const [fClaimant,setFClaimant] = useState('');
  const [fAmount,setFAmount]     = useState('');
  const [fThrough,setFThrough]   = useState(new Date().toISOString().slice(0,10));

  const load = useCallback(async()=>{
    setLoading(true); setError('');
    try{
      const r = await fetch(`/api/lien-waivers/list?projectId=${projectId}`);
      if(!r.ok) throw new Error(await r.text());
      const d = await r.json();
      setWaivers(d.lienWaivers??[]);
    }catch(e:any){
      console.error(e); setError(humanError(e, 'Failed to load lien waivers. Please try again.'));
    }finally{
      setLoading(false);
    }
  },[projectId]);

  useEffect(()=>{ load(); },[load]);

  async function generate(){
    if(!fClaimant.trim()||!fAmount||!fThrough){ setError('Claimant, amount, and through date are required'); return; }
    setGenerating(true); setError('');
    try{
      const r = await fetch('/api/lien-waivers/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        projectId,waiverType:fType,state:fState,claimantName:fClaimant,amount:parseFloat(fAmount)||0,throughDate:fThrough,
      })});
      const d = await r.json();
      if(d.error) throw new Error(d.error);
      setFClaimant(''); setFAmount(''); setFThrough(new Date().toISOString().slice(0,10));
      setShowForm(false);
      await load();
    }catch(e:any){
      console.error(e); setError(humanError(e, 'Failed to generate the lien waiver. Please try again.'));
    }finally{
      setGenerating(false);
    }
  }

  async function generateAll(){
    setGenAll(true);
    try{
      // Generate conditional partial for all subs that don't have one for current period
      const matrix = buildMatrix(waivers);
      for(const row of matrix){
        if(!row.waivers['conditional_partial']){
          await fetch('/api/lien-waivers/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
            projectId,waiverType:'conditional_partial',claimantName:row.subName,throughDate:fThrough,amount:0,subId:row.subId,
          })});
        }
      }
      await load();
    }catch(e:any){
      console.error(e); setError(humanError(e, 'Failed to generate all waivers. Please try again.'));
    }finally{
      setGenAll(false);
    }
  }

  const matrix = buildMatrix(waivers);
  const signed  = waivers.filter(w=>w.status==='signed').length;
  const pending = waivers.filter(w=>w.status==='pending').length;

  return (
    <PremiumSurface maxWidth={1600}>
      {/* Header */}
      <ModuleHero
        eyebrow="LIEN WAIVERS"
        eyebrowIcon={<FileText size={13} weight="fill" color={GOLD} />}
        title="Lien"
        accent="Waivers"
        subtitle={loading
          ? 'Loading lien waivers…'
          : 'Generate and track state-specific conditional & unconditional lien waivers by subcontractor.'}
        actions={<>
          <button onClick={()=>setShowForm(!showForm)} style={goldOutlineButtonStyle} className="pmBtn">
            + Generate Waiver
          </button>
          <button onClick={generateAll} disabled={genAll}
            style={{...goldButtonStyle, cursor:genAll?'wait':'pointer', opacity:genAll?.6:1}} className="pmBtn">
            {genAll ? 'Generating…' : <><Lightning size={14} weight="fill" color="#1A1206" /> Generate All</>}
          </button>
        </>}
      />

      {/* KPI Row */}
      {!loading && waivers.length>0 && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))',gap:12,marginBottom:24}}>
          <StatCard
            label="TOTAL WAIVERS" value={String(waivers.length)} sub="generated"
            icon={<FileText size={19} weight="duotone" color={GOLD} />} accent={GOLD}
          />
          <StatCard
            label="SIGNED" value={String(signed)} sub="fully executed"
            icon={<CheckCircle size={19} weight="duotone" color="#3dd68c" />} accent="#3dd68c"
          />
          <StatCard
            label="PENDING" value={String(pending)} sub="awaiting signature"
            icon={<Hourglass size={19} weight="duotone" color={GOLD} />} accent={pending>0?GOLD:undefined}
          />
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div style={{marginBottom:24}}>
          <SectionCard title="Generate Lien Waiver" icon={<FileText size={17} weight="duotone" color={GOLD} />}>
            {error && (
              <div style={{background:'rgba(192,48,48,.12)',border:`1px solid rgba(192,48,48,.3)`,borderRadius:8,padding:'10px 14px',marginBottom:16,color:RED,fontSize:13}}>{error}</div>
            )}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:16}}>
              <div>
                <label style={LBL}>Waiver Type</label>
                <select value={fType} onChange={e=>setFType(e.target.value)} style={INP}>
                  {WAIVER_TYPES.map(t=><option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={LBL}>State</label>
                <select value={fState} onChange={e=>setFState(e.target.value)} style={INP}>
                  {['AZ','CA','TX','NV','CO','FL','WA','OR','UT','NM','OTHER'].map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={LBL}>Claimant Name *</label>
                <input value={fClaimant} onChange={e=>setFClaimant(e.target.value)} placeholder="ABC Electrical LLC" style={INP}/>
              </div>
              <div>
                <label style={LBL}>Amount ($) *</label>
                <input type="number" value={fAmount} onChange={e=>setFAmount(e.target.value)} placeholder="45000" min="0" style={INP}/>
              </div>
              <div>
                <label style={LBL}>Through Date *</label>
                <SaguaroDatePicker value={fThrough} onChange={setFThrough} style={INP}/>
              </div>
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={generate} disabled={generating}
                style={{...goldButtonStyle, cursor:generating?'wait':'pointer', opacity:generating?.6:1}} className="pmBtn">
                {generating ? 'Generating…' : 'Generate PDF'}
              </button>
              <button onClick={()=>{setShowForm(false);setError('');}} style={ghostButtonStyle} className="pmBtn">
                Cancel
              </button>
            </div>
          </SectionCard>
        </div>
      )}

      {/* Error outside form */}
      {error && !showForm && (
        <div style={{background:'rgba(192,48,48,.12)',border:`1px solid rgba(192,48,48,.3)`,borderRadius:8,padding:'12px 16px',marginBottom:20,color:RED,fontSize:13}}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <SectionCard>
          <div style={{padding:'24px 8px',textAlign:'center' as const,color:DIM,fontSize:13}}>Loading lien waivers…</div>
        </SectionCard>
      )}

      {/* Empty */}
      {!loading && waivers.length===0 && (
        <SectionCard>
          <PremiumEmpty
            icon={<FileText size={30} weight="duotone" color={GOLD} />}
            title="No lien waivers yet"
            description="Generate state-specific conditional and unconditional lien waivers. AZ (ARS §33-1008), CA (Civil Code §8132), TX (Property Code Ch. 53) statutory forms included."
            action={<button onClick={()=>setShowForm(true)} style={goldButtonStyle} className="pmBtn">+ Generate First Waiver</button>}
          />
        </SectionCard>
      )}

      {/* Matrix View */}
      {!loading && matrix.length>0 && (
        <>
          <div style={{marginBottom:20}}>
            <SectionCard title="Waiver Matrix" subtitle="Coverage by subcontractor & waiver type" icon={<CheckCircle size={17} weight="duotone" color={GOLD} />} flush>
              <div style={{padding:'14px 20px',fontSize:13,color:DIM,borderBottom:`1px solid rgba(255,255,255,0.06)`}}>
                <span style={{marginRight:16}}><span style={{display:'inline-flex',verticalAlign:'middle',color:'#3dd68c'}}><CheckCircle size={14} weight="fill" color="#3dd68c" /></span> Signed</span>
                <span style={{marginRight:16}}><span style={{display:'inline-flex',verticalAlign:'middle',color:'#f59e0b'}}><Hourglass size={14} weight="fill" color="#f59e0b" /></span> Pending</span>
                <span><span style={{color:BORDER}}>—</span> Not generated</span>
              </div>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:13}}>
                  <thead>
                    <tr style={{background:DARK}}>
                      <th style={{padding:'10px 16px',textAlign:'left' as const,fontSize:11,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:.5,color:DIM,borderBottom:`1px solid ${BORDER}`,minWidth:180}}>
                        Subcontractor
                      </th>
                      {WAIVER_TYPES.map(t=>(
                        <th key={t.key} style={{padding:'10px 16px',textAlign:'center' as const,fontSize:11,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:.5,color:DIM,borderBottom:`1px solid ${BORDER}`,minWidth:140}}>
                          {t.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.map(row=>(
                      <tr key={row.subId} style={{borderBottom:`1px solid rgba(255,255,255,0.12)`}}>
                        <td style={{padding:'14px 16px',color:TEXT,fontWeight:700}}>{row.subName}</td>
                        {WAIVER_TYPES.map(t=>{
                          const w = row.waivers[t.key];
                          return (
                            <td key={t.key} style={{padding:'14px 16px',textAlign:'center' as const}}>
                              <CellIcon status={w?.status} pdfUrl={w?.pdf_url}/>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>

          {/* List of individual waivers */}
          {waivers.length>0 && (
            <SectionCard title="All Waivers" icon={<FileText size={17} weight="duotone" color={GOLD} />} flush>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:13}}>
                  <thead>
                    <tr style={{background:DARK}}>
                      {['Claimant','Type','State','Amount','Through Date','Status','Download'].map(h=>(
                        <th key={h} style={{padding:'9px 14px',textAlign:'left' as const,fontSize:10,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:.5,color:DIM,borderBottom:`1px solid ${BORDER}`}}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {waivers.map((w:any)=>{
                      const typeLabel = WAIVER_TYPES.find(t=>t.key===w.waiver_type)?.label || w.waiver_type;
                      return (
                        <tr key={w.id} style={{borderBottom:`1px solid rgba(255,255,255,0.12)`}}>
                          <td style={{padding:'10px 14px',color:TEXT,fontWeight:600}}>{w.claimant_name||(w.subcontractors as any)?.name||'—'}</td>
                          <td style={{padding:'10px 14px',color:DIM}}>{typeLabel}</td>
                          <td style={{padding:'10px 14px',color:DIM}}>{w.state||'—'}</td>
                          <td style={{padding:'10px 14px',color:TEXT}}>{fmt(w.amount||0)}</td>
                          <td style={{padding:'10px 14px',color:DIM}}>{w.through_date||'—'}</td>
                          <td style={{padding:'10px 14px'}}>
                            <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:4,textTransform:'uppercase' as const,
                              background:w.status==='signed'?'rgba(26,138,74,.14)':'rgba(245, 158, 11,.14)',
                              color:w.status==='signed'?'#3dd68c':GOLD}}>
                              {w.status||'pending'}
                            </span>
                          </td>
                          <td style={{padding:'10px 14px'}}>
                            {w.pdf_url && (
                              <a href={w.pdf_url} target="_blank" rel="noreferrer"
                                style={{background:'none',border:`1px solid ${BORDER}`,borderRadius:5,color:GOLD,fontSize:11,padding:'3px 9px',textDecoration:'none',cursor:'pointer'}}>
                                <span style={{display:'inline-flex',alignItems:'center',gap:5,verticalAlign:'middle'}}><DownloadSimple size={12} weight="regular" color={GOLD} /> Download</span>
                              </a>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}
        </>
      )}
    </PremiumSurface>
  );
}
