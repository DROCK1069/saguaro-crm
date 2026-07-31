'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { humanError } from '@/lib/errors';
import { useParams } from 'next/navigation';
import SaguaroDatePicker from '../../../../../components/SaguaroDatePicker';
import { ShieldCheck, Plus, X, CheckCircle, Warning, WarningCircle } from '@phosphor-icons/react';
import { PremiumSurface, ModuleHero, SectionCard, StatCard, PremiumEmpty, goldButtonStyle, ghostButtonStyle } from '@/components/ui/premium';

const GOLD='#F59E0B',DARK='#0a0a0a',RAISED='#141416',BORDER='rgba(255,255,255,0.12)',DIM='#CBD5E1',TEXT='#FFFFFF',GREEN='#1a8a4a',RED='#c03030',ORANGE='#B85C2A';
const fmt = (n:number) => '$'+((n||0).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0}));

const INP:React.CSSProperties = {padding:'8px 12px',background:DARK,border:`1px solid ${BORDER}`,borderRadius:7,color:TEXT,fontSize:13,outline:'none',width:'100%',boxSizing:'border-box'};
const LBL:React.CSSProperties = {display:'block',fontSize:11,fontWeight:700,color:DIM,textTransform:'uppercase',letterSpacing:.5,marginBottom:6};

const POLICY_TYPES = ['GL','WC','Auto','Umbrella','E&O','Professional Liability','Other'];

function daysUntilExpiry(expiryDate:string):number{
  if(!expiryDate) return 9999;
  return Math.round((new Date(expiryDate+'T12:00:00').getTime()-Date.now())/86400000);
}

function certStatus(expiryDate:string):{label:string,c:string,bg:string}{
  const days = daysUntilExpiry(expiryDate);
  if(days<0)   return {label:'Expired',        c:RED,        bg:'rgba(192,48,48,.14)'};
  if(days<30)  return {label:`Exp. in ${days}d`,c:'#f59e0b', bg:'rgba(245,158,11,.14)'};
  return {label:'Active',c:'#3dd68c',bg:'rgba(26,138,74,.14)'};
}

export default function InsurancePage() {
  const params    = useParams();
  const projectId = params['projectId'] as string;

  const [certs,setCerts]       = useState<any[]>([]);
  const [loading,setLoading]   = useState(true);
  const [error,setError]       = useState('');
  const [showForm,setShowForm] = useState(false);
  const [saving,setSaving]     = useState(false);
  const [renewingId,setRenewingId] = useState<string|null>(null);
  const [toast,setToast] = useState<{msg:string;type:'success'|'error'}|null>(null);

  useEffect(()=>{ const t=toast?setTimeout(()=>setToast(null),4000):null; return ()=>{ if(t) clearTimeout(t); }; },[toast]);

  // Form
  const [fSub,setFSub]         = useState('');
  const [fType,setFType]       = useState('GL');
  const [fCarrier,setFCarrier] = useState('');
  const [fPolicy,setFPolicy]   = useState('');
  const [fEff,setFEff]         = useState('');
  const [fExp,setFExp]         = useState('');
  const [fAmt,setFAmt]         = useState('');
  const [fFile,setFFile]       = useState<File|null>(null);

  const load = useCallback(async()=>{
    setLoading(true); setError('');
    try{
      const r = await fetch(`/api/insurance/${projectId}`);
      if(!r.ok) throw new Error(await r.text());
      const d = await r.json();
      setCerts(d.certs||d.certificates||d.data||[]);
    }catch(e:any){
      console.error(e); setError(humanError(e, 'Failed to load insurance certificates. Please try again.'));
      setCerts([]);
    }finally{
      setLoading(false);
    }
  },[projectId]);

  useEffect(()=>{ load(); },[load]);

  async function addCert(){
    if(!fSub.trim()||!fCarrier.trim()||!fPolicy.trim()||!fEff||!fExp){ setError('All fields except coverage amount are required'); return; }
    setSaving(true); setError('');
    try{
      // Multipart so the COI PDF is actually uploaded (the old JSON POST never
      // sent the file). The browser sets the multipart boundary — do not set
      // Content-Type manually.
      const fd = new FormData();
      fd.append('projectId',projectId);
      fd.append('subName',fSub);
      fd.append('policyType',fType);
      fd.append('carrier',fCarrier);
      fd.append('policyNo',fPolicy);
      fd.append('effectiveDate',fEff);
      fd.append('expiryDate',fExp);
      fd.append('coverageAmount',String(parseFloat(fAmt)||0));
      if(fFile) fd.append('file',fFile);
      const r = await fetch('/api/insurance/create',{method:'POST',body:fd});
      const d = await r.json();
      if(d.error) throw new Error(d.error);
      setFSub(''); setFType('GL'); setFCarrier(''); setFPolicy(''); setFEff(''); setFExp(''); setFAmt(''); setFFile(null);
      setShowForm(false);
      await load();
    }catch(e:any){
      console.error(e); setError(humanError(e, 'Failed to add the certificate. Please try again.'));
    }finally{
      setSaving(false);
    }
  }

  async function requestRenewal(certId:string,subName:string){
    setRenewingId(certId);
    try{
      const r = await fetch('/api/insurance/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId,certId,subName})});
      const d = await r.json();
      if(d.error) throw new Error(d.error);
      setToast({msg:`Renewal request sent to ${subName}`,type:'success'});
    }catch(e:any){
      console.error(e); setToast({msg:humanError(e, 'Failed to send the renewal request. Please try again.'),type:'error'});
    }finally{
      setRenewingId(null);
    }
  }

  const totalCount    = certs.length;
  const activeCount   = certs.filter(c=>daysUntilExpiry(c.expiry_date||c.expiryDate)>=30).length;
  const expiringCount = certs.filter(c=>{ const d=daysUntilExpiry(c.expiry_date||c.expiryDate); return d>=0&&d<30; }).length;
  const expiredCount  = certs.filter(c=>daysUntilExpiry(c.expiry_date||c.expiryDate)<0).length;

  return (
    <>
      {toast && (
        <div style={{position:'fixed',bottom:'24px',left:'50%',transform:'translateX(-50%)',zIndex:99999,padding:'12px 20px',borderRadius:'8px',background:toast.type==='success'?'rgba(34,197,94,0.9)':'rgba(239,68,68,0.9)',color:'#fff',fontWeight:600,fontSize:'14px',pointerEvents:'none'}}>
          {toast.msg}
        </div>
      )}

      <PremiumSurface maxWidth={1600}>

        {/* Header */}
        <ModuleHero
          eyebrow="INSURANCE"
          eyebrowIcon={<ShieldCheck size={13} weight="fill" color={GOLD} />}
          title="Insurance"
          accent="Certificates"
          subtitle="COIs for all subcontractors — expiration alerts included"
          actions={
            <button onClick={()=>setShowForm(!showForm)} className="pmBtn"
              style={showForm ? ghostButtonStyle : goldButtonStyle}>
              {showForm ? <><X size={15} weight="bold" /> Cancel</> : <><Plus size={15} weight="bold" /> Add Certificate</>}
            </button>
          }
        />

        {/* Add Form */}
        {showForm && (
          <SectionCard
            title="Add Insurance Certificate"
            icon={<ShieldCheck size={17} weight="duotone" color={GOLD} />}
            style={{ marginBottom: 24 }}
          >
            {error && (
              <div style={{background:'rgba(192,48,48,.12)',border:`1px solid rgba(192,48,48,.3)`,borderRadius:8,padding:'10px 14px',marginBottom:16,color:RED,fontSize:13}}>
                {error}
              </div>
            )}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:14,marginBottom:14}}>
              <div style={{gridColumn:'1/-1'}}>
                <label style={LBL}>Subcontractor Name *</label>
                <input value={fSub} onChange={e=>setFSub(e.target.value)} placeholder="Desert Electrical Contractors" style={INP}/>
              </div>
              <div>
                <label style={LBL}>Policy Type *</label>
                <select value={fType} onChange={e=>setFType(e.target.value)} style={INP}>
                  {POLICY_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={LBL}>Carrier *</label>
                <input value={fCarrier} onChange={e=>setFCarrier(e.target.value)} placeholder="Travelers Insurance" style={INP}/>
              </div>
              <div>
                <label style={LBL}>Policy Number *</label>
                <input value={fPolicy} onChange={e=>setFPolicy(e.target.value)} placeholder="GL-2026-84721" style={INP}/>
              </div>
              <div>
                <label style={LBL}>Effective Date *</label>
                <SaguaroDatePicker value={fEff} onChange={setFEff} style={INP}/>
              </div>
              <div>
                <label style={LBL}>Expiry Date *</label>
                <SaguaroDatePicker value={fExp} onChange={setFExp} style={INP}/>
              </div>
              <div>
                <label style={LBL}>Coverage Amount ($)</label>
                <input type="number" value={fAmt} onChange={e=>setFAmt(e.target.value)} placeholder="2000000" min="0" style={INP}/>
              </div>
              <div style={{gridColumn:'1/-1'}}>
                <label style={LBL}>Certificate PDF (COI)</label>
                <input type="file" accept="application/pdf,image/png,image/jpeg"
                  onChange={e=>setFFile(e.target.files?.[0]||null)}
                  style={{...INP,padding:'7px 10px'}}/>
                {fFile && <div style={{marginTop:6,fontSize:11,color:DIM}}>Attached: {fFile.name}</div>}
              </div>
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={addCert} disabled={saving} className="pmBtn"
                style={{...goldButtonStyle,cursor:saving?'wait':'pointer',opacity:saving?.6:1}}>
                {saving ? 'Adding…' : 'Add Certificate'}
              </button>
              <button onClick={()=>{setShowForm(false);setError('');}} className="pmBtn" style={ghostButtonStyle}>
                Cancel
              </button>
            </div>
          </SectionCard>
        )}

        {/* Error (outside form) */}
        {error && !showForm && (
          <div style={{background:'rgba(192,48,48,.12)',border:`1px solid rgba(192,48,48,.3)`,borderRadius:8,padding:'12px 16px',marginBottom:20,color:RED,fontSize:13}}>
            {error}
          </div>
        )}

        {/* KPI Cards */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12,marginBottom:24}}>
          <StatCard icon={<ShieldCheck size={19} weight="duotone" color={GOLD} />}    label="Total"         value={totalCount}    sub="certificates"    delay={0.02} />
          <StatCard icon={<CheckCircle size={19} weight="duotone" color="#3dd68c" />} label="Active"        value={activeCount}   accent="#3dd68c" sub="30+ days out"  delay={0.06} />
          <StatCard icon={<Warning size={19} weight="duotone" color="#f59e0b" />}     label="Expiring Soon" value={expiringCount} accent="#f59e0b" sub="under 30 days" delay={0.10} />
          <StatCard icon={<WarningCircle size={19} weight="duotone" color={RED} />}   label="Expired"       value={expiredCount}  accent={RED}     sub="past due"      delay={0.14} />
        </div>

        {/* Loading */}
        {loading && (
          <SectionCard>
            <div style={{padding:'28px 8px',textAlign:'center' as const,color:DIM,fontSize:13}}>Loading certificates…</div>
          </SectionCard>
        )}

        {/* Empty */}
        {!loading && certs.length===0 && (
          <SectionCard>
            <PremiumEmpty
              icon={<ShieldCheck size={30} weight="duotone" color={GOLD} />}
              title="No certificates yet"
              description="Upload COIs for all subcontractors to track expiration dates and maintain compliance."
              action={
                <button onClick={()=>setShowForm(true)} className="pmBtn" style={goldButtonStyle}>
                  <Plus size={15} weight="bold" /> Add First Certificate
                </button>
              }
            />
          </SectionCard>
        )}

        {/* Table */}
        {!loading && certs.length>0 && (
          <SectionCard
            title="Certificates"
            icon={<ShieldCheck size={17} weight="duotone" color={GOLD} />}
            flush
          >
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:13}}>
                <thead>
                  <tr style={{background:'rgba(255,255,255,0.03)'}}>
                    {['Sub Name','Policy Type','Carrier','Policy #','Coverage','Expiry Date','Status','Actions'].map(h=>(
                      <th key={h} style={{padding:'10px 16px',textAlign:'left' as const,fontSize:11,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:.5,color:DIM,borderBottom:`1px solid rgba(255,255,255,0.08)`,whiteSpace:'nowrap' as const}}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {certs.map((c:any,idx:number)=>{
                    const expDate  = c.expiry_date||c.expiryDate||'';
                    const days     = daysUntilExpiry(expDate);
                    const st       = certStatus(expDate);
                    const expired  = days<0;
                    const expiring = days>=0&&days<30;
                    const rowBg    = expired?'rgba(192,48,48,.06)':expiring?'rgba(245,158,11,.04)':'transparent';
                    const cid      = c.id||String(idx);
                    return (
                      <tr key={cid} style={{borderBottom:`1px solid rgba(255,255,255,0.06)`,background:rowBg}}>
                        <td style={{padding:'11px 16px',color:TEXT,fontWeight:600}}>{c.sub_name||c.subName||c.vendor_name||'—'}</td>
                        <td style={{padding:'11px 16px'}}>
                          <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:4,background:'rgba(245, 158, 11,.12)',color:GOLD,textTransform:'uppercase' as const}}>
                            {c.policy_type||c.policyType||'—'}
                          </span>
                        </td>
                        <td style={{padding:'11px 16px',color:DIM}}>{c.carrier||'—'}</td>
                        <td style={{padding:'11px 16px',color:DIM,fontFamily:'monospace',fontSize:12}}>{c.policy_number||c.policyNo||'—'}</td>
                        <td style={{padding:'11px 16px',color:TEXT}}>{c.coverage_amount||c.coverageAmount ? fmt(Number(c.coverage_amount||c.coverageAmount||0)) : '—'}</td>
                        <td style={{padding:'11px 16px',color:expired?RED:expiring?'#f59e0b':DIM,fontWeight:expired||expiring?700:400}}>
                          {expDate ? new Date(expDate+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'}
                          {expiring && !expired && <span style={{marginLeft:6,fontSize:10,color:'#f59e0b'}}>({days}d)</span>}
                          {expired && <span style={{marginLeft:6,fontSize:10,color:RED}}>(expired)</span>}
                        </td>
                        <td style={{padding:'11px 16px'}}>
                          <span style={{fontSize:10,fontWeight:700,padding:'3px 9px',borderRadius:4,background:st.bg,color:st.c,textTransform:'uppercase' as const,letterSpacing:.3}}>
                            {st.label}
                          </span>
                        </td>
                        <td style={{padding:'11px 16px'}}>
                          {(expired||expiring) && (
                            <button onClick={()=>requestRenewal(cid,c.sub_name||c.subName||'')} disabled={renewingId===cid}
                              style={{background:'none',border:`1px solid ${BORDER}`,borderRadius:5,color:GOLD,fontSize:11,padding:'4px 10px',cursor:renewingId===cid?'wait':'pointer',opacity:renewingId===cid?.5:1}}>
                              {renewingId===cid ? '…' : 'Request Renewal'}
                            </button>
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

      </PremiumSurface>
    </>
  );
}
