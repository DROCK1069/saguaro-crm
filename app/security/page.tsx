import React from 'react';

const GOLD='#C8881C',DARK='#F2F2F7',RAISED='#FFFBF2',BORDER='#F0E7D6',DIM='#6B5B43',TEXT='#2A1B06',GREEN='#22c55e';
const PAGE_BG='linear-gradient(180deg, #FCF7EE 0%, #F8EFDF 40%, #FBF2E3 70%, #F7ECDA 100%)';
const HERO_BG='linear-gradient(160deg, #FFFBF2, #FDF3E2, #FBEAD2)';
const CARD_SHADOW='0 8px 26px rgba(120,80,20,0.09)';

const NAV = (
  <nav style={{position:'fixed',top:0,left:0,right:0,zIndex:100,height:56,background:'rgba(255,251,242,.92)',borderBottom:`1px solid ${BORDER}`,display:'flex',alignItems:'center',padding:'0 32px',gap:24,backdropFilter:'blur(12px)'}}>
    <a href="/" style={{display:'flex',alignItems:'center',gap:8,textDecoration:'none'}}>
      <span style={{fontSize:22}}>🌵</span>
      <span style={{fontWeight:800,fontSize:16,letterSpacing:1,color:GOLD}}>SAGUARO</span>
      <span style={{fontSize:10,background:GOLD,color:'#FFFBF2',padding:'1px 6px',borderRadius:4,fontWeight:700}}>CRM</span>
    </a>
    <div style={{flex:1}}/>
    <a href="/login" style={{padding:'7px 16px',background:'rgba(212,160,23,.12)',border:`1px solid rgba(212,160,23,.3)`,borderRadius:7,color:GOLD,fontSize:13,fontWeight:700,textDecoration:'none'}}>Log In</a>
    <a href="/signup" style={{padding:'7px 16px',background:`linear-gradient(135deg,#E8B84B,#C98A1A)`,borderRadius:7,color:'#2A1B06',fontSize:13,fontWeight:800,textDecoration:'none',boxShadow:'0 6px 18px rgba(201,138,26,0.28)'}}>Start Free</a>
  </nav>
);

const FEATURES = [
  {icon:'🔐',title:'SOC 2 Type II',desc:'Audit in progress. We follow SOC 2 security, availability, and confidentiality trust principles. Expected certification Q3 2026.',color:'linear-gradient(135deg,#FFFBF2,#FDF3E0)',border:'#F0E7D6'},
  {icon:'🔒',title:'256-bit AES Encryption',desc:'All data at rest is encrypted using AES-256, the same standard used by banks and government agencies. Your data is unreadable without your credentials.',color:'linear-gradient(135deg,#FFFBF2,#FDF3E0)',border:'#F0E7D6'},
  {icon:'🛡️',title:'TLS 1.3 in Transit',desc:'Every byte transferred between your browser and our servers is protected with TLS 1.3. We enforce HTTPS everywhere and reject older protocols.',color:'linear-gradient(135deg,#FFFBF2,#FDF3E0)',border:'#F0E7D6'},
  {icon:'🧱',title:'Row-Level Security',desc:'Powered by Supabase RLS policies. Each user can only access their own organization\'s data — enforced at the database layer, not just the application layer.',color:'linear-gradient(135deg,#FFFBF2,#FDF3E0)',border:'#F0E7D6'},
  {icon:'🌍',title:'GDPR Compliant',desc:'We honor data subject rights: access, correction, deletion, and export. Data processing agreements available. EU residents can request their data at any time.',color:'linear-gradient(135deg,#FFFBF2,#FDF3E0)',border:'#F0E7D6'},
  {icon:'🧪',title:'Penetration Testing',desc:'Annual third-party penetration tests are conducted by independent security firms. Findings are remediated within 30 days. Reports available under NDA for Enterprise customers.',color:'linear-gradient(135deg,#FFFBF2,#FDF3E0)',border:'#F0E7D6'},
];

const INFRA = [
  {label:'Cloud Provider',value:'AWS us-east-1 (via Supabase + Vercel)'},
  {label:'Uptime SLA',value:'99.9% monthly — Enterprise 99.99%'},
  {label:'Automatic Backups',value:'Daily backups with 30-day retention'},
  {label:'Point-in-Time Recovery',value:'Restore to any second in the last 7 days'},
  {label:'CDN & Edge Network',value:'Vercel global edge — <50ms for 95% of users'},
  {label:'Database',value:'PostgreSQL 15 (Supabase managed)'},
];

const DATA = [
  {icon:'🚫',title:'We Never Sell Your Data',desc:'Your project data, documents, and company information are never sold to third parties — ever. Period.'},
  {icon:'📦',title:'Data Export Anytime',desc:'Export all your data in machine-readable JSON or CSV format at any time from Settings. No hoops to jump through.'},
  {icon:'🗑️',title:'30-Day Retention After Cancel',desc:'When you cancel, your data is preserved for 30 days. After that it is permanently deleted. You can also request immediate deletion.'},
];

export default function SecurityPage() {
  return (
    <div style={{minHeight:'100vh',background:PAGE_BG,color:TEXT,fontFamily:'system-ui,sans-serif'}}>
      {NAV}

      {/* Hero */}
      <div style={{position:'relative',overflow:'hidden',paddingTop:120,textAlign:'center',padding:'120px 24px 80px',background:HERO_BG,borderBottom:`1px solid ${BORDER}`}}>
        <div style={{position:'absolute',top:-160,right:-80,width:620,height:620,background:'radial-gradient(circle at 80% 0%, rgba(216,154,30,0.12), transparent 60%)',pointerEvents:'none'}} />
        <div style={{position:'relative',zIndex:1}}>
          <div style={{fontSize:12,fontWeight:700,color:'#B07A12',textTransform:'uppercase',letterSpacing:2,marginBottom:14}}>Security & Compliance</div>
          <h1 style={{fontSize:52,fontWeight:900,margin:'0 0 16px',lineHeight:1.1,color:TEXT}}>Enterprise-Grade Security</h1>
          <p style={{fontSize:20,color:DIM,maxWidth:540,margin:'0 auto',lineHeight:1.6}}>Your construction data protected at every layer — from the database to your browser.</p>
        </div>
      </div>

      {/* Feature Grid */}
      <div style={{maxWidth:1100,margin:'0 auto',padding:'80px 24px'}}>
        <h2 style={{fontSize:28,fontWeight:800,marginBottom:32,textAlign:'center',color:TEXT}}>Security Features</h2>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:36}}>
          {FEATURES.map(f=>(
            <div key={f.title} style={{borderTop:`1px solid rgba(176,122,18,0.16)`,paddingTop:22}}>
              <div style={{fontSize:32,marginBottom:12}}>{f.icon}</div>
              <div style={{fontWeight:800,fontSize:15,color:TEXT,marginBottom:8}}>{f.title}</div>
              <div style={{fontSize:13,color:DIM,lineHeight:1.7}}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Infrastructure */}
      <div style={{position:'relative',overflow:'hidden',background:'linear-gradient(180deg,#FBF3E4,#F7EAD4)',borderTop:`1px solid ${BORDER}`,borderBottom:`1px solid ${BORDER}`,padding:'80px 24px'}}>
        <div style={{position:'absolute',top:0,left:'50%',transform:'translateX(-50%)',width:1000,height:320,background:'radial-gradient(circle at 50% 0%, rgba(216,154,30,0.10), transparent 60%)',pointerEvents:'none'}} />
        <div style={{position:'relative',zIndex:1,maxWidth:900,margin:'0 auto'}}>
          <h2 style={{fontSize:28,fontWeight:800,marginBottom:8,textAlign:'center',color:TEXT}}>Built on Supabase + Vercel</h2>
          <p style={{color:DIM,textAlign:'center',marginBottom:40,fontSize:15}}>Industry-leading infrastructure so you can focus on building — not on uptime.</p>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:0}}>
            {INFRA.map((row,i)=>(
              <div key={row.label} style={{padding:'18px 24px',borderBottom:`1px solid rgba(176,122,18,0.16)`,borderRight:i%2===0?`1px solid rgba(176,122,18,0.16)`:'none'}}>
                <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:.5,color:DIM,marginBottom:4}}>{row.label}</div>
                <div style={{fontWeight:600,color:TEXT,fontSize:14}}>{row.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Data Practices */}
      <div style={{maxWidth:900,margin:'0 auto',padding:'60px 24px 80px'}}>
        <h2 style={{fontSize:28,fontWeight:800,marginBottom:8,textAlign:'center',color:TEXT}}>Our Data Practices</h2>
        <p style={{color:DIM,textAlign:'center',marginBottom:40,fontSize:15}}>We believe your data belongs to you. Full stop.</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:36}}>
          {DATA.map(d=>(
            <div key={d.title} style={{borderTop:`1px solid rgba(176,122,18,0.16)`,paddingTop:24,textAlign:'center'}}>
              <div style={{fontSize:36,marginBottom:14}}>{d.icon}</div>
              <div style={{fontWeight:800,fontSize:15,color:TEXT,marginBottom:8}}>{d.title}</div>
              <div style={{fontSize:13,color:DIM,lineHeight:1.7}}>{d.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Responsible Disclosure */}
      <div style={{maxWidth:720,margin:'0 auto',padding:'0 24px 60px'}}>
        <div style={{borderTop:`1px solid rgba(176,122,18,0.16)`,paddingTop:28}}>
          <div style={{fontWeight:800,fontSize:16,color:TEXT,marginBottom:8}}>Responsible Disclosure</div>
          <p style={{color:DIM,fontSize:14,lineHeight:1.7,margin:'0 0 12px'}}>
            Found a security vulnerability? We take all reports seriously. Please email us at{' '}
            <a href="mailto:security@saguarocontrol.net" style={{color:GOLD,textDecoration:'none',fontWeight:700}}>security@saguarocontrol.net</a>{' '}
            and we will respond within 24 hours. We do not pursue legal action against good-faith researchers.
          </p>
          <div style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:DIM}}>
            <span style={{color:GREEN}}>✓</span> We acknowledge receipt within 24h
            <span style={{marginLeft:12,color:GREEN}}>✓</span> We remediate critical findings within 7 days
            <span style={{marginLeft:12,color:GREEN}}>✓</span> We credit researchers who disclose responsibly
          </div>
        </div>
      </div>

      {/* CTA */}
      <div style={{position:'relative',overflow:'hidden',textAlign:'center',padding:'92px 24px',background:'radial-gradient(ellipse at 50% 0%, #251608, #0E0B08)'}}>
        <div style={{position:'absolute',top:'40%',left:'50%',transform:'translate(-50%,-50%)',width:900,height:500,background:'radial-gradient(ellipse, rgba(232,168,60,0.20) 0%, transparent 68%)',pointerEvents:'none'}} />
        <div style={{position:'relative',zIndex:1}}>
          <h2 style={{fontSize:28,fontWeight:900,marginBottom:12,color:'#F5E9D6'}}>Questions about security?</h2>
          <p style={{color:'#C9B79A',fontSize:16,marginBottom:20}}>Our security team is here to help.</p>
          <a href="mailto:security@saguarocontrol.net" style={{display:'inline-block',padding:'13px 32px',background:`linear-gradient(135deg,#E8B84B,#C98A1A)`,borderRadius:14,color:'#2A1B06',fontWeight:800,fontSize:15,textDecoration:'none',boxShadow:'0 6px 30px rgba(232,160,32,0.55)'}}>
            security@saguarocontrol.net
          </a>
          <div style={{marginTop:20,fontSize:13,color:'#C9B79A'}}>
            Also see: <a href="/privacy" style={{color:'#E8B84B',textDecoration:'none'}}>Privacy Policy</a> · <a href="/terms" style={{color:'#E8B84B',textDecoration:'none'}}>Terms of Service</a> · <a href="/sla" style={{color:'#E8B84B',textDecoration:'none'}}>SLA</a>
          </div>
        </div>
      </div>
    </div>
  );
}
