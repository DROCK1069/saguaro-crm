'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { humanError } from '@/lib/errors';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  WarningCircle, FolderOpen, CheckCircle, XCircle, Warning, ArrowRight,
  Buildings, CurrencyDollar, Receipt, HandCoins, Coins, CalendarBlank,
  Lightning, Plus, ChartLineUp, ClipboardText, ListChecks, CalendarCheck, UsersThree,
} from '@phosphor-icons/react';
import { getAuthHeaders } from '@/lib/supabase-browser';
import { toCents, toDollars, sumCents, subCents, summarizeContract } from '@/lib/calc';
import { Skeleton, SkeletonKPI } from '@/components/ui/Skeleton';
import {
  CinematicPage, ModuleHero, HeroButton, StatCard, SectionCard, SectionLink, EmptyStatePremium, CIN,
} from '@/components/ui/cinematic';

const GOLD='#F59E0B',DARK='#0a0a0a',RAISED='#141416',BORDER='rgba(255,255,255,0.12)',DIM='#CBD5E1',TEXT='#FFFFFF',GREEN='#22C55E',RED='#EF4444';
const fmt = (n:number|null|undefined) => '$'+((n ?? 0).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0}));
const fmtPct = (a:number|null|undefined,b:number|null|undefined) => (b ?? 0)>0?(((a ?? 0)/(b as number))*100).toFixed(1)+'%':'0%';

export default function OverviewPage(){
  const { projectId } = useParams<{projectId:string}>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState('');

  const load = useCallback(async()=>{
    setLoading(true); setError(''); setNotFound(false);
    try {
      const auth = await getAuthHeaders();
      const r = await fetch('/api/projects/'+projectId, { headers: auth });
      if (r.status === 404) { setNotFound(true); return; }
      if (!r.ok) {
        let msg = '';
        try { const body = await r.json(); msg = body?.error || body?.message || ''; } catch { /* non-JSON body */ }
        console.error('load project overview failed', r.status, msg);
        throw new Error(msg || 'Request failed');
      }
      const d = await r.json();
      if (!d?.project) { setNotFound(true); return; }
      setData(d);
    } catch (e:any) {
      // Network failure or non-2xx — never swallow; surface a clean message.
      console.error(e);
      setError(humanError(e, 'Network error. Check your connection and try again.'));
    } finally {
      setLoading(false);
    }
  },[projectId]);

  useEffect(()=>{ load(); },[load]);

  async function runAutopilot(){
    setScanning(true); setScanMsg('');
    try {
      const auth = await getAuthHeaders();
      const res = await fetch('/api/autopilot/run', {
        method:'POST',
        headers:{'Content-Type':'application/json', ...auth},
        body: JSON.stringify({projectId}),
      });
      if (!res.ok) throw new Error('Scan failed');
      const json = await res.json();
      setScanMsg(json.summary || 'Autopilot scan complete.');
      // Refresh data to pick up new alerts
      const r2 = await fetch('/api/projects/'+projectId, { headers: auth });
      if (r2.ok) { const d2 = await r2.json(); setData(d2); }
    } catch { setScanMsg('Scan failed. Please try again.'); }
    finally { setScanning(false); }
  }

  // LOADING — skeleton placeholders, never computed zeros or an empty state.
  if(loading) return (
    <CinematicPage soft>
      <div style={{marginBottom:26}}>
        <Skeleton width={140} height={26} style={{marginBottom:14,borderRadius:999}}/>
        <Skeleton width={300} height={40} style={{marginBottom:10}}/>
        <Skeleton width={220} height={14}/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:14,marginBottom:26}}>
        {[0,1,2,3,4].map(i=><SkeletonKPI key={i}/>)}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(380px,1fr))',gap:18}}>
        {[0,1].map(col=>(
          <div key={col} style={{background:CIN.surface,border:`1px solid ${CIN.border}`,borderRadius:18,padding:20}}>
            <Skeleton width="40%" height={16} style={{marginBottom:16}}/>
            {[0,1,2,3,4,5].map(i=><Skeleton key={i} height={13} style={{marginBottom:12}}/>)}
          </div>
        ))}
      </div>
    </CinematicPage>
  );

  // ERROR — fetch threw / network failure / non-2xx (not a 404). Clear block + Retry.
  if(error) return (
    <CinematicPage soft>
      <div style={{maxWidth:560,margin:'40px auto'}}>
        <EmptyStatePremium
          icon={<WarningCircle size={38} weight="duotone" color={RED}/>}
          title="Couldn't load project"
          description={error}
          actionLabel="Retry"
          onAction={load}
        />
      </div>
    </CinematicPage>
  );

  // NOT FOUND — true 404 (or success with no project). Distinct from a load error.
  if(notFound || !data?.project) return (
    <CinematicPage soft>
      <div style={{maxWidth:560,margin:'40px auto'}}>
        <EmptyStatePremium
          icon={<FolderOpen size={38} weight="duotone" color={GOLD}/>}
          title="Project not found"
          description="This project doesn't exist or you don't have access to it."
          actionLabel="Back to Projects"
          actionHref="/app/projects"
        />
      </div>
    </CinematicPage>
  );

  const p = data.project;
  const payApps = data.payApps||[];
  const changeOrders = data.changeOrders||[];
  const rfis = data.rfis||[];
  const subs = data.subs||[];
  const budgetHealth = data.budgetHealth||{originalBudget:0,committedCost:0,actualCost:0,forecastCost:0,lineCount:0};
  const punchSummary = data.punchSummary||{total:0,open:0,complete:0};
  const schedulePhases = data.schedulePhases||[];
  const alerts = data.alerts||[];

  const contractSummary = summarizeContract(toCents(p.contract_amount||0), changeOrders.map((c:any)=>({ id:String(c.id??''), description:String(c.description??''), amount:toCents(c.cost_impact||0), status:c.status })));
  const approvedCOs = toDollars(contractSummary.approvedChangeOrders);
  const contractToDate = toDollars(contractSummary.revisedContract);
  const billedToDateCents = payApps.length>0?toCents(payApps[0].total_completed_and_stored||0):0;
  const billedToDate = toDollars(billedToDateCents);
  const paidToDateCents = sumCents(payApps.filter((pa:any)=>pa.status==='paid').map((pa:any)=>toCents(pa.current_payment_due||0)));
  const paidToDate = toDollars(paidToDateCents);
  const retainageHeldCents = sumCents(payApps.map((pa:any)=>toCents(pa.retainage_amount||0)));
  const retainageHeld = toDollars(retainageHeldCents);
  const balanceDueCents = subCents(subCents(billedToDateCents, retainageHeldCents), paidToDateCents);
  const balanceDue = Math.max(0, toDollars(balanceDueCents));
  const daysRemaining = p.end_date?Math.max(0,Math.ceil((new Date(p.end_date).getTime()-Date.now())/86400000)):0;
  const overdueRFIs = rfis.filter((r:any)=>r.status==='open'&&r.due_date&&r.due_date<new Date().toISOString().split('T')[0]);
  const budgetVariance = toDollars(subCents(toCents(budgetHealth.forecastCost), toCents(budgetHealth.originalBudget)));
  const budgetPct = budgetHealth.originalBudget > 0 ? (budgetHealth.actualCost / budgetHealth.originalBudget * 100).toFixed(1) : '0';

  const detailRow = (l:string,v:React.ReactNode) => (
    <div key={l} style={{display:'flex',padding:'8px 0',borderBottom:`1px solid ${CIN.border}`,fontSize:13}}>
      <span style={{minWidth:150,color:CIN.faint,fontWeight:600}}>{l}</span>
      <span style={{color:TEXT,textTransform:'capitalize' as const}}>{v}</span>
    </div>
  );
  const summaryRow = (l:string,v:React.ReactNode,color?:string) => (
    <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:`1px solid ${CIN.border}`,fontSize:13}}>
      <span style={{color:CIN.faint}}>{l}</span><span style={{color:color||TEXT,fontWeight:600}}>{v}</span>
    </div>
  );

  return (
    <CinematicPage>
      <ModuleHero
        eyebrow="Project Overview"
        eyebrowIcon={<Buildings size={12} weight="fill" />}
        icon={<Buildings size={26} weight="duotone" color={CIN.goldHi} />}
        title={p.name}
        subtitle={[p.address,p.city,p.state].filter(Boolean).join(', ') || 'Command center for this project — financials, schedule, and field health at a glance.'}
        actions={<>
          <HeroButton variant="ghost" onClick={runAutopilot} disabled={scanning} icon={<Lightning size={15} weight="fill" color={CIN.goldHi} />}>
            {scanning?'Scanning…':'Run Autopilot'}
          </HeroButton>
          <HeroButton href={'/app/projects/'+projectId+'/pay-apps/new'} icon={<Plus size={15} weight="bold" color="#241a05" />}>
            New Pay App
          </HeroButton>
        </>}
      />

      {scanMsg&&<div style={{marginBottom:20,padding:'13px 18px',background: scanMsg.includes('failed') ? 'rgba(239,68,68,.1)' : 'rgba(34,197,94,.1)',border:`1px solid ${scanMsg.includes('failed') ? 'rgba(239,68,68,.35)' : 'rgba(34,197,94,.35)'}`,borderRadius:14,fontSize:13,fontWeight:600,color: scanMsg.includes('failed') ? RED : GREEN,display:'flex',alignItems:'center',gap:8}}>
        <span style={{fontSize:16,display:'inline-flex',verticalAlign:'middle'}}>{scanMsg.includes('failed') ? <XCircle size={16} weight="fill" color={RED}/> : <CheckCircle size={16} weight="fill" color={GREEN}/>}</span>
        {scanMsg}
      </div>}

      {/* KPI stat tiles */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:14,marginBottom:22}}>
        <StatCard delay={0.02} icon={<CurrencyDollar size={17} weight="duotone" color={CIN.goldHi}/>} label="Contract to Date" value={fmt(contractToDate)} sub={approvedCOs>0?'+'+fmt(approvedCOs)+' in COs':'No change orders'}/>
        <StatCard delay={0.06} icon={<Receipt size={17} weight="duotone" color={CIN.goldHi}/>} label="Billed to Date" value={fmt(billedToDate)} sub={fmtPct(billedToDate,contractToDate)+' complete'}/>
        <StatCard delay={0.10} icon={<HandCoins size={17} weight="duotone" color={CIN.goldHi}/>} label="Paid to Date" value={fmt(paidToDate)} sub={payApps.filter((pa:any)=>pa.status==='paid').length+' payment(s)'}/>
        <StatCard delay={0.14} icon={<Coins size={17} weight="duotone" color={CIN.goldHi}/>} label="Retainage Held" value={fmt(retainageHeld)} sub={(p.retainage_percent||10)+'% retained'}/>
        <StatCard delay={0.18} icon={<CalendarBlank size={17} weight="duotone" color={CIN.goldHi}/>} label="Days Remaining" value={daysRemaining>0?String(daysRemaining):'—'} valueColor={daysRemaining>0&&daysRemaining<14?CIN.red:undefined} sub={p.end_date?'Due '+p.end_date:'No end date set'}/>
      </div>

      {overdueRFIs.length>0&&<div style={{background:'rgba(239,68,68,.07)',border:'1px solid rgba(239,68,68,.28)',borderRadius:14,padding:'14px 18px',marginBottom:18,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
        <span style={{fontWeight:700,color:TEXT,fontSize:14,display:'inline-flex',alignItems:'center',gap:8}}><Warning size={16} weight="fill" color={RED}/> {overdueRFIs.length} overdue RFI(s) need a response</span>
        <Link href={'/app/projects/'+projectId+'/rfis'} style={{fontSize:12,color:CIN.goldHi,textDecoration:'none',fontWeight:700,display:'inline-flex',alignItems:'center',gap:4}}>View RFIs <ArrowRight size={12} weight="bold" color={CIN.goldHi}/></Link>
      </div>}

      {alerts.length>0&&<div style={{marginBottom:18}}>
        <SectionCard title="Autopilot Alerts" icon={<Lightning size={18} weight="duotone" color={CIN.goldHi}/>}>
          {alerts.slice(0,3).map((a:any)=>(
            <div key={a.id} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'8px 0',borderBottom:`1px solid ${CIN.border}`}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:GOLD,marginTop:6,flexShrink:0,boxShadow:'0 0 8px rgba(245,158,11,.7)'}}/>
              <div style={{minWidth:0}}><div style={{fontSize:13,color:TEXT,fontWeight:600}}>{a.title}</div><div style={{fontSize:11.5,color:CIN.faint,marginTop:1}}>{a.message}</div></div>
              <div style={{marginLeft:'auto',fontSize:10,color:CIN.faint,whiteSpace:'nowrap' as const}}>{new Date(a.created_at).toLocaleDateString()}</div>
            </div>
          ))}
        </SectionCard>
      </div>}

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(380px,1fr))',gap:18,alignItems:'start'}}>
        <div style={{display:'flex',flexDirection:'column',gap:18}}>
          <SectionCard title="Project Details" icon={<ClipboardText size={18} weight="duotone" color={CIN.goldHi}/>} delay={0.05}>
            {[['Status',p.status||'active'],['Type',p.project_type||'—'],['State',p.state||'—'],['Owner',p.owner_entity?.name||'—'],['Architect',p.architect_entity?.name||'—'],['Start Date',p.start_date||'—'],['End Date',p.end_date||'—'],['GC License',p.gc_license||'—'],['Prevailing Wage',p.prevailing_wage?'Yes':'No'],['Public Project',p.is_public_project?'Yes':'No']].map(([l,v]:any)=>detailRow(l,v))}
          </SectionCard>
          {budgetHealth.lineCount>0&&<SectionCard title="Budget Health" icon={<ChartLineUp size={18} weight="duotone" color={CIN.goldHi}/>} action={<SectionLink href={'/app/projects/'+projectId+'/budget'}>View Budget <ArrowRight size={11} weight="bold" color={CIN.goldHi}/></SectionLink>} delay={0.1}>
            <div style={{marginBottom:16}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:8,fontSize:12}}>
                <span style={{color:CIN.faint}}>Actual vs. Budget</span>
                <span style={{color:budgetVariance>0?RED:GREEN,fontWeight:700}}>{budgetPct}% spent</span>
              </div>
              <div style={{height:9,background:'rgba(255,255,255,0.06)',borderRadius:999,overflow:'hidden'}}>
                <div style={{height:'100%',background:parseFloat(budgetPct)>90?RED:parseFloat(budgetPct)>75?GOLD:GREEN,width:Math.min(100,parseFloat(budgetPct))+'%',borderRadius:999,transition:'width .5s ease',boxShadow:'0 0 12px rgba(245,158,11,.4)'}}/>
              </div>
            </div>
            {[['Original Budget',fmt(budgetHealth.originalBudget)],['Committed Cost',fmt(budgetHealth.committedCost)],['Actual Cost',fmt(budgetHealth.actualCost)],['Forecast',fmt(budgetHealth.forecastCost)],['Variance',fmt(Math.abs(budgetVariance))+(budgetVariance>0?' over':' under')]].map(([l,v]:any)=>summaryRow(l,v,l==='Variance'?(budgetVariance>0?RED:GREEN):undefined))}
          </SectionCard>}
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:18}}>
          <SectionCard title="Financial Summary" icon={<CurrencyDollar size={18} weight="duotone" color={CIN.goldHi}/>} action={<SectionLink href={'/app/projects/'+projectId+'/pay-apps'}>All Pay Apps <ArrowRight size={11} weight="bold" color={CIN.goldHi}/></SectionLink>} delay={0.05}>
            {[['Original Contract',fmt(p.original_contract||p.contract_amount||0)],['Change Orders','+'+fmt(approvedCOs)],['Contract to Date',fmt(contractToDate)],['Billed to Date',fmt(billedToDate)+' ('+fmtPct(billedToDate,contractToDate)+')'],['Retainage Held',fmt(retainageHeld)],['Total Paid',fmt(paidToDate)],['Balance Due',fmt(balanceDue)]].map(([l,v]:any)=>summaryRow(l,v))}
          </SectionCard>
          {punchSummary.total>0&&<SectionCard title="Punch List" icon={<ListChecks size={18} weight="duotone" color={CIN.goldHi}/>} action={<SectionLink href={'/app/projects/'+projectId+'/punch-list'}>View All <ArrowRight size={11} weight="bold" color={CIN.goldHi}/></SectionLink>} delay={0.1}>
            <div style={{display:'flex',gap:12,marginBottom:14}}>
              {[
                {v:punchSummary.open,l:'Open',c:RED,bg:'rgba(239,68,68,.08)',bd:'rgba(239,68,68,.22)'},
                {v:punchSummary.complete,l:'Complete',c:GREEN,bg:'rgba(34,197,94,.08)',bd:'rgba(34,197,94,.22)'},
                {v:punchSummary.total,l:'Total',c:TEXT,bg:'rgba(255,255,255,.04)',bd:CIN.border},
              ].map(s=>(
                <div key={s.l} style={{flex:1,textAlign:'center' as const,padding:'12px 0',background:s.bg,borderRadius:12,border:`1px solid ${s.bd}`}}>
                  <div style={{fontSize:24,fontWeight:900,color:s.c}}>{s.v}</div>
                  <div style={{fontSize:10,fontWeight:800,color:CIN.faint,textTransform:'uppercase' as const,marginTop:3,letterSpacing:'0.06em'}}>{s.l}</div>
                </div>
              ))}
            </div>
            {punchSummary.total>0&&<div style={{height:9,background:'rgba(255,255,255,0.06)',borderRadius:999,overflow:'hidden'}}>
              <div style={{height:'100%',background:GREEN,width:(punchSummary.complete/punchSummary.total*100).toFixed(1)+'%',borderRadius:999,boxShadow:'0 0 12px rgba(34,197,94,.4)'}}/>
            </div>}
          </SectionCard>}
          {schedulePhases.length>0&&<SectionCard title="Schedule" icon={<CalendarCheck size={18} weight="duotone" color={CIN.goldHi}/>} action={<SectionLink href={'/app/projects/'+projectId+'/schedule'}>Full Schedule <ArrowRight size={11} weight="bold" color={CIN.goldHi}/></SectionLink>} delay={0.15}>
            {schedulePhases.slice(0,4).map((phase:any)=>{
              const planned = phase.planned_end;
              const actual = phase.actual_end||phase.forecast_end;
              const late = planned&&actual&&actual>planned&&phase.status!=='complete';
              return <div key={phase.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:`1px solid ${CIN.border}`}}>
                <div style={{width:8,height:8,borderRadius:'50%',flexShrink:0,background:phase.status==='complete'?GREEN:late?RED:phase.status==='in_progress'?GOLD:CIN.faint}}/>
                <div style={{flex:1,fontSize:13,color:TEXT,fontWeight:600}}>{phase.name}</div>
                <div style={{fontSize:11,color:late?RED:CIN.faint}}>{phase.planned_end||'—'}</div>
                <span style={{fontSize:10,padding:'3px 8px',borderRadius:999,background:phase.status==='complete'?'rgba(34,197,94,.14)':phase.status==='in_progress'?'rgba(245,158,11,.14)':'rgba(148,163,184,.1)',color:phase.status==='complete'?GREEN:phase.status==='in_progress'?GOLD:CIN.faint,fontWeight:800,textTransform:'uppercase' as const,letterSpacing:'0.04em'}}>{phase.status||'pending'}</span>
              </div>;
            })}
          </SectionCard>}
          <SectionCard title="Subcontractors" icon={<UsersThree size={18} weight="duotone" color={CIN.goldHi}/>} action={<SectionLink href={'/app/projects/'+projectId+'/team'}>Manage <ArrowRight size={11} weight="bold" color={CIN.goldHi}/></SectionLink>} delay={0.2}>
            {subs.length===0
              ?<div style={{color:CIN.faint,fontSize:13,textAlign:'center',padding:'14px 0'}}>No subs yet. <Link href={'/app/projects/'+projectId+'/team'} style={{color:CIN.goldHi,fontWeight:700}}>Add subs</Link></div>
              :subs.slice(0,4).map((sub:any)=>(
                <div key={sub.id} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:`1px solid ${CIN.border}`}}>
                  <div style={{width:32,height:32,borderRadius:'50%',background:'linear-gradient(150deg, rgba(245,158,11,0.22), rgba(245,158,11,0.06))',border:'1px solid rgba(245,158,11,.28)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:800,flexShrink:0,color:CIN.goldHi}}>{sub.name?.[0]||'?'}</div>
                  <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,color:TEXT,fontWeight:600}}>{sub.name}</div><div style={{fontSize:11.5,color:CIN.faint}}>{sub.trade} — {fmt(sub.contract_amount||0)}</div></div>
                  <span style={{fontSize:10,padding:'3px 8px',borderRadius:999,background:sub.status==='active'?'rgba(34,197,94,.14)':'rgba(148,163,184,.1)',color:sub.status==='active'?GREEN:CIN.faint,fontWeight:800,textTransform:'uppercase' as const}}>{sub.status}</span>
                </div>
              ))
            }
          </SectionCard>
        </div>
      </div>
    </CinematicPage>
  );
}
