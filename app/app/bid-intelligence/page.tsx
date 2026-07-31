'use client';
import React, { useState, useEffect } from 'react';

const GOLD='#F59E0B',DARK='#0a0a0a',BORDER='rgba(255,255,255,0.08)',HAIRLINE='rgba(255,255,255,0.08)',CARD='rgba(255,255,255,0.02)',DIM='#CBD5E1',MUTED='rgba(255,255,255,0.45)',TEXT='#FFFFFF',GREEN='#3dd68c',RED='#c03030';

// Shapes returned by GET /api/bids/win-factors and GET /api/bids/history.
type WinFactor = { csi_division:string; trade:string|null; win_rate:number; win_count:number; loss_count:number; suggested_multiplier:number; confidence:number; sample_count:number; avg_over_winner_pct:number };
type BidRow = { id?:string; project_name?:string|null; project_type?:string|null; trades?:string[]|null; bid_amount?:number|null; margin_pct?:number|null; outcome?:string|null; loss_reason?:string|null };
type HistStats = { totalBids:number; wonBids:number; lostBids:number; winRate:number; avgMargin:number; totalValue:number };

export default function IntelligencePage() {
  const [scoring, setScoring] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [value, setValue] = useState('');
  const [trade, setTrade] = useState('Residential');
  const [result, setResult] = useState<Record<string,unknown>|null>(null);
  const [loading, setLoading] = useState(false);

  // Real win/loss intelligence — learned trade factors + this tenant's actual bid
  // history. No hardcoded numbers: we render exactly what the tenant has recorded,
  // or an honest empty state prompting them to mark bids Won/Lost.
  const [factors, setFactors] = useState<WinFactor[]>([]);
  const [winRate, setWinRate] = useState<number|null>(null);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [bids, setBids] = useState<BidRow[]>([]);
  const [stats, setStats] = useState<HistStats|null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [wfRes, hRes] = await Promise.all([
          fetch('/api/bids/win-factors'),
          fetch('/api/bids/history?limit=50'),
        ]);
        const wf = wfRes.ok ? await wfRes.json() : null;
        const h  = hRes.ok  ? await hRes.json()  : null;
        if (!alive) return;
        setFactors(Array.isArray(wf?.factors) ? wf.factors : []);
        setWinRate(typeof wf?.winRate === 'number' ? wf.winRate : null);
        setWins(Number(wf?.wins) || 0);
        setLosses(Number(wf?.losses) || 0);
        setBids(Array.isArray(h?.bids) ? h.bids : []);
        setStats(h?.stats ?? null);
      } catch {
        if (!alive) return;
        setFactors([]); setBids([]); setStats(null); setWinRate(null);
      } finally {
        if (alive) setDataLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  async function scoreOpportunity() {
    const estimatedValue = Number(String(value).replace(/[^0-9.]/g, ''));
    if (!title.trim() || !estimatedValue) {
      setResult({ error: 'Enter an opportunity title and estimated value to score.' });
      return;
    }
    setLoading(true);
    setResult(null);
    // Real AI scoring via /api/bids/score (Claude). No hardcoded results — we
    // render exactly what the model returns, or an honest error.
    try {
      const res = await fetch('/api/bids/score', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ projectName:title, projectType:trade, trade, estimatedValue, ourMargin:15, description:desc })
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ error: data?.error || 'Could not score this opportunity right now. Please try again.' });
      } else {
        setResult(data);
      }
    } catch {
      setResult({ error: 'Could not reach the scoring service. Please try again.' });
    }
    setLoading(false);
  }

  // Derived, all from real data above.
  const tradeLabel = (f: WinFactor) => (f.trade && f.trade.trim()) ? f.trade : (f.csi_division ? `CSI Div ${f.csi_division}` : 'Unspecified');
  const headlineWinRate = winRate != null ? Math.round(winRate * 100) : (stats ? stats.winRate : 0);
  const bidsAnalyzed = (wins + losses) || (stats ? stats.totalBids : 0);
  const avgMargin = stats ? stats.avgMargin : 0;
  const hasAnyData = factors.length > 0 || bids.length > 0;
  const ranked = [...factors].filter(f => (f.sample_count || 0) > 0).sort((a, b) => (b.win_rate || 0) - (a.win_rate || 0));
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];

  return (
    <div style={{padding:'40px 24px 80px',maxWidth:1200,margin:'0 auto'}}>
      <style>{`@media (max-width: 640px){ .pg-stack-1{ grid-template-columns: 1fr !important } }`}</style>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:40,gap:24,flexWrap:'wrap'}}>
        <div>
          <div style={{display:'inline-flex',alignItems:'center',gap:8,padding:'5px 12px',background:'transparent',border:'1px solid rgba(255,255,255,0.14)',borderRadius:999,fontSize:11,fontWeight:500,letterSpacing:1,textTransform:'uppercase' as const,color:MUTED,marginBottom:14}}>
            <span style={{width:5,height:5,borderRadius:'50%',background:GOLD,display:'inline-block'}}/>AI Learning Engine
          </div>
          <h1 style={{fontSize:26,fontWeight:600,color:TEXT,margin:'0 0 8px',letterSpacing:-0.3}}>Bid Intelligence</h1>
          <div style={{fontSize:14,color:DIM,lineHeight:1.5}}>Saguaro learns from every bid you win or lose. No competitor has this.</div>
        </div>
        <button onClick={()=>setScoring(!scoring)} style={{padding:'10px 18px',background:GOLD,border:'none',borderRadius:8,color:'#0a0a0a',fontSize:13,fontWeight:600,cursor:'pointer'}}>
          Score New Opportunity
        </button>
      </div>

      {/* Score opportunity panel */}
      {scoring&&<div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:14,padding:28,marginBottom:32}}>
        <div style={{fontWeight:600,fontSize:16,marginBottom:20,color:TEXT}}>Score a new bid opportunity</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:14,marginBottom:14}}>
          {[['Opportunity Title',title,setTitle,'e.g. 3,200 SF Custom Home - Scottsdale'],['Estimated Value',value,setValue,'$450,000']].map(f=>(
            <div key={f[0] as string}><label style={{display:'block',fontSize:11,fontWeight:500,color:MUTED,textTransform:'uppercase' as const,letterSpacing:.5,marginBottom:6}}>{f[0] as string}</label>
              <input value={f[1] as string} onChange={e=>(f[2] as Function)(e.target.value)} placeholder={f[3] as string} style={{width:'100%',padding:'9px 12px',background:DARK,border:`1px solid ${BORDER}`,borderRadius:8,color:TEXT,fontSize:13,outline:'none'}}/></div>
          ))}
          <div><label style={{display:'block',fontSize:11,fontWeight:500,color:MUTED,textTransform:'uppercase' as const,letterSpacing:.5,marginBottom:6}}>Trade Category</label>
            <select value={trade} onChange={e=>setTrade(e.target.value)} style={{width:'100%',padding:'9px 12px',background:DARK,border:`1px solid ${BORDER}`,borderRadius:8,color:TEXT,fontSize:13,cursor:'pointer'}}>
              {['Residential','Commercial','Addition','Remodel','Healthcare','Education'].map(t=><option key={t}>{t}</option>)}
            </select></div>
        </div>
        <div style={{marginBottom:14}}><label style={{display:'block',fontSize:11,fontWeight:500,color:MUTED,textTransform:'uppercase' as const,letterSpacing:.5,marginBottom:6}}>Description</label>
          <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={3} placeholder="Describe the project scope..." style={{width:'100%',padding:'9px 12px',background:DARK,border:`1px solid ${BORDER}`,borderRadius:8,color:TEXT,fontSize:13,outline:'none',resize:'vertical'}}/></div>
        <div style={{display:'flex',gap:10}}>
          <button onClick={scoreOpportunity} disabled={loading} style={{padding:'10px 20px',background:GOLD,border:'none',borderRadius:8,color:'#0a0a0a',fontSize:13,fontWeight:600,cursor:'pointer'}}>{loading?'Scoring...':'Score with AI'}</button>
          <button onClick={()=>setScoring(false)} style={{padding:'10px 20px',background:'transparent',border:`1px solid ${BORDER}`,borderRadius:8,color:DIM,fontSize:13,cursor:'pointer'}}>Cancel</button>
        </div>
        {result&&('error' in result)&&<div style={{marginTop:20,background:'rgba(192,48,48,.08)',border:`1px solid rgba(192,48,48,.3)`,borderRadius:10,padding:'14px 16px',fontSize:13,color:DIM}}>{result['error'] as string}</div>}
        {result&&!('error' in result)&&<div style={{marginTop:24,background:CARD,border:`1px solid ${BORDER}`,borderRadius:14,padding:24}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:0,marginBottom:20,borderTop:`1px solid ${HAIRLINE}`,borderBottom:`1px solid ${HAIRLINE}`}}>
            {[{l:'Fit Score',v:`${result['score']}/100`,c:TEXT},{l:'Win Probability',v:`${result['winProbability']}%`,c:GREEN},{l:'Recommendation',v:String(result['recommendation']??'').toUpperCase(),c:TEXT},{l:'Suggested Margin',v:`${result['suggestedMargin']}%`,c:TEXT}].map((k,i)=>(
              <div key={k.l} style={{textAlign:'center' as const,padding:'16px 10px',borderLeft:i>0?`1px solid ${HAIRLINE}`:'none'}}><div style={{fontSize:10,color:MUTED,fontWeight:500,textTransform:'uppercase' as const,letterSpacing:.5,marginBottom:8}}>{k.l}</div><div style={{fontSize:22,fontWeight:600,color:k.c}}>{k.v}</div></div>
            ))}
          </div>
          <div style={{background:DARK,borderRadius:8,padding:14,fontSize:13,color:DIM,lineHeight:1.7}}>{result['reasoning'] as string}</div>
          {Array.isArray(result['riskFactors'])&&(result['riskFactors'] as string[]).length>0&&<div style={{marginTop:14}}>
            <div style={{fontSize:11,color:MUTED,fontWeight:600,textTransform:'uppercase' as const,letterSpacing:.5,marginBottom:8}}>Risk Factors</div>
            {(result['riskFactors'] as string[]).map((rf,i)=>(
              <div key={i} style={{display:'flex',gap:8,alignItems:'flex-start',fontSize:12,color:DIM,lineHeight:1.6,marginBottom:5}}>
                <span style={{width:5,height:5,borderRadius:'50%',background:RED,marginTop:6,flexShrink:0}}/>{rf}
              </div>
            ))}
          </div>}
        </div>}
      </div>}

      {dataLoading ? (
        <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:14,padding:'48px 28px',textAlign:'center' as const,color:DIM,fontSize:13}}>
          <div style={{width:26,height:26,border:`2px solid ${BORDER}`,borderTopColor:GOLD,borderRadius:'50%',animation:'biSpin .8s linear infinite',margin:'0 auto 12px'}}/>
          Loading your win intelligence...
          <style>{`@keyframes biSpin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : !hasAnyData ? (
        <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:14,padding:'56px 28px',textAlign:'center' as const}}>
          <div style={{width:44,height:44,borderRadius:12,border:`1px solid ${BORDER}`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
            <span style={{width:8,height:8,borderRadius:'50%',background:GOLD,display:'inline-block'}}/>
          </div>
          <div style={{fontSize:16,fontWeight:600,color:TEXT,marginBottom:8}}>No win intelligence yet</div>
          <div style={{fontSize:13,color:DIM,lineHeight:1.6,maxWidth:440,margin:'0 auto'}}>Mark bids Won/Lost to build your win intelligence. Saguaro learns from every outcome and shows where you win — and where you leave money on the table.</div>
        </div>
      ) : (
      <div className="pg-stack-1" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}}>
        {/* Win rate profile — learned trade factors + real headline stats */}
        <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:14,padding:28}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20}}>
            <div style={{fontWeight:600,fontSize:16,color:TEXT}}>Bid intelligence profile</div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:0,marginBottom:24,borderTop:`1px solid ${HAIRLINE}`,borderBottom:`1px solid ${HAIRLINE}`}}>
            {[{l:'Overall Win Rate',v:`${headlineWinRate}%`},{l:'Avg Winning Margin',v:`${(avgMargin||0).toFixed(1)}%`},{l:'Bids Analyzed',v:String(bidsAnalyzed)}].map((k,i)=>(
              <div key={k.l} style={{padding:'16px 12px',borderLeft:i>0?`1px solid ${HAIRLINE}`:'none'}}>
                <div style={{fontSize:10,color:MUTED,fontWeight:500,textTransform:'uppercase' as const,letterSpacing:.5,marginBottom:6}}>{k.l}</div>
                <div style={{fontSize:24,fontWeight:600,color:TEXT}}>{k.v}</div>
              </div>
            ))}
          </div>
          {factors.length === 0 ? (
            <div style={{fontSize:12,color:DIM,lineHeight:1.6,padding:'4px 0 8px'}}>Trade-level win rates appear here as you log more Won/Lost outcomes across CSI divisions.</div>
          ) : factors.map(f=>{
            const wr = Math.round((f.win_rate||0)*100);
            const ci = Number(f.suggested_multiplier);
            const over = Number(f.avg_over_winner_pct);
            return (
            <div key={`${f.csi_division}-${f.trade??''}`} style={{marginBottom:14}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:5}}>
                <span style={{color:TEXT,fontWeight:500}}>{tradeLabel(f)}</span>
                <span style={{color:wr>=60?GREEN:wr>0?DIM:RED,fontWeight:600}}>{wr}% win ({f.win_count||0}/{f.sample_count||0})</span>
              </div>
              <div style={{height:5,background:'rgba(255,255,255,.08)',borderRadius:3}}>
                <div style={{height:'100%',width:`${wr}%`,background:wr>=60?GREEN:wr>0?DIM:RED,borderRadius:3}}/>
              </div>
              <div style={{display:'flex',gap:14,marginTop:5,fontSize:10,color:MUTED,flexWrap:'wrap' as const}}>
                {Number.isFinite(ci)&&ci>0&&<span>Competitive index <span style={{color:DIM,fontWeight:600}}>{ci.toFixed(2)}×</span></span>}
                {Number.isFinite(over)&&<span>Avg above winner <span style={{color:DIM,fontWeight:600}}>{over>0?'+':''}{over.toFixed(1)}%</span></span>}
                <span>{f.sample_count||0} sample{(f.sample_count||0)!==1?'s':''}</span>
              </div>
            </div>
          );})}
          {best && (
            <div style={{marginTop:20,display:'flex',gap:10,alignItems:'flex-start',background:CARD,border:`1px solid ${BORDER}`,borderRadius:10,padding:14,fontSize:12,color:DIM,lineHeight:1.6}}>
              <span style={{width:6,height:6,borderRadius:'50%',background:GOLD,marginTop:5,flexShrink:0}}/>
              <span><strong style={{color:TEXT,fontWeight:600}}>AI Recommendation:</strong> Strongest on {tradeLabel(best)} — {Math.round((best.win_rate||0)*100)}% win rate.{worst && worst!==best && (worst.win_rate||0) < (best.win_rate||0) ? ` Weakest on ${tradeLabel(worst)} — ${Math.round((worst.win_rate||0)*100)}% win rate; sharpen pricing or qualify harder there.` : ''}</span>
            </div>
          )}
        </div>

        {/* Bid history — this tenant's real recorded outcomes */}
        <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:14,overflow:'hidden'}}>
          <div style={{padding:'18px 24px',borderBottom:`1px solid ${BORDER}`,display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontWeight:600,fontSize:16,color:TEXT}}>Bid history</span>
          </div>
          {bids.length === 0 ? (
            <div style={{padding:'32px 24px',fontSize:13,color:DIM,lineHeight:1.6}}>No bids logged yet. Mark opportunities Won or Lost to build your history.</div>
          ) : (
          <div style={{overflowX:'auto',WebkitOverflowScrolling:'touch',maxWidth:'100%'}}>
          <table style={{width:'100%',minWidth:640,borderCollapse:'collapse' as const,fontSize:12}}>
            <thead><tr style={{borderBottom:`1px solid ${BORDER}`}}>
              {['Project','Type','Bid','Margin','Result'].map(h=><th key={h} style={{padding:'12px 14px',textAlign:'left' as const,fontSize:11,fontWeight:600,textTransform:'uppercase' as const,letterSpacing:.5,color:MUTED}}>{h}</th>)}
            </tr></thead>
            <tbody>{bids.map((o,i)=>{
              const oc = String(o.outcome||'').toLowerCase();
              const won = oc==='won', lost = oc==='lost';
              const proj = (o.project_name && o.project_name.trim()) || 'Untitled bid';
              const type = (o.project_type && o.project_type.trim()) || (Array.isArray(o.trades) && o.trades.length ? o.trades[0] : '—');
              const amt = Number(o.bid_amount)||0;
              const mp = o.margin_pct==null ? null : Number(o.margin_pct);
              return (
              <tr key={o.id||i} style={{borderBottom:`1px solid ${HAIRLINE}`}}>
                <td style={{padding:'12px 14px',color:TEXT,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{proj}</td>
                <td style={{padding:'12px 14px',color:DIM}}>{type}</td>
                <td style={{padding:'12px 14px',color:TEXT}}>${amt.toLocaleString()}</td>
                <td style={{padding:'12px 14px',color:DIM}}>{mp==null?'—':`${mp}%`}</td>
                <td style={{padding:'12px 14px'}}>
                  <span style={{fontSize:10,fontWeight:600,padding:'2px 8px',borderRadius:4,background:won?'rgba(26,138,74,.15)':lost?'rgba(192,48,48,.12)':'rgba(255,255,255,.06)',color:won?GREEN:lost?RED:DIM}}>
                    {(o.outcome||'').toString().toUpperCase()||'—'}
                  </span>
                  {lost&&o.loss_reason&&<div style={{fontSize:10,color:MUTED,marginTop:2}}>{o.loss_reason}</div>}
                </td>
              </tr>
            );})}</tbody>
          </table>
          </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
