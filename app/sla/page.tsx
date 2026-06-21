import React from 'react';

const GOLD='#C8881C',EYEBROW='#B07A12',BORDER='rgba(176,122,18,0.16)',DIM='#6B5B43',TEXT='#2A1B06',BODY='#3A2A12',GREEN='#1A8A4A',RED='#C03030';
const PAGE_BG='linear-gradient(180deg, #FCF7EE 0%, #F8EFDF 40%, #FBF2E3 70%, #F7ECDA 100%)';
const HAIRLINE=`1px solid ${BORDER}`;
const goldGradText:React.CSSProperties={background:'linear-gradient(135deg,#D89A1E,#A86A0C)',WebkitBackgroundClip:'text',backgroundClip:'text',WebkitTextFillColor:'transparent'};

const NAV = (
  <nav style={{position:'fixed',top:0,left:0,right:0,zIndex:100,height:56,background:'rgba(255,251,242,0.85)',borderBottom:'1px solid #F0E7D6',display:'flex',alignItems:'center',padding:'0 32px',gap:24,backdropFilter:'blur(12px)'}}>
    <a href="/" style={{display:'flex',alignItems:'center',gap:8,textDecoration:'none'}}>
      <span style={{fontSize:22}}>🌵</span>
      <span style={{fontWeight:800,fontSize:16,letterSpacing:1,color:GOLD}}>SAGUARO</span>
      <span style={{fontSize:10,background:GOLD,color:'#2A1B06',padding:'1px 6px',borderRadius:4,fontWeight:700}}>CRM</span>
    </a>
    <div style={{flex:1}}/>
    <a href="/login" style={{padding:'7px 16px',background:'rgba(212,160,23,.12)',border:`1px solid rgba(212,160,23,.3)`,borderRadius:7,color:GOLD,fontSize:13,fontWeight:700,textDecoration:'none'}}>Log In</a>
    <a href="/signup" style={{padding:'7px 16px',background:`linear-gradient(135deg,#E8B84B,#C98A1A)`,borderRadius:7,color:'#2A1B06',fontSize:13,fontWeight:800,textDecoration:'none',boxShadow:'0 6px 18px rgba(201,138,26,0.28)'}}>Start Free</a>
  </nav>
);

const UPTIME_TIERS = [
  {plan:'Starter',uptime:'99.9%',desc:'Up to 8.7 hours downtime per year',color:'#8A7350'},
  {plan:'Professional',uptime:'99.95%',desc:'Up to 4.4 hours downtime per year',color:GOLD,popular:true},
  {plan:'Enterprise',uptime:'99.99%',desc:'Up to 52 minutes downtime per year',color:'#A86A0C'},
];

const SUPPORT_ROWS = [
  {priority:'Critical',desc:'System unavailable / data loss risk',enterprise:'< 1 hour',pro:'< 4 hours',starter:'< 8 hours',eColor:GREEN,pColor:GREEN,sColor:'#B07A12'},
  {priority:'High',desc:'Major feature broken / blocking work',enterprise:'< 4 hours',pro:'< 8 hours',starter:'Next business day',eColor:GREEN,pColor:GREEN,sColor:DIM},
  {priority:'Medium',desc:'Feature degraded / workaround available',enterprise:'Next business day',pro:'2 business days',starter:'3 business days',eColor:DIM,pColor:DIM,sColor:DIM},
  {priority:'Low',desc:'Questions, feature requests, enhancements',enterprise:'2 business days',pro:'3 business days',starter:'Best effort',eColor:DIM,pColor:DIM,sColor:DIM},
];

const CREDITS = [
  {threshold:'< 99.9%',credit:'10% of monthly fee',desc:'Credit applied to next invoice'},
  {threshold:'< 99.5%',credit:'25% of monthly fee',desc:'Credit applied to next invoice'},
  {threshold:'< 99.0%',credit:'50% of monthly fee',desc:'Credit applied to next invoice'},
];

const EXCLUSIONS = [
  'Scheduled maintenance windows (announced 48h in advance via status page and email)',
  'Force majeure events — acts of God, war, pandemic, natural disasters',
  'Third-party service outages outside our control (AWS, Stripe, Anthropic)',
  'Customer-caused outages (misconfiguration, exceeding rate limits)',
  'Free trial periods',
  'Outages lasting less than 5 consecutive minutes',
];

export default function SLAPage() {
  return (
    <div style={{minHeight:'100vh',background:PAGE_BG,color:TEXT,fontFamily:'system-ui,sans-serif'}}>
      {NAV}

      {/* Hero */}
      <div style={{textAlign:'center',padding:'120px 24px 60px',background:'radial-gradient(circle at 80% 0%, rgba(216,154,30,0.12), transparent 60%), linear-gradient(160deg, #FFFBF2, #FDF3E2, #FBEAD2)'}}>
        <div style={{fontSize:12,fontWeight:700,color:EYEBROW,textTransform:'uppercase',letterSpacing:2,marginBottom:14}}>Service Level Agreement</div>
        <h1 style={{fontSize:52,fontWeight:900,margin:'0 0 16px',lineHeight:1.1,color:TEXT}}>Our Commitment to You</h1>
        <p style={{fontSize:18,color:DIM,maxWidth:560,margin:'0 auto',lineHeight:1.6}}>
          Uptime guarantees, support response times, and credit policies — clearly stated, no fine print.
        </p>
        <div style={{marginTop:16,fontSize:13,color:DIM}}>Effective: March 10, 2026</div>
      </div>

      {/* Uptime Tiers */}
      <div style={{maxWidth:1000,margin:'0 auto',padding:'0 24px 60px'}}>
        <h2 style={{fontSize:26,fontWeight:800,marginBottom:8,textAlign:'center',color:TEXT}}>Uptime Guarantee</h2>
        <p style={{color:DIM,textAlign:'center',marginBottom:36,fontSize:14}}>Measured as monthly uptime percentage, calculated over each calendar month.</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20}}>
          {UPTIME_TIERS.map(t=>(
            <div key={t.plan} style={{padding:'28px 24px',textAlign:'center',position:'relative',borderTop:t.popular?`3px solid ${GOLD}`:HAIRLINE}}>
              {t.popular&&<div style={{position:'absolute',top:-22,left:0,right:0,fontSize:10,fontWeight:800,color:GOLD,letterSpacing:1}}>MOST POPULAR</div>}
              <div>
                <div style={{fontSize:12,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:t.popular?EYEBROW:t.color,marginBottom:10}}>{t.plan}</div>
                <div style={{fontSize:52,fontWeight:900,lineHeight:1,...goldGradText}}>{t.uptime}</div>
                <div style={{fontSize:13,color:DIM,marginTop:10,lineHeight:1.5}}>{t.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Support SLA Table */}
      <div style={{background:'linear-gradient(180deg,#FBF3E4,#F7EAD4)',borderTop:HAIRLINE,borderBottom:HAIRLINE,padding:'60px 24px'}}>
        <div style={{maxWidth:1000,margin:'0 auto'}}>
          <h2 style={{fontSize:26,fontWeight:800,marginBottom:8,textAlign:'center',color:TEXT}}>Support Response SLAs</h2>
          <p style={{color:DIM,textAlign:'center',marginBottom:36,fontSize:14}}>Response times measured from ticket submission during business hours (9am–6pm MST, Mon–Fri).</p>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead>
                <tr style={{borderBottom:`2px solid ${BORDER}`}}>
                  <th style={{padding:'14px 20px',textAlign:'left',color:DIM,fontWeight:700,fontSize:11,textTransform:'uppercase',letterSpacing:.5}}>Priority</th>
                  <th style={{padding:'14px 20px',textAlign:'left',color:DIM,fontWeight:700,fontSize:11,textTransform:'uppercase',letterSpacing:.5}}>Description</th>
                  <th style={{padding:'14px 20px',textAlign:'center',color:'#A86A0C',fontWeight:700,fontSize:11,textTransform:'uppercase',letterSpacing:.5}}>Enterprise</th>
                  <th style={{padding:'14px 20px',textAlign:'center',color:GOLD,fontWeight:700,fontSize:11,textTransform:'uppercase',letterSpacing:.5}}>Professional</th>
                  <th style={{padding:'14px 20px',textAlign:'center',color:'#8A7350',fontWeight:700,fontSize:11,textTransform:'uppercase',letterSpacing:.5}}>Starter</th>
                </tr>
              </thead>
              <tbody>
                {SUPPORT_ROWS.map((row)=>(
                  <tr key={row.priority} style={{borderTop:HAIRLINE}}>
                    <td style={{padding:'14px 20px'}}>
                      <span style={{fontSize:11,fontWeight:800,padding:'3px 10px',borderRadius:4,background:row.priority==='Critical'?'rgba(192,48,48,.12)':row.priority==='High'?'rgba(212,160,23,.14)':'rgba(176,122,18,.08)',color:row.priority==='Critical'?RED:row.priority==='High'?GOLD:DIM}}>
                        {row.priority.toUpperCase()}
                      </span>
                    </td>
                    <td style={{padding:'14px 20px',color:DIM,fontSize:12}}>{row.desc}</td>
                    <td style={{padding:'14px 20px',textAlign:'center',color:row.eColor,fontWeight:600}}>{row.enterprise}</td>
                    <td style={{padding:'14px 20px',textAlign:'center',color:row.pColor,fontWeight:600}}>{row.pro}</td>
                    <td style={{padding:'14px 20px',textAlign:'center',color:row.sColor,fontWeight:600}}>{row.starter}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{marginTop:14,fontSize:12,color:DIM,textAlign:'center'}}>
            Enterprise customers also receive a dedicated account manager and 24/7 emergency line.
          </div>
        </div>
      </div>

      {/* Credits */}
      <div style={{maxWidth:900,margin:'0 auto',padding:'60px 24px'}}>
        <h2 style={{fontSize:26,fontWeight:800,marginBottom:8,textAlign:'center',color:TEXT}}>Service Credits</h2>
        <p style={{color:DIM,textAlign:'center',marginBottom:36,fontSize:14}}>If we miss our uptime commitment, you receive a credit on your next invoice. No need to ask — we apply credits automatically.</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
          {CREDITS.map((c,i)=>(
            <div key={c.threshold} style={{padding:'24px 22px',textAlign:'center',borderTop:HAIRLINE,borderLeft:i>0?HAIRLINE:'none'}}>
              <div style={{fontSize:13,color:DIM,marginBottom:8}}>Monthly uptime</div>
              <div style={{fontSize:26,fontWeight:900,color:RED,marginBottom:8}}>{c.threshold}</div>
              <div style={{fontSize:22,fontWeight:800,marginBottom:8,...goldGradText}}>{c.credit}</div>
              <div style={{fontSize:12,color:DIM}}>{c.desc}</div>
            </div>
          ))}
        </div>
        <div style={{marginTop:20,padding:'16px 0 0',borderTop:HAIRLINE,fontSize:13,color:DIM,lineHeight:1.7}}>
          <strong style={{color:TEXT}}>Credit cap:</strong> Total credits in any calendar month shall not exceed 50% of your monthly fee. Credits are non-transferable and have no cash value. To request a review, email <a href="mailto:sla@saguarocontrol.net" style={{color:GOLD,textDecoration:'none'}}>sla@saguarocontrol.net</a> within 30 days of the incident.
        </div>
      </div>

      {/* Exclusions */}
      <div style={{background:'linear-gradient(180deg,#FBF3E4,#F7EAD4)',borderTop:HAIRLINE,borderBottom:HAIRLINE,padding:'60px 24px'}}>
        <div style={{maxWidth:720,margin:'0 auto'}}>
          <h2 style={{fontSize:26,fontWeight:800,marginBottom:8,textAlign:'center',color:TEXT}}>Exclusions</h2>
          <p style={{color:DIM,textAlign:'center',marginBottom:32,fontSize:14}}>The following are not counted against our uptime commitment.</p>
          <div style={{display:'flex',flexDirection:'column'}}>
            {EXCLUSIONS.map((e,i)=>(
              <div key={i} style={{display:'flex',gap:12,alignItems:'flex-start',padding:'14px 4px',borderTop:i===0?'none':HAIRLINE}}>
                <span style={{color:GOLD,fontWeight:700,fontSize:13,marginTop:1}}>✗</span>
                <span style={{color:DIM,fontSize:13,lineHeight:1.6}}>{e}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Definitions */}
      <div style={{maxWidth:720,margin:'0 auto',padding:'60px 24px'}}>
        <h2 style={{fontSize:22,fontWeight:800,marginBottom:24,color:TEXT}}>Definitions</h2>
        {[
          {term:'Downtime',def:'Any period during which the Service is unavailable and not due to scheduled maintenance or excluded causes. Measured in 1-minute intervals.'},
          {term:'Monthly Uptime %',def:'((Total minutes in month − Downtime minutes) / Total minutes in month) × 100'},
          {term:'Scheduled Maintenance',def:'Planned maintenance announced via status.saguarocontrol.net and email at least 48 hours in advance. Typically performed Sunday 2am–4am MST.'},
          {term:'Credit Period',def:'Credits are calculated and applied to the next invoice following the month in which the SLA was missed.'},
        ].map(d=>(
          <div key={d.term} style={{marginBottom:20,paddingBottom:20,borderBottom:HAIRLINE}}>
            <div style={{fontWeight:700,color:TEXT,marginBottom:6}}>{d.term}</div>
            <div style={{color:DIM,fontSize:13,lineHeight:1.7}}>{d.def}</div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div style={{textAlign:'center',padding:'72px 24px',background:'radial-gradient(ellipse at 50% 0%, #251608, #0E0B08)'}}>
        <h2 style={{fontSize:26,fontWeight:900,marginBottom:10,color:'#F5E9D6'}}>SLA questions or incident reports?</h2>
        <p style={{color:'#C9B79A',marginBottom:20,fontSize:15}}>We respond to SLA inquiries within one business day.</p>
        <a href="mailto:sla@saguarocontrol.net" style={{display:'inline-block',padding:'13px 32px',background:`linear-gradient(135deg,#E8B84B,#C98A1A)`,borderRadius:9,color:'#2A1B06',fontWeight:800,fontSize:15,textDecoration:'none',boxShadow:'0 6px 18px rgba(201,138,26,0.28)'}}>
          sla@saguarocontrol.net
        </a>
        <div style={{marginTop:20,fontSize:13,color:'#C9B79A'}}>
          <a href="/security" style={{color:GOLD,textDecoration:'none'}}>Security</a> · <a href="/privacy" style={{color:GOLD,textDecoration:'none'}}>Privacy</a> · <a href="/terms" style={{color:GOLD,textDecoration:'none'}}>Terms</a>
        </div>
      </div>
    </div>
  );
}
