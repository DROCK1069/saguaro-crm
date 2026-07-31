'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { humanError } from '@/lib/errors';
import { useParams } from 'next/navigation';
import { toCents, toDollars, summarizeContract } from '@/lib/calc';
import { Robot, X, Warning, CheckCircle, XCircle, Plus, Clipboard, CaretDown, PencilSimple, Copy, Trash, CurrencyDollar } from '@phosphor-icons/react';
import { PremiumSurface, ModuleHero, StatCard, SectionCard, PremiumEmpty, goldButtonStyle, ghostButtonStyle, goldOutlineButtonStyle } from '@/components/ui/premium';

const GOLD='#F59E0B',DARK='#0a0a0a',RAISED='#141416',BORDER='rgba(255,255,255,0.12)',DIM='#CBD5E1',TEXT='#FFFFFF',GREEN='#1a8a4a',RED='#c03030',ORANGE='#B85C2A';
const AMBER='#d97706';
const fmt = (n:number) => '$'+((n||0).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0}));

const INP:React.CSSProperties = {padding:'8px 12px',background:'#1c1c1e',border:`1px solid ${BORDER}`,borderRadius:7,color:TEXT,fontSize:13,outline:'none',width:'100%',boxSizing:'border-box'};
const LBL:React.CSSProperties = {display:'block',fontSize:11,fontWeight:700,color:DIM,textTransform:'uppercase',letterSpacing:.5,marginBottom:6};

interface AIRiskResult {
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  approval_likelihood: number;
  flags: string[];
  recommendations: string[];
  summary: string;
}

function RiskBadge({ level }: { level: 'LOW' | 'MEDIUM' | 'HIGH' }) {
  const cfg = {
    LOW:    { bg:'rgba(26,138,74,.18)',  color:'#3dd68c', label:'LOW RISK' },
    MEDIUM: { bg:'rgba(217,119,6,.18)',  color:AMBER,     label:'MEDIUM RISK' },
    HIGH:   { bg:'rgba(192,48,48,.18)',  color:RED,       label:'HIGH RISK' },
  }[level];
  return (
    <span style={{fontSize:12,fontWeight:800,padding:'4px 12px',borderRadius:6,background:cfg.bg,color:cfg.color,textTransform:'uppercase',letterSpacing:.5}}>
      {cfg.label}
    </span>
  );
}

function AIRiskPanel({ result, onClose }: { result: AIRiskResult; onClose: () => void }) {
  const approvalColor = result.approval_likelihood >= 70 ? '#3dd68c' : result.approval_likelihood >= 40 ? AMBER : RED;
  return (
    <div style={{marginTop:12,background:'#141416',border:`1px solid rgba(245, 158, 11,.25)`,borderRadius:12,padding:20,animation:'slideDown .25s ease'}}>
      <style>{`@keyframes slideDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:16,display:'inline-flex',verticalAlign:'middle'}}><Robot size={16} color={GOLD} weight="regular" /></span>
          <span style={{fontWeight:800,fontSize:14,color:TEXT}}>AI Risk Analysis</span>
          <RiskBadge level={result.risk_level} />
        </div>
        <button onClick={onClose} style={{background:'none',border:'none',color:DIM,fontSize:18,cursor:'pointer',lineHeight:1}}><X size={18} color={DIM} weight="regular" /></button>
      </div>

      {/* Approval Likelihood */}
      <div style={{marginBottom:16}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
          <span style={{fontSize:12,fontWeight:700,color:DIM,textTransform:'uppercase',letterSpacing:.5}}>Approval Likelihood</span>
          <span style={{fontSize:18,fontWeight:800,color:approvalColor}}>{result.approval_likelihood}%</span>
        </div>
        <div style={{height:8,background:BORDER,borderRadius:4,overflow:'hidden'}}>
          <div style={{width:`${result.approval_likelihood}%`,height:'100%',background:approvalColor,borderRadius:4,transition:'width .6s ease'}} />
        </div>
      </div>

      {/* Summary */}
      <div style={{background:'rgba(245, 158, 11,.06)',border:`1px solid rgba(245, 158, 11,.12)`,borderRadius:8,padding:'12px 14px',marginBottom:14,fontSize:13,color:TEXT,lineHeight:1.6}}>
        {result.summary}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
        {/* Flags */}
        {result.flags.length > 0 && (
          <div>
            <div style={{fontSize:11,fontWeight:700,color:DIM,textTransform:'uppercase',letterSpacing:.5,marginBottom:8}}>Flags / Concerns</div>
            <ul style={{margin:0,padding:0,listStyle:'none',display:'flex',flexDirection:'column',gap:5}}>
              {result.flags.map((f) => (
                <li key={f} style={{display:'flex',gap:7,alignItems:'flex-start',fontSize:12,color:'#f87171'}}>
                  <span style={{marginTop:1,flexShrink:0,display:'inline-flex'}}><Warning size={12} color="#f87171" weight="fill" /></span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {/* Recommendations */}
        {result.recommendations.length > 0 && (
          <div>
            <div style={{fontSize:11,fontWeight:700,color:DIM,textTransform:'uppercase',letterSpacing:.5,marginBottom:8}}>Recommendations</div>
            <ul style={{margin:0,padding:0,listStyle:'none',display:'flex',flexDirection:'column',gap:5}}>
              {result.recommendations.map((r) => (
                <li key={r} style={{display:'flex',gap:7,alignItems:'flex-start',fontSize:12,color:'#86efac'}}>
                  <span style={{marginTop:1,flexShrink:0,display:'inline-flex'}}><CheckCircle size={12} color="#86efac" weight="fill" /></span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function statusStyle(s:string):{c:string,bg:string}{
  if(s==='approved') return {c:'#3dd68c',bg:'rgba(26,138,74,.14)'};
  if(s==='rejected') return {c:RED,    bg:'rgba(192,48,48,.14)'};
  return {c:GOLD,bg:'rgba(245, 158, 11,.14)'};
}

export default function ChangeOrdersPage() {
  const params    = useParams();
  const projectId = params['projectId'] as string;

  const [cos,setCos]         = useState<any[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError]     = useState('');
  const [showForm,setShowForm] = useState(false);
  const [saving,setSaving]   = useState(false);
  const [approvingId,setApprovingId] = useState<string|null>(null);
  const [toast,setToast] = useState<{msg:string;type:'success'|'error'}|null>(null);

  // AI Risk Analysis state
  const [riskTarget,setRiskTarget] = useState<'form'|string|null>(null); // 'form' = new CO form, or CO id
  const [riskResult,setRiskResult] = useState<AIRiskResult|null>(null);
  const [riskLoading,setRiskLoading] = useState(false);
  const [riskError,setRiskError] = useState('');
  const [coMenuId, setCoMenuId] = useState<string|null>(null);
  const [coEditId, setCoEditId] = useState<string|null>(null);
  const [coEditVal, setCoEditVal] = useState('');
  const [coCopiedId, setCoCopiedId] = useState<string|null>(null);

  useEffect(()=>{ const t=toast?setTimeout(()=>setToast(null),4000):null; return ()=>{ if(t) clearTimeout(t); }; },[toast]);

  // project contract sum for running total
  const [contractSum,setContractSum] = useState(0);

  // form
  const [fTitle,setFTitle]         = useState('');
  const [fDesc,setFDesc]           = useState('');
  const [fReason,setFReason]       = useState('');
  const [fCost,setFCost]           = useState('');
  const [fSchedule,setFSchedule]   = useState('');

  async function analyzeRisk(coData: Record<string, unknown>, targetKey: 'form' | string) {
    setRiskTarget(targetKey);
    setRiskResult(null);
    setRiskError('');
    setRiskLoading(true);
    try {
      const r = await fetch('/api/ai/change-order-risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, ...coData }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setRiskResult(d);
    } catch(e: unknown) {
      setRiskError((e as Error).message || 'AI analysis failed');
    } finally {
      setRiskLoading(false);
    }
  }

  const load = useCallback(async()=>{
    setLoading(true); setError('');
    try{
      const [coRes,projRes] = await Promise.all([
        fetch(`/api/change-orders/list?projectId=${projectId}`),
        fetch('/api/projects/list'),
      ]);
      const coData   = await coRes.json();
      const projData = await projRes.json();
      const project  = (projData.projects||[]).find((p:any)=>p.id===projectId);
      setCos((coData.changeOrders??[]).sort((a:any,b:any)=>(a.co_number||0)-(b.co_number||0)));
      if(project?.contract_amount) setContractSum(Number(project.contract_amount)||0);
    }catch(e:any){
      console.error(e); setError(humanError(e, 'Failed to load change orders. Please try again.'));
    }finally{
      setLoading(false);
    }
  },[projectId]);

  useEffect(()=>{ load(); },[load]);

  async function createCO(){
    if(!fTitle.trim()){ setError('Title is required'); return; }
    setSaving(true); setError('');
    try{
      const r = await fetch('/api/change-orders/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        projectId,title:fTitle,description:fDesc,reason:fReason,
        costImpact:parseFloat(fCost)||0,scheduleImpact:parseFloat(fSchedule)||0,
      })});
      const d = await r.json();
      if(d.error) throw new Error(d.error);
      setFTitle(''); setFDesc(''); setFReason(''); setFCost(''); setFSchedule('');
      setShowForm(false);
      await load();
    }catch(e:any){
      console.error(e); setError(humanError(e, 'Failed to create the change order. Please try again.'));
    }finally{
      setSaving(false);
    }
  }

  async function approveCO(id:string){
    setApprovingId(id);
    try{
      const r = await fetch(`/api/change-orders/${id}/approve`,{method:'POST',headers:{'Content-Type':'application/json'}});
      const d = await r.json();
      if(d.error) throw new Error(d.error);
      setCos(prev=>prev.map(c=>c.id===id?{...c,status:'approved'}:c));
      setToast({msg:'Change order approved.',type:'success'});
    }catch(e:any){
      console.error(e); setToast({msg:humanError(e, 'Failed to approve the change order. Please try again.'),type:'error'});
    }finally{
      setApprovingId(null);
    }
  }

  async function rejectCO(id:string){
    if(!window.confirm('Reject this change order?')) return;
    setApprovingId(id);
    try{
      const r = await fetch(`/api/change-orders/${id}/reject`,{method:'POST',headers:{'Content-Type':'application/json'}});
      const d = await r.json();
      if(d.error) throw new Error(d.error);
      setCos(prev=>prev.map(c=>c.id===id?{...c,status:'rejected'}:c));
      setToast({msg:'Change order rejected.',type:'success'});
    }catch(e:any){
      console.error(e); setToast({msg:humanError(e, 'Failed to reject the change order. Please try again.'),type:'error'});
    }finally{
      setApprovingId(null);
    }
  }

  function openCoMenu(id: string) { setCoMenuId(id); setCoEditId(null); }

  async function handleEditCO(id: string) {
    const amount = parseFloat(coEditVal);
    if (isNaN(amount)) return;
    setCos(prev => prev.map(c => c.id === id ? { ...c, cost_impact: amount } : c));
    setCoEditId(null);
    try {
      const r = await fetch(`/api/change-orders/${id}/update`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cost_impact: amount }) });
      if (!r.ok) throw new Error('update failed');
      setToast({ msg: 'Cost impact updated', type: 'success' });
    } catch {
      setToast({ msg: 'Could not update the change order. Please try again.', type: 'error' });
      load();
    }
  }

  function handleCopyCO(id: string, amount: number) {
    navigator.clipboard.writeText(fmt(amount)).catch(() => {});
    setCoCopiedId(id); setTimeout(() => setCoCopiedId(null), 2000);
    setCoMenuId(null);
  }

  async function handleDeleteCO(id: string) {
    setCos(prev => prev.filter(c => c.id !== id));
    setCoMenuId(null);
    try {
      const r = await fetch(`/api/change-orders/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Delete failed');
      setToast({msg:'Change order deleted',type:'success'});
    } catch { setToast({msg:'Failed to delete',type:'error'}); load(); }
  }

  // Running totals — exact-cents engine. Revised contract = original + APPROVED
  // change orders only; pending tracked separately (summarizeContract enforces this).
  const contractSummary = summarizeContract(
    toCents(contractSum),
    cos.map((c:any)=>({ id:String(c.id), description:c.title||'', amount:toCents(c.cost_impact||0), status:(c.status||'pending') as 'pending'|'approved'|'rejected' })),
  );
  const approvedCOs   = toDollars(contractSummary.approvedChangeOrders);
  const pendingCOs    = toDollars(contractSummary.pendingChangeOrders);
  const currentContract = toDollars(contractSummary.revisedContract);

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
          eyebrow="Cost Control"
          eyebrowIcon={<Clipboard size={13} weight="fill" color={GOLD} />}
          title="Change"
          accent="Orders"
          subtitle={loading ? 'Loading…' : `${cos.length} change order${cos.length!==1?'s':''} — track scope changes, owner requests, and unforeseen conditions.`}
          actions={
            <button onClick={()=>setShowForm(!showForm)} style={goldButtonStyle} className="pmBtn">
              {showForm
                ? <><X size={15} weight="bold" /> Cancel</>
                : <><Plus size={15} weight="bold" /> New Change Order</>}
            </button>
          }
        />

        {/* Create Form */}
        {showForm && (
          <SectionCard title="New Change Order" icon={<Plus size={17} weight="duotone" color={GOLD} />} style={{ marginBottom: 24 }}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
            <div style={{gridColumn:'1/-1'}}>
              <label style={LBL}>Title *</label>
              <input value={fTitle} onChange={e=>setFTitle(e.target.value)} placeholder="e.g. Add electrical outlets in server room" style={INP}/>
            </div>
            <div>
              <label style={LBL}>Reason</label>
              <input value={fReason} onChange={e=>setFReason(e.target.value)} placeholder="e.g. Owner request, unforeseen conditions" style={INP}/>
            </div>
            <div>
              <label style={LBL}>Cost Impact ($)</label>
              <input type="number" value={fCost} onChange={e=>setFCost(e.target.value)} placeholder="0" style={INP}/>
            </div>
            <div>
              <label style={LBL}>Schedule Impact (days)</label>
              <input type="number" value={fSchedule} onChange={e=>setFSchedule(e.target.value)} placeholder="0" style={INP}/>
            </div>
            <div style={{gridColumn:'1/-1'}}>
              <label style={LBL}>Description</label>
              <textarea value={fDesc} onChange={e=>setFDesc(e.target.value)} rows={3} placeholder="Describe the change in detail…"
                style={{...INP,resize:'vertical' as const}}/>
            </div>
          </div>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            <button onClick={createCO} disabled={saving||!fTitle.trim()}
              style={{...goldButtonStyle,cursor:saving?'wait':'pointer',opacity:(saving||!fTitle.trim())?0.6:1}} className="pmBtn">
              {saving ? 'Creating…' : 'Create Change Order'}
            </button>
            <button onClick={()=>{setShowForm(false);setError('');}}
              style={ghostButtonStyle} className="pmBtn">
              Cancel
            </button>
            <button
              onClick={()=>analyzeRisk({title:fTitle,description:fDesc,reason:fReason,cost_impact:parseFloat(fCost)||0,schedule_impact:parseFloat(fSchedule)||0},'form')}
              disabled={(riskLoading&&riskTarget==='form')||!fTitle.trim()}
              style={{...goldOutlineButtonStyle,opacity:!fTitle.trim()?0.5:1}} className="pmBtn">
              <Robot size={15} color={GOLD} weight="regular" />
              {riskLoading&&riskTarget==='form' ? 'Analyzing…' : 'Analyze Risk'}
            </button>
          </div>
          {riskTarget==='form' && riskError && (
            <div style={{marginTop:10,padding:'8px 12px',background:'rgba(192,48,48,.12)',border:`1px solid rgba(192,48,48,.3)`,borderRadius:7,color:RED,fontSize:12}}>{riskError}</div>
          )}
          {riskTarget==='form' && riskResult && (
            <AIRiskPanel result={riskResult} onClose={()=>{setRiskResult(null);setRiskTarget(null);}} />
          )}
        </SectionCard>
      )}

      {/* Error */}
      {error && (
        <div style={{background:'rgba(192,48,48,.12)',border:`1px solid rgba(192,48,48,.3)`,borderRadius:8,padding:'12px 16px',marginBottom:20,color:RED,fontSize:13}}>
          {error}
        </div>
      )}

      {/* Contract Summary Bar */}
      <SectionCard title="Contract Summary" icon={<CurrencyDollar size={17} weight="duotone" color={GOLD} />} style={{ marginBottom: 20 }}>
        <div style={{display:'flex',gap:32,flexWrap:'wrap' as const,alignItems:'center'}}>
          <div>
            <div style={{fontSize:10,fontWeight:700,color:DIM,textTransform:'uppercase' as const,letterSpacing:.5,marginBottom:4}}>Original Contract</div>
            <div style={{fontSize:18,fontWeight:800,color:TEXT}}>{fmt(contractSum)}</div>
          </div>
          <div style={{color:BORDER,fontSize:20}}>+</div>
          <div>
            <div style={{fontSize:10,fontWeight:700,color:DIM,textTransform:'uppercase' as const,letterSpacing:.5,marginBottom:4}}>Approved COs</div>
            <div style={{fontSize:18,fontWeight:800,color:approvedCOs>=0?GREEN:RED}}>{approvedCOs>=0?'+':''}{fmt(approvedCOs)}</div>
          </div>
          <div style={{color:BORDER,fontSize:20}}>=</div>
          <div>
            <div style={{fontSize:10,fontWeight:700,color:DIM,textTransform:'uppercase' as const,letterSpacing:.5,marginBottom:4}}>Current Contract Sum</div>
            <div style={{fontSize:22,fontWeight:800,color:GOLD}}>{fmt(currentContract)}</div>
          </div>
          {pendingCOs!==0 && (
            <>
              <div style={{marginLeft:'auto',padding:'8px 16px',background:'rgba(245, 158, 11,.08)',border:`1px solid rgba(245, 158, 11,.2)`,borderRadius:8}}>
                <div style={{fontSize:10,fontWeight:700,color:DIM,textTransform:'uppercase' as const,letterSpacing:.5,marginBottom:3}}>Pending Approval</div>
                <div style={{fontSize:16,fontWeight:800,color:GOLD}}>{pendingCOs>=0?'+':''}{fmt(pendingCOs)}</div>
              </div>
            </>
          )}
        </div>
      </SectionCard>

      {/* KPI Cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12,marginBottom:24}}>
        <StatCard icon={<Clipboard size={19} weight="duotone" color={GOLD} />} label="Total COs" value={String(cos.length)} delay={0.02} />
        <StatCard icon={<Warning size={19} weight="duotone" color={GOLD} />} label="Pending" value={String(cos.filter(c=>c.status==='pending').length)} accent={GOLD} delay={0.06} />
        <StatCard icon={<CheckCircle size={19} weight="duotone" color="#3dd68c" />} label="Approved" value={String(cos.filter(c=>c.status==='approved').length)} accent="#3dd68c" delay={0.10} />
        <StatCard icon={<XCircle size={19} weight="duotone" color={RED} />} label="Rejected" value={String(cos.filter(c=>c.status==='rejected').length)} accent={RED} delay={0.14} />
      </div>

        {/* Loading */}
        {loading && <div style={{padding:40,textAlign:'center' as const,color:DIM}}>Loading change orders…</div>}

        {/* Empty */}
        {!loading && cos.length===0 && (
          <SectionCard>
            <PremiumEmpty
              icon={<Clipboard size={30} weight="duotone" color={GOLD} />}
              title="No change orders yet"
              description="Track scope changes, owner requests, and unforeseen conditions."
              action={
                <button onClick={()=>setShowForm(true)} style={goldButtonStyle} className="pmBtn">
                  <Plus size={15} weight="bold" /> Create First Change Order
                </button>
              }
            />
          </SectionCard>
        )}

        {/* Table */}
        {!loading && cos.length>0 && (
          <SectionCard title="Change Orders" icon={<Clipboard size={17} weight="duotone" color={GOLD} />} flush>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:13}}>
              <thead>
                <tr style={{background:DARK}}>
                  {['CO #','Title','Status','Cost Impact','Schedule Impact','Reason','Actions'].map(h=>(
                    <th key={h} style={{padding:'10px 14px',textAlign:'left' as const,fontSize:11,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:.5,color:DIM,borderBottom:`1px solid ${BORDER}`}}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cos.map((co:any)=>{
                  const st = statusStyle(co.status||'pending');
                  const cost = Number(co.cost_impact||0);
                  return (
                    <React.Fragment key={co.id}>
                    <tr style={{borderBottom:`1px solid rgba(255,255,255,0.12)`}}>
                      <td style={{padding:'12px 14px',color:GOLD,fontWeight:800}}>CO-{String(co.co_number).padStart(3,'0')}</td>
                      <td style={{padding:'12px 14px',color:TEXT,maxWidth:240}}>
                        <div style={{fontWeight:600}}>{co.title}</div>
                        {co.description && <div style={{fontSize:11,color:DIM,marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const,maxWidth:230}}>{co.description}</div>}
                      </td>
                      <td style={{padding:'12px 14px'}}>
                        <span style={{fontSize:10,fontWeight:700,padding:'3px 9px',borderRadius:4,background:st.bg,color:st.c,textTransform:'uppercase' as const,letterSpacing:.3}}>
                          {co.status||'pending'}
                        </span>
                      </td>
                      <td style={{padding:'12px 14px',position:'relative' as const}}>
                        {coEditId===co.id ? (
                          <div style={{display:'flex',alignItems:'center',gap:4}}>
                            <input value={coEditVal} onChange={e=>setCoEditVal(e.target.value)} type="number" autoFocus onKeyDown={e=>{if(e.key==='Enter')handleEditCO(co.id);if(e.key==='Escape')setCoEditId(null);}} style={{width:100,padding:'4px 8px',background:'#1c1c1e',border:`1px solid ${GOLD}`,borderRadius:5,color:TEXT,fontSize:12,outline:'none',textAlign:'right' as const}}/>
                            <button onClick={()=>handleEditCO(co.id)} style={{padding:'3px 8px',background:`linear-gradient(135deg,${GOLD},#FBBF24)`,border:'none',borderRadius:5,color:'#1C1C1E',fontSize:11,fontWeight:700,cursor:'pointer'}}>Save</button>
                            <button onClick={()=>setCoEditId(null)} style={{padding:'3px 8px',background:RAISED,border:`1px solid ${BORDER}`,borderRadius:5,color:DIM,fontSize:11,cursor:'pointer'}}>Cancel</button>
                          </div>
                        ) : (
                          <div style={{display:'flex',alignItems:'center',gap:4}}>
                            <span style={{color:cost>0?ORANGE:cost<0?RED:DIM,fontWeight:700}}>{cost>=0?'+':''}{fmt(cost)}</span>
                            {coCopiedId===co.id&&<span style={{fontSize:10,color:'#3dd68c',fontWeight:600}}>Copied!</span>}
                            <button onClick={()=>openCoMenu(co.id)} style={{background:'none',border:'none',color:DIM,cursor:'pointer',fontSize:10,padding:'2px 4px',lineHeight:1,opacity:0.6}} onMouseEnter={e=>(e.currentTarget.style.opacity='1')} onMouseLeave={e=>(e.currentTarget.style.opacity='0.6')}><CaretDown size={10} color={DIM} weight="regular" /></button>
                            {coMenuId===co.id&&(
                              <div style={{position:'absolute',top:36,right:14,background:RAISED,border:`1px solid ${BORDER}`,borderRadius:8,padding:4,zIndex:100,minWidth:150,boxShadow:'0 8px 24px rgba(0,0,0,.4)'}}>
                                {[
                                  {label:'Edit Amount',icon:<PencilSimple size={14} color={TEXT} weight="regular" />,action:()=>{setCoMenuId(null);setCoEditId(co.id);setCoEditVal(String(co.cost_impact||0));}},
                                  {label:'Copy Amount',icon:<Copy size={14} color={TEXT} weight="regular" />,action:()=>handleCopyCO(co.id,co.cost_impact||0)},
                                ].map(item=>(
                                  <div key={item.label} onClick={item.action} style={{padding:'7px 12px',fontSize:12,color:TEXT,cursor:'pointer',borderRadius:6,display:'flex',alignItems:'center',gap:8}} onMouseEnter={e=>(e.currentTarget.style.background=DARK)} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                                    <span style={{fontSize:14,display:'inline-flex',alignItems:'center'}}>{item.icon}</span>{item.label}
                                  </div>
                                ))}
                                <div style={{height:1,background:BORDER,margin:'4px 0'}}/>
                                <div onClick={()=>{if(confirm('Delete this change order?'))handleDeleteCO(co.id);}} style={{padding:'7px 12px',fontSize:12,color:RED,cursor:'pointer',borderRadius:6,display:'flex',alignItems:'center',gap:8}} onMouseEnter={e=>(e.currentTarget.style.background='rgba(192,48,48,.08)')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                                  <span style={{fontSize:14,display:'inline-flex',alignItems:'center'}}><Trash size={14} color={RED} weight="regular" /></span>Delete
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={{padding:'12px 14px',color:(co.schedule_impact||0)>0?ORANGE:DIM}}>
                        {(co.schedule_impact||0)>0 ? `+${co.schedule_impact} days` : '—'}
                      </td>
                      <td style={{padding:'12px 14px',color:DIM,maxWidth:150}}>
                        <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{co.reason||'—'}</div>
                      </td>
                      <td style={{padding:'12px 14px'}}>
                        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                          {co.status==='pending' && (
                            <>
                              <button onClick={()=>approveCO(co.id)} disabled={approvingId===co.id}
                                style={{background:`linear-gradient(135deg,${GOLD},#FBBF24)`,border:'none',borderRadius:5,color:'#1C1C1E',fontSize:11,padding:'4px 12px',fontWeight:800,cursor:approvingId===co.id?'wait':'pointer',opacity:approvingId===co.id?0.6:1}}>
                                {approvingId===co.id ? '…' : 'Approve'}
                              </button>
                              <button onClick={()=>rejectCO(co.id)} disabled={approvingId===co.id}
                                style={{background:'none',border:`1px solid rgba(192,48,48,.4)`,borderRadius:5,color:RED,fontSize:11,padding:'4px 12px',fontWeight:700,cursor:approvingId===co.id?'wait':'pointer',opacity:approvingId===co.id?0.6:1}}>
                                Reject
                              </button>
                            </>
                          )}
                          {co.status==='approved' && <span style={{fontSize:11,color:'#3dd68c',fontWeight:700,display:'inline-flex',alignItems:'center',gap:4}}><CheckCircle size={12} color="#3dd68c" weight="fill" />Approved</span>}
                          {co.status==='rejected' && <span style={{fontSize:11,color:RED,fontWeight:700,display:'inline-flex',alignItems:'center',gap:4}}><XCircle size={12} color={RED} weight="fill" />Rejected</span>}
                          <button
                            onClick={()=>{
                              if(riskTarget===co.id&&riskResult){setRiskResult(null);setRiskTarget(null);}
                              else analyzeRisk({title:co.title,description:co.description,reason:co.reason,cost_impact:co.cost_impact,schedule_impact:co.schedule_impact,status:co.status},co.id);
                            }}
                            disabled={riskLoading&&riskTarget===co.id}
                            style={{background:'rgba(245, 158, 11,.08)',border:`1px solid rgba(245, 158, 11,.25)`,borderRadius:5,color:GOLD,fontSize:11,padding:'4px 10px',fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
                            <Robot size={12} color={GOLD} weight="regular" />
                            {riskLoading&&riskTarget===co.id ? '…' : 'Risk'}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {riskTarget===co.id && (riskResult||riskError) && (
                      <tr>
                        <td colSpan={7} style={{padding:'0 14px 14px'}}>
                          {riskError && <div style={{padding:'8px 12px',background:'rgba(192,48,48,.12)',border:`1px solid rgba(192,48,48,.3)`,borderRadius:7,color:RED,fontSize:12}}>{riskError}</div>}
                          {riskResult && <AIRiskPanel result={riskResult} onClose={()=>{setRiskResult(null);setRiskTarget(null);}} />}
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  );
                })}
              </tbody>
              {coMenuId&&<div style={{position:'fixed',inset:0,zIndex:50}} onClick={()=>setCoMenuId(null)}/>}
            </table>
          </div>
          </SectionCard>
        )}
      </PremiumSurface>
    </>
  );
}
