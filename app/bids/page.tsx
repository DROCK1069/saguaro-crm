'use client';
import React, { useState } from 'react';
import Link from 'next/link';

const GOLD='#C8881C',EYEBROW='#B07A12',BORDER='rgba(176,122,18,0.16)',DIM='#6B5B43',TEXT='#2A1B06';
const PAGE_BG='linear-gradient(180deg, #FCF7EE 0%, #F8EFDF 40%, #FBF2E3 70%, #F7ECDA 100%)';

export default function BidsPage() {
  const [tab, setTab] = useState<'active'|'pipeline'|'history'>('active');
  const opportunities = [
    {id:'op-1',title:'Desert Ridge Medical Office — 12,000 SF',trade:'Commercial',value:2100000,fitScore:45,winPct:28,due:'2026-03-20',action:'investigate'},
    {id:'op-2',title:'Ahwatukee Custom Home — 3,400 SF',trade:'Residential',value:561000,fitScore:88,winPct:72,due:'2026-03-25',action:'bid'},
    {id:'op-3',title:'Mesa Kitchen & Bath Remodel',trade:'Remodel',value:94000,fitScore:95,winPct:85,due:'2026-04-01',action:'bid'},
    {id:'op-4',title:'Phoenix Office Buildout — 8,000 SF',trade:'Commercial',value:890000,fitScore:32,winPct:18,due:'2026-04-05',action:'pass'},
    {id:'op-5',title:'Scottsdale Addition — 700 SF Casita',trade:'Addition',value:118000,fitScore:92,winPct:80,due:'2026-04-10',action:'bid'},
  ];

  return (
    <div style={{minHeight:'100vh',background:PAGE_BG,fontFamily:'system-ui,sans-serif'}}>
      <div style={{padding:'24px 28px',maxWidth:1300,margin:'0 auto'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24}}>
        <div>
          <div style={{fontSize:12,fontWeight:700,color:EYEBROW,textTransform:'uppercase' as const,letterSpacing:2,marginBottom:6}}>Bids</div>
          <h1 style={{fontSize:26,fontWeight:800,color:TEXT,margin:0}}>Bid Center</h1>
          <div style={{fontSize:13,color:DIM,marginTop:4}}>AI-scored opportunities and active bid packages</div>
        </div>
        <div style={{display:'flex',gap:10}}>
          <Link href="/app/intelligence" style={{padding:'9px 16px',background:'rgba(212,160,23,.12)',border:'1px solid rgba(212,160,23,.3)',borderRadius:8,color:GOLD,fontSize:13,fontWeight:700,textDecoration:'none'}}>🧠 Bid Intelligence</Link>
          <button style={{padding:'9px 18px',background:`linear-gradient(135deg,#E8B84B,#C98A1A)`,border:'none',borderRadius:8,color:'#2A1B06',fontSize:13,fontWeight:800,cursor:'pointer',boxShadow:'0 6px 18px rgba(201,138,26,0.28)'}}>+ Score Opportunity</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:2,borderBottom:`1px solid ${BORDER}`,marginBottom:24}}>
        {(['active','pipeline','history'] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{padding:'10px 18px',border:'none',borderBottom:`2px solid ${tab===t?GOLD:'transparent'}`,background:'transparent',color:tab===t?GOLD:DIM,fontSize:13,fontWeight:tab===t?700:500,cursor:'pointer',textTransform:'capitalize' as const}}>
            {t==='active'?'Active Packages':t==='pipeline'?'Opportunity Pipeline':'Bid History'}
          </button>
        ))}
      </div>

      {tab==='pipeline'&&<div>
        <div style={{background:'rgba(212,160,23,.08)',border:'1px solid rgba(212,160,23,.22)',borderRadius:10,padding:'14px 18px',marginBottom:20,fontSize:13,color:DIM}}>
          🤖 <strong style={{color:TEXT}}>AI Scores These Automatically</strong> — Each opportunity is scored 0–100 for fit based on your win/loss history. Focus on green (BID) first.
        </div>
        <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:13}}>
          <thead><tr style={{borderBottom:`2px solid ${BORDER}`}}>
            {['Opportunity','Trade','Est. Value','Fit Score','Win Prob.','Bid Due','AI Recommendation','Actions'].map(h=>(
              <th key={h} style={{padding:'10px 14px',textAlign:'left' as const,fontSize:11,fontWeight:700,textTransform:'uppercase' as const,color:DIM}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>{opportunities.map(op=>{
            const ac = op.action==='bid'?{bg:'rgba(26,138,74,.12)',c:'#1A8A4A',label:'✓ BID'}:op.action==='pass'?{bg:'rgba(192,48,48,.12)',c:'#C03030',label:'✗ PASS'}:{bg:'rgba(212,160,23,.14)',c:GOLD,label:'? INVESTIGATE'};
            return <tr key={op.id} style={{borderBottom:`1px solid ${BORDER}`}}>
              <td style={{padding:'12px 14px',color:TEXT,fontWeight:600,maxWidth:240,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{op.title}</td>
              <td style={{padding:'12px 14px',color:DIM}}>{op.trade}</td>
              <td style={{padding:'12px 14px',color:TEXT}}>${op.value.toLocaleString()}</td>
              <td style={{padding:'12px 14px'}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:60,height:5,background:'rgba(176,122,18,.14)',borderRadius:3}}>
                    <div style={{height:'100%',width:`${op.fitScore}%`,background:op.fitScore>=70?'#1A8A4A':op.fitScore>=50?GOLD:'#C03030',borderRadius:3}}/>
                  </div>
                  <span style={{color:op.fitScore>=70?'#1A8A4A':op.fitScore>=50?GOLD:'#C03030',fontWeight:700}}>{op.fitScore}</span>
                </div>
              </td>
              <td style={{padding:'12px 14px',color:op.winPct>=60?'#1A8A4A':op.winPct>=40?GOLD:'#C03030',fontWeight:700}}>{op.winPct}%</td>
              <td style={{padding:'12px 14px',color:DIM}}>{op.due}</td>
              <td style={{padding:'12px 14px'}}>
                <span style={{fontSize:10,fontWeight:800,padding:'3px 10px',borderRadius:4,background:ac.bg,color:ac.c,border:`1px solid ${ac.c}33`}}>{ac.label}</span>
              </td>
              <td style={{padding:'12px 14px',display:'flex',gap:6}}>
                <button style={{background:'none',border:`1px solid ${BORDER}`,borderRadius:5,color:DIM,fontSize:11,padding:'3px 8px',cursor:'pointer'}}>Details</button>
                {op.action==='bid'&&<button style={{background:`linear-gradient(135deg,#E8B84B,#C98A1A)`,border:'none',borderRadius:5,color:'#2A1B06',fontSize:11,padding:'4px 10px',fontWeight:700,cursor:'pointer'}}>Bid →</button>}
              </td>
            </tr>;
          })}</tbody>
        </table>
      </div>}

      {tab==='active'&&<div style={{textAlign:'center' as const,padding:60,color:DIM}}>
        <div style={{fontSize:40,marginBottom:12}}>📬</div>
        <div style={{fontSize:18,fontWeight:700,color:TEXT,marginBottom:8}}>Bid Packages</div>
        <div style={{marginBottom:20}}>All awarded bid packages appear here. <Link href="/app/projects/demo-project-00000000-0000-0000-0000-000000000001/bid-packages" style={{color:GOLD}}>View project bid packages →</Link></div>
      </div>}

      {tab==='history'&&<div style={{textAlign:'center' as const,padding:60,color:DIM}}>
        <div style={{fontSize:40,marginBottom:12}}>📊</div>
        <div style={{fontSize:18,fontWeight:700,color:TEXT,marginBottom:8}}>Bid History</div>
        <div>Full bid history with AI post-mortems. <Link href="/app/intelligence" style={{color:GOLD}}>View Bid Intelligence →</Link></div>
      </div>}
      </div>
    </div>
  );
}
