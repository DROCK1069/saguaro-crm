'use client';
import React from 'react';
const GOLD='#C8881C',EYEBROW='#B07A12',BORDER='rgba(176,122,18,0.16)',DIM='#6B5B43',TEXT='#2A1B06',BODY='#3A2A12';
const PAGE_BG='linear-gradient(180deg, #FCF7EE 0%, #F8EFDF 40%, #FBF2E3 70%, #F7ECDA 100%)';
export default function TermsPage(){
  return (
    <div style={{minHeight:'100vh',background:PAGE_BG,color:TEXT,fontFamily:'system-ui,sans-serif'}}>
      <nav style={{position:'fixed' as const,top:0,left:0,right:0,zIndex:100,height:56,background:'rgba(255,251,242,0.85)',borderBottom:`1px solid #F0E7D6`,display:'flex',alignItems:'center',padding:'0 32px',backdropFilter:'blur(12px)'}}>
        <a href="/" style={{display:'flex',alignItems:'center',gap:8,textDecoration:'none'}}><span style={{fontSize:22}}>🌵</span><span style={{fontWeight:800,fontSize:16,letterSpacing:1,color:GOLD}}>SAGUARO</span></a>
      </nav>
      <div style={{background:'linear-gradient(160deg, #FFFBF2, #FDF3E2, #FBEAD2)',backgroundImage:'radial-gradient(circle at 80% 0%, rgba(216,154,30,0.12), transparent 60%), linear-gradient(160deg, #FFFBF2, #FDF3E2, #FBEAD2)'}}>
        <div style={{maxWidth:780,margin:'0 auto',padding:'88px 32px 40px'}}>
          <div style={{fontSize:12,fontWeight:700,color:EYEBROW,textTransform:'uppercase',letterSpacing:2,marginBottom:12}}>Legal</div>
          <h1 style={{fontSize:36,fontWeight:900,marginBottom:8,color:TEXT}}>Terms of Service</h1>
          <p style={{color:DIM,marginBottom:0}}>Last updated: March 10, 2026</p>
        </div>
      </div>
      <div style={{maxWidth:780,margin:'0 auto',padding:'40px 32px 60px'}}>
        {[
          {h:'1. Acceptance of Terms',b:'By accessing or using Saguaro CRM ("Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service. These terms apply to all users, including free trial users and paid subscribers.'},
          {h:'2. Service Description',b:'Saguaro CRM is a construction project management and document automation platform. We provide tools for bid management, pay applications, lien waiver generation, document automation, and related construction workflow features.'},
          {h:'3. Account Registration',b:'You must provide accurate and complete information when creating an account. You are responsible for maintaining the security of your credentials. You are responsible for all activity under your account. Notify us immediately of any unauthorized access.'},
          {h:'4. Subscription and Payment',b:'Paid subscriptions are billed monthly or annually in advance. All fees are in USD. We may change pricing with 30 days notice. No refunds for partial periods. Annual subscriptions may be canceled at renewal.'},
          {h:'5. Free Trial',b:'New accounts receive a 30-day free trial. No credit card is required for the trial. At trial end, you must subscribe to continue access. We reserve the right to modify or end free trials.'},
          {h:'6. Your Data',b:'You retain ownership of all data you input into the Service. We do not sell your data. We process your data as described in our Privacy Policy. We maintain backups but are not liable for data loss.'},
          {h:'7. Acceptable Use',b:'You may not use the Service for illegal purposes, to harass others, to transmit malware, or to attempt unauthorized access to our systems. We may terminate accounts that violate these restrictions.'},
          {h:'8. Intellectual Property',b:'Saguaro CRM, its features, and underlying technology are owned by TNT Cyber Solutions dba Saguaro. Document templates generated using our Service are yours to use. You may not reverse engineer or resell the Service without our written consent.'},
          {h:'9. Disclaimers',b:'The Service is provided "as is." We are not lawyers or accountants. Document templates are starting points and should be reviewed by qualified professionals for your specific jurisdiction and situation. We are not liable for legal or financial outcomes.'},
          {h:'10. Limitation of Liability',b:'To the maximum extent permitted by law, our total liability to you shall not exceed the amount you paid us in the 12 months before the claim. We are not liable for indirect, incidental, or consequential damages.'},
          {h:'11. Governing Law',b:'These terms are governed by the laws of the State of Arizona, USA. Disputes shall be resolved in Maricopa County, Arizona.'},
          {h:'12. Contact',b:'For legal questions: legal@saguarocontrol.net · TNT Cyber Solutions · Scottsdale, AZ 85251'},
        ].map((s,i)=>(
          <div key={s.h} style={{marginBottom:28,paddingTop:i===0?0:28,borderTop:i===0?'none':`1px solid ${BORDER}`}}>
            <h2 style={{fontSize:18,fontWeight:700,marginBottom:8,color:TEXT}}>{s.h}</h2>
            <p style={{color:BODY,lineHeight:1.8,margin:0}}>{s.b}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
