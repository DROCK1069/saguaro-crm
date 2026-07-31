'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import SaguaroDatePicker from '../../../../components/SaguaroDatePicker';
import { PremiumSurface, ModuleHero, SectionCard, goldButtonStyle, ghostButtonStyle } from '@/components/ui/premium';
import { Plus, Buildings, CalendarBlank, UsersThree, FileText, Sparkle } from '@phosphor-icons/react';

const GOLD='#F59E0B',DARK='#1c1c1e',RAISED='#141416',BORDER='rgba(255,255,255,0.12)',DIM='#CBD5E1',TEXT='#FFFFFF';
const INPUT_STYLE = {width:'100%',padding:'10px 12px',background:DARK,border:`1px solid ${BORDER}`,borderRadius:8,color:TEXT,fontSize:13,outline:'none'};
const SELECT_STYLE = {...INPUT_STYLE,cursor:'pointer'};
const FIELD = ({label,children}:{label:string,children:React.ReactNode}) => (
  <div style={{marginBottom:16}}>
    <label style={{display:'block',fontSize:11,fontWeight:700,color:DIM,textTransform:'uppercase' as const,letterSpacing:.5,marginBottom:6}}>{label}</label>
    {children}
  </div>
);

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [type, setType] = useState('residential');
  const [budget, setBudget] = useState('');
  const [startDate, setStartDate] = useState('');
  const [subDate, setSubDate] = useState('');
  const [awardDate, setAwardDate] = useState('');
  const [ntpDate, setNtpDate] = useState('');
  const [finalDate, setFinalDate] = useState('');
  const [stateJurisdiction, setStateJurisdiction] = useState('AZ');
  const [owner, setOwner] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [arch, setArch] = useState('');
  const [archEmail, setArchEmail] = useState('');
  const [description, setDescription] = useState('');
  const [contractType, setContractType] = useState('Lump Sum GMP');
  const [retainage, setRetainage] = useState('10');
  const [prevailingWage, setPrevailingWage] = useState('No');
  const [publicProject, setPublicProject] = useState('No — Private');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !address.trim()) return;
    setSaving(true);
    setError('');
    try {
      const contractAmount = Number(budget.replace(/[^0-9.]/g,''))||0;
      const r = await fetch('/api/projects/create', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          name:name.trim(), address:address.trim(), projectType:type, contractAmount,
          startDate:startDate||null, substantialCompletionDate:subDate||null,
          awardDate:awardDate||null, noticeToProceedDate:ntpDate||null, finalCompletionDate:finalDate||null,
          stateJurisdiction, ownerName:owner, ownerEmail, architectName:arch, architectEmail:archEmail,
          description, contractType, retainagePct:Number(retainage)||10,
          prevailingWage:prevailingWage!=='No', publicProject:!publicProject.includes('Private'),
        })
      });
      const d = await r.json();
      if (d.projectId) {
        // Fire autopilot scan async (non-blocking)
        fetch('/api/autopilot/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: d.projectId }),
        }).catch(() => {});
        router.push(`/app/projects/${d.projectId}/overview`);
      } else {
        setError(d.error || 'Failed to create project');
        setSaving(false);
      }
    } catch (err) {
      setError('Network error — please try again');
      setSaving(false);
    }
  }

  const submitDisabled = saving||!name.trim()||!address.trim();

  return (
    <PremiumSurface maxWidth={1000}>
      <ModuleHero
        eyebrow="New Project"
        eyebrowIcon={<Plus size={13} weight="fill" color={GOLD} />}
        title="Create"
        accent="New Project"
        subtitle="Fill in the details — AI will auto-build the full project structure on first bid award."
      />
      {error&&<div style={{background:'rgba(192,48,48,.1)',border:'1px solid rgba(192,48,48,.3)',borderRadius:10,padding:'12px 16px',marginBottom:20,fontSize:13,color:'#ff7070'}}>{error}</div>}
      <form onSubmit={create}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
          <div>
            <SectionCard title="Project Information" icon={<Buildings size={17} weight="duotone" color={GOLD} />} style={{marginBottom:20}}>
              <FIELD label="Project Name"><input value={name} onChange={e=>setName(e.target.value)} required placeholder="e.g. Riverdale Medical Pavilion" style={INPUT_STYLE}/></FIELD>
              <FIELD label="Project Address"><input value={address} onChange={e=>setAddress(e.target.value)} required placeholder="123 Main St, Phoenix, AZ 85001" style={INPUT_STYLE}/></FIELD>
              <FIELD label="Project Type">
                <select value={type} onChange={e=>setType(e.target.value)} style={SELECT_STYLE}>
                  {['residential','commercial','industrial','addition','remodel','multifamily','healthcare','education','government'].map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                </select>
              </FIELD>
              <FIELD label="Contract Value / Budget"><input value={budget} onChange={e=>setBudget(e.target.value)} placeholder="$1,250,000" style={INPUT_STYLE}/></FIELD>
              <FIELD label="Description"><textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3} placeholder="Brief project description..." style={{...INPUT_STYLE,resize:'vertical' as const}}/></FIELD>
            </SectionCard>
            <SectionCard title="Key Dates" icon={<CalendarBlank size={17} weight="duotone" color={GOLD} />}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                <FIELD label="Award Date"><SaguaroDatePicker value={awardDate} onChange={setAwardDate} style={INPUT_STYLE}/></FIELD>
                <FIELD label="Notice to Proceed"><SaguaroDatePicker value={ntpDate} onChange={setNtpDate} style={INPUT_STYLE}/></FIELD>
                <FIELD label="Start Date"><SaguaroDatePicker value={startDate} onChange={setStartDate} style={INPUT_STYLE}/></FIELD>
                <FIELD label="Substantial Completion"><SaguaroDatePicker value={subDate} onChange={setSubDate} style={INPUT_STYLE}/></FIELD>
                <FIELD label="Final Completion"><SaguaroDatePicker value={finalDate} onChange={setFinalDate} style={INPUT_STYLE}/></FIELD>
                <FIELD label="State Jurisdiction"><input value={stateJurisdiction} onChange={e=>setStateJurisdiction(e.target.value)} placeholder="AZ" style={INPUT_STYLE}/></FIELD>
              </div>
            </SectionCard>
          </div>
          <div>
            <SectionCard title="Project Parties" icon={<UsersThree size={17} weight="duotone" color={GOLD} />} style={{marginBottom:20}}>
              <FIELD label="Owner Name"><input value={owner} onChange={e=>setOwner(e.target.value)} placeholder="Desert Health Partners LLC" style={INPUT_STYLE}/></FIELD>
              <FIELD label="Owner Email"><input value={ownerEmail} onChange={e=>setOwnerEmail(e.target.value)} placeholder="owner@example.com" style={INPUT_STYLE}/></FIELD>
              <FIELD label="Architect / Designer"><input value={arch} onChange={e=>setArch(e.target.value)} placeholder="Sonoran Architecture Group" style={INPUT_STYLE}/></FIELD>
              <FIELD label="Architect Email"><input value={archEmail} onChange={e=>setArchEmail(e.target.value)} placeholder="arch@example.com" style={INPUT_STYLE}/></FIELD>
            </SectionCard>
            <SectionCard title="Contract Settings" icon={<FileText size={17} weight="duotone" color={GOLD} />} style={{marginBottom:20}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                <FIELD label="Contract Type">
                  <select value={contractType} onChange={e=>setContractType(e.target.value)} style={SELECT_STYLE}>
                    {['Lump Sum GMP','Cost Plus Fixed Fee','Cost Plus Percentage','Unit Price','Design-Build'].map(t=><option key={t}>{t}</option>)}
                  </select>
                </FIELD>
                <FIELD label="Retainage %"><input type="number" value={retainage} onChange={e=>setRetainage(e.target.value)} min="0" max="20" style={INPUT_STYLE}/></FIELD>
                <FIELD label="Prevailing Wage">
                  <select value={prevailingWage} onChange={e=>setPrevailingWage(e.target.value)} style={SELECT_STYLE}>
                    <option>No</option><option>Yes — Davis-Bacon</option><option>Yes — State Law</option>
                  </select>
                </FIELD>
                <FIELD label="Public Project">
                  <select value={publicProject} onChange={e=>setPublicProject(e.target.value)} style={SELECT_STYLE}>
                    <option>No — Private</option><option>Yes — Public Agency</option>
                  </select>
                </FIELD>
              </div>
            </SectionCard>
            <div style={{background:'rgba(245, 158, 11,.06)',border:'1px solid rgba(245, 158, 11,.2)',borderRadius:12,padding:'14px 18px',marginBottom:20,fontSize:13,color:DIM,display:'flex',gap:10,alignItems:'flex-start'}}>
              <Sparkle size={16} weight="fill" color={GOLD} style={{flexShrink:0,marginTop:2}}/>
              <div>
                <strong style={{color:TEXT}}>AI Auto-Build on First Award:</strong> When the first bid is awarded, Saguaro will automatically create: 24 schedule tasks, budget by CSI code, sub-packages, safety plan, QC checkpoints, and contact directory.
              </div>
            </div>
          </div>
        </div>
        <div style={{display:'flex',gap:12,marginTop:8}}>
          <button type="submit" disabled={submitDisabled} className="pmBtn" style={{...goldButtonStyle,padding:'13px 32px',fontSize:15,cursor:submitDisabled?'not-allowed':'pointer',opacity:submitDisabled?0.6:1}}>
            {saving?'Creating…':'Create Project'}
          </button>
          <button type="button" onClick={()=>router.back()} className="pmBtn" style={{...ghostButtonStyle,padding:'13px 20px'}}>
            Cancel
          </button>
        </div>
      </form>
    </PremiumSurface>
  );
}
