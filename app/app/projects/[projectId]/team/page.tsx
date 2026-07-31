'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useToast } from '@/components/Toast';
import { UsersThree, UserPlus, HardHat } from '@phosphor-icons/react';
import { PremiumSurface, ModuleHero, SectionCard, StatCard, PremiumEmpty, goldButtonStyle, ghostButtonStyle } from '@/components/ui/premium';

const GOLD='#F59E0B',DARK='#0a0a0a',RAISED='#141416',BORDER='rgba(255,255,255,0.12)',DIM='#CBD5E1',TEXT='#FFFFFF',GREEN='#1a8a4a',RED='#c03030',BLUE='#1a5fa8';
const fmt = (n:number) => '$'+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
function Badge({label,color='#CBD5E1',bg='rgba(148,163,184,.12)'}:{label:string,color?:string,bg?:string}){
  return <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:4,background:bg,color,textTransform:'uppercase' as const,letterSpacing:.3}}>{label}</span>;
}

export default function TeamPage(){
  const params = useParams();
  const projectId = params['projectId'] as string;
  const { showToast } = useToast();
  const [sendingPortal, setSendingPortal] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [members, setMembers] = useState<{name:string,role:string,email:string,access:string,last:string}[]>([]);
  const [subs, setSubs] = useState<{name:string,role:string,email:string,access:string,last:string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('Member');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        const r = await fetch(`/api/projects/${projectId}`);
        const d = await r.json();
        // The API returns the internal roster under `team` (from project_team),
        // not `members`. Map each row to the shape this table renders.
        setMembers((d.team ?? []).map((t: any) => ({
          name: t.name || t.email || 'Team Member',
          role: t.role || 'Member',
          email: t.email || '',
          access: t.role || 'Member',
          last: 'Active',
        })));
        setSubs((d.subs ?? []).map((s: any) => ({ name: s.name, role: 'Subcontractor', email: s.primary_email || s.email || '', access: 'Sub Portal', last: 'Active' })));
      } catch {
        setMembers([]);
        setSubs([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  async function handleInvite() {
    if (!inviteEmail.trim()) { setInviteMsg('Email is required.'); return; }
    setInviting(true);
    setInviteMsg('');
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, email: inviteEmail.trim(), name: inviteName.trim(), role: inviteRole }),
      });
      const json = await res.json();
      if (!res.ok) { setInviteMsg(json.error || 'Invite failed.'); }
      else {
        setInviteMsg('Invitation sent!');
        setInviteEmail(''); setInviteName(''); setInviteRole('Member');
        setTimeout(() => { setShowInvite(false); setInviteMsg(''); }, 1500);
      }
    } catch { setInviteMsg('Network error. Please try again.'); }
    finally { setInviting(false); }
  }

  async function handleSendPortalLink(sub: { name: string; email: string }) {
    if (!sub.email) { showToast('No contact email on file for this subcontractor.', 'error'); return; }
    setSendingPortal(sub.name);
    try {
      const res = await fetch('/api/sub-portal/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, name: sub.name, company: sub.name, email: sub.email, role: 'Subcontractor' }),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error || 'Failed to grant portal access.', 'error'); }
      else {
        // The invite endpoint grants portal access; it does not email the sub.
        // If a token came back, hand the GC a real, copyable portal link.
        const token = json?.data?.token;
        if (token) {
          const link = `${window.location.origin}/portals/sub/${token}`;
          try { await navigator.clipboard.writeText(link); showToast(`Portal link copied for ${sub.email}`, 'success'); }
          catch { showToast(`Portal access granted. Link: ${link}`, 'success'); }
        } else {
          showToast(`Portal access granted for ${sub.email}`, 'success');
        }
      }
    } catch { showToast('Network error. Please try again.', 'error'); }
    finally { setSendingPortal(null); }
  }

  const inputStyle = {width:'100%',padding:'8px 12px',background:'#1c1c1e',border:`1px solid ${BORDER}`,borderRadius:7,color:TEXT,fontSize:13,outline:'none',boxSizing:'border-box' as const};

  return <PremiumSurface maxWidth={1600}>
    <ModuleHero
      eyebrow="PROJECT TEAM"
      eyebrowIcon={<UsersThree size={13} weight="fill" color={GOLD} />}
      title="Project"
      accent="Team"
      subtitle="Manage project team members and access"
      actions={<button onClick={()=>setShowInvite(!showInvite)} style={goldButtonStyle} className="pmBtn"><UserPlus size={15} weight="bold" /> Invite Member</button>}
    />

    {!loading && (
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12,marginBottom:24}}>
        <StatCard icon={<UsersThree size={19} weight="duotone" color={GOLD} />} label="Team Members" value={String(members.length)} accent={GOLD} sub={members.length===1?'1 with access':`${members.length} with access`} />
        <StatCard icon={<HardHat size={19} weight="duotone" color={BLUE} />} label="Subcontractors" value={String(subs.length)} accent={subs.length?BLUE:undefined} sub="portal access" />
      </div>
    )}

    {showInvite && <div style={{marginBottom:24}}>
      <SectionCard title="Invite Team Member" icon={<UserPlus size={17} weight="duotone" color={GOLD} />}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:14,marginBottom:16}}>
          <div>
            <label style={{display:'block',fontSize:11,fontWeight:700,color:DIM,textTransform:'uppercase' as const,letterSpacing:.5,marginBottom:5}}>Email</label>
            <input type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="email@company.com" style={inputStyle}/>
          </div>
          <div>
            <label style={{display:'block',fontSize:11,fontWeight:700,color:DIM,textTransform:'uppercase' as const,letterSpacing:.5,marginBottom:5}}>Name</label>
            <input type="text" value={inviteName} onChange={e=>setInviteName(e.target.value)} placeholder="Full name" style={inputStyle}/>
          </div>
          <div>
            <label style={{display:'block',fontSize:11,fontWeight:700,color:DIM,textTransform:'uppercase' as const,letterSpacing:.5,marginBottom:5}}>Role</label>
            <select value={inviteRole} onChange={e=>setInviteRole(e.target.value)} style={{...inputStyle,cursor:'pointer'}}>
              {['Admin','Manager','Member','Guest','Client','Sub'].map(r=><option key={r}>{r}</option>)}
            </select>
          </div>
        </div>
        {inviteMsg&&<div style={{fontSize:13,marginBottom:12,color:inviteMsg==='Invitation sent!'?GREEN:RED}}>{inviteMsg}</div>}
        <div style={{display:'flex',gap:10}}>
          <button onClick={handleInvite} disabled={inviting} style={{...goldButtonStyle,opacity:inviting?.6:1}} className="pmBtn">{inviting?'Sending...':'Send Invitation'}</button>
          <button onClick={()=>{setShowInvite(false);setInviteMsg('');}} style={ghostButtonStyle} className="pmBtn">Cancel</button>
        </div>
      </SectionCard>
    </div>}

    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      <SectionCard title="Internal Team" icon={<UsersThree size={17} weight="duotone" color={GOLD} />}>
        {loading ? (
          <div style={{padding:'28px 12px',textAlign:'center',color:DIM,fontSize:13}}>Loading team members…</div>
        ) : members.length === 0 ? (
          <PremiumEmpty
            icon={<UsersThree size={30} weight="duotone" color={GOLD} />}
            title="No team members yet"
            description="Invite someone to get started collaborating on this project."
            action={<button onClick={()=>setShowInvite(true)} style={goldButtonStyle} className="pmBtn"><UserPlus size={15} weight="bold" /> Invite Member</button>}
            compact
          />
        ) : (
          <div style={{overflowX:'auto',WebkitOverflowScrolling:'touch' as const}}>
            <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:13}}>
              <thead><tr>
                {['Name','Role','Email','Access Level','Last Active'].map(h=><th key={h} style={{padding:'8px 12px',textAlign:'left' as const,fontSize:11,fontWeight:700,textTransform:'uppercase' as const,color:DIM,borderBottom:`1px solid ${BORDER}`}}>{h}</th>)}
              </tr></thead>
              <tbody>{members.map(m=><tr key={m.name} style={{borderBottom:`1px solid rgba(255,255,255,0.08)`}}>
                <td style={{padding:'11px 12px'}}><div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:32,height:32,borderRadius:'50%',background:`linear-gradient(135deg,${GOLD},#B85C2A)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:800,color:'#1C1C1E'}}>{m.name[0]}</div><span style={{color:TEXT,fontWeight:600}}>{m.name}</span></div></td>
                <td style={{padding:'11px 12px',color:DIM}}>{m.role}</td>
                <td style={{padding:'11px 12px',color:DIM}}>{m.email}</td>
                <td style={{padding:'11px 12px'}}><Badge label={m.access} color={m.access==='Admin'?GOLD:m.access==='Manager'?'#4a9de8':'#CBD5E1'} bg={m.access==='Admin'?'rgba(245, 158, 11,.12)':m.access==='Manager'?'rgba(26,95,168,.12)':'rgba(148,163,184,.08)'}/></td>
                <td style={{padding:'11px 12px',color:'#3dd68c',fontSize:12}}>{m.last}</td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Subcontractors (Portal Access)" icon={<HardHat size={17} weight="duotone" color={GOLD} />}>
        {subs.length === 0 ? (
          <PremiumEmpty
            icon={<HardHat size={30} weight="duotone" color={GOLD} />}
            title="No subcontractors yet"
            description="Subcontractors added to this project will appear here with portal access."
            compact
          />
        ) : (
          <div style={{overflowX:'auto',WebkitOverflowScrolling:'touch' as const}}>
            <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:13}}>
              <thead><tr>
                {['Company','Contact Email','Portal Access','Actions'].map(h=><th key={h} style={{padding:'8px 12px',textAlign:'left' as const,fontSize:11,fontWeight:700,textTransform:'uppercase' as const,color:DIM,borderBottom:`1px solid ${BORDER}`}}>{h}</th>)}
              </tr></thead>
              <tbody>{subs.map(s=><tr key={s.name} style={{borderBottom:`1px solid rgba(255,255,255,0.08)`}}>
                <td style={{padding:'11px 12px',color:TEXT,fontWeight:600}}>{s.name}</td>
                <td style={{padding:'11px 12px',color:DIM}}>{s.email}</td>
                <td style={{padding:'11px 12px'}}><Badge label="Sub Portal" color='#a78bfa' bg='rgba(167,139,250,.12)'/></td>
                <td style={{padding:'11px 12px',display:'flex',gap:6}}>
                  <button onClick={()=>handleSendPortalLink(s)} disabled={sendingPortal===s.name} style={{background:'none',border:`1px solid ${BORDER}`,borderRadius:5,color:GOLD,fontSize:11,padding:'3px 8px',cursor:sendingPortal===s.name?'default':'pointer',opacity:sendingPortal===s.name?.6:1}}>{sendingPortal===s.name?'Working...':'Copy Portal Link'}</button>
                </td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  </PremiumSurface>;
}
