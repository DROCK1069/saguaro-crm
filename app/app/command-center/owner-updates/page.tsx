'use client';
import { useMemo, useState } from 'react';
import { useProjects } from '@/lib/hooks/useProjects';
import { useLongLead, useRisks, useMilestones, useEscalations, emailOwnerUpdate } from '@/lib/hooks/useFranchise';
import { computeHealth } from '@/lib/portfolio-health';
import { computeLongLead, computeRisk, milestoneSlip, num, type Severity } from '@/lib/franchise';
import { C, font, fmtDate, fmtMoneyShort, useFranchiseGate, GateLoading, PageHeader, SevBadge } from '@/components/franchise/kit';

const SEV_WORD: Record<Severity, string> = { green: 'On track', yellow: 'Needs attention', red: 'At risk' };
const weekEnding = () => { const d = new Date(); return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); };

export default function OwnerUpdatesPage() {
  const { ready, loading: gateLoading } = useFranchiseGate();
  const { projects, loading } = useProjects();
  const { items: longLead } = useLongLead();
  const { risks } = useRisks();
  const { milestones } = useMilestones();
  const { escalations } = useEscalations();
  const [copied, setCopied] = useState<string>('');
  const [emailTo, setEmailTo] = useState<Record<string, string>>({});
  const [emailState, setEmailState] = useState<Record<string, 'idle' | 'sending' | 'sent' | 'error'>>({});
  const [emailErr, setEmailErr] = useState<Record<string, string>>({});

  async function sendEmail(id: string, text: string) {
    const to = (emailTo[id] || '').trim();
    if (!to) { setEmailState((s) => ({ ...s, [id]: 'error' })); setEmailErr((s) => ({ ...s, [id]: 'Enter a recipient email.' })); return; }
    setEmailState((s) => ({ ...s, [id]: 'sending' })); setEmailErr((s) => ({ ...s, [id]: '' }));
    try {
      await emailOwnerUpdate(id, to, text);
      setEmailState((s) => ({ ...s, [id]: 'sent' }));
      setTimeout(() => setEmailState((s) => ({ ...s, [id]: 'idle' })), 3000);
    } catch (e: any) {
      setEmailState((s) => ({ ...s, [id]: 'error' })); setEmailErr((s) => ({ ...s, [id]: e?.message || 'Send failed' }));
    }
  }

  const updates = useMemo(() => {
    const wk = weekEnding();
    return ((projects as any[]) || []).map((p) => {
      const h = computeHealth(p);
      const ll = ((longLead as any[]) || []).filter((i) => i.project_id === p.id).map((i) => computeLongLead(i));
      const llRisk = ll.filter((x) => x.severity !== 'green').length;
      const rk = ((risks as any[]) || []).filter((r) => r.project_id === p.id).map((r) => computeRisk(r)).filter((r) => r.isOpen);
      const critRisks = rk.filter((r) => r.severity === 'red').length;
      const ms = ((milestones as any[]) || []).filter((m) => m.project_id === p.id);
      const slipping = ms.map((m) => milestoneSlip(m.baseline_date, m.current_date, m.actual_date, m.float_days)).filter((s) => s.severity !== 'green').length;
      const nowMs = Date.parse(new Date().toISOString().slice(0, 10));
      const upcoming = ms.filter((m) => { const t = Date.parse(String(m.current_date || m.baseline_date || '')); return !isNaN(t) && t >= nowMs && t <= nowMs + 30 * 86400000; })
        .sort((a, b) => Date.parse(String(a.current_date || a.baseline_date)) - Date.parse(String(b.current_date || b.baseline_date)))
        .slice(0, 3);
      const esc = ((escalations as any[]) || []).filter((e) => e.project_id === p.id && !/resolved|closed/i.test(String(e.status || '')));

      const lines: string[] = [];
      lines.push(`OWNER PROGRESS UPDATE — ${p.name || 'Project'}`);
      lines.push(`Week ending ${wk} · Prepared by Saguaro Control Systems`);
      lines.push('');
      lines.push(`STATUS: ${SEV_WORD[h.status as Severity].toUpperCase()}${p.city ? ` · ${p.city}, ${p.state}` : ''}`);
      lines.push(`Overall completion: ${h.percentComplete != null ? Math.round(h.percentComplete) + '%' : '—'}`);
      lines.push(`Budget: ${h.variancePct != null ? (h.variancePct > 1 ? `trending ${h.variancePct.toFixed(0)}% over` : 'within budget') : (h.budget != null ? fmtMoneyShort(h.budget) + ' contract' : '—')}`);
      if (h.finishDate) lines.push(`Target completion: ${fmtDate(h.finishDate)}`);
      lines.push('');
      lines.push('SCHEDULE:');
      lines.push(slipping > 0 ? `  • ${slipping} milestone(s) slipping — recovery in progress.` : `  • Milestones tracking to baseline.`);
      if (upcoming.length) upcoming.forEach((m) => lines.push(`  • Upcoming: ${(m.title || m.name)} (${fmtDate(m.current_date || m.baseline_date)})`));
      lines.push('');
      lines.push('PROCUREMENT:');
      lines.push(llRisk > 0 ? `  • ${llRisk} long-lead item(s) need action to protect the schedule.` : `  • Long-lead procurement on track.`);
      lines.push('');
      lines.push('OPEN ITEMS:');
      lines.push(`  • ${rk.length} open risk(s)${critRisks ? ` (${critRisks} critical)` : ''}, ${esc.length} escalation(s).`);
      lines.push('');
      lines.push('Questions? Reply to this update or raise it at the weekly OAC meeting.');

      return { p, h, text: lines.join('\n'), llRisk, critRisks, openRisks: rk.length, slipping, esc: esc.length, upcoming };
    }).sort((a, b) => a.h.score - b.h.score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, longLead, risks, milestones, escalations]);

  async function copy(id: string, text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(''), 1800); } catch { /* noop */ }
  }

  if (gateLoading) return <GateLoading />;
  if (!ready) return null;

  return (
    <div style={{ padding: '28px 24px 60px', maxWidth: 1000, margin: '0 auto', fontFamily: font, color: C.text }}>
      <PageHeader title="Weekly Owner Updates" subtitle="An owner-ready progress update auto-drafted for every site — review, copy, and send. One voice, every location." />
      {loading ? (
        <div style={{ color: C.dim, padding: 40, textAlign: 'center' }}>Loading…</div>
      ) : updates.length === 0 ? (
        <div style={{ color: C.dim, padding: 48, textAlign: 'center', background: C.card, border: `1px solid ${C.border}`, borderRadius: 14 }}>No active sites yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {updates.map(({ p, h, text, llRisk, openRisks, critRisks, slipping, esc, upcoming }) => (
            <div key={p.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `4px solid ${h.status === 'red' ? C.red : h.status === 'yellow' ? C.yellow : C.green}`, borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 900 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>Week ending {weekEnding()} · {[p.city, p.state].filter(Boolean).join(', ') || '—'}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <SevBadge sev={h.status as Severity} label={SEV_WORD[h.status as Severity]} />
                  <button onClick={() => copy(p.id, text)} style={{ padding: '7px 14px', borderRadius: 9, border: `1px solid ${C.border}`, background: copied === p.id ? C.green : '#16243A', color: copied === p.id ? '#fff' : C.text, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{copied === p.id ? '✓ Copied' : 'Copy update'}</button>
                  <input
                    type="email"
                    value={emailTo[p.id] || ''}
                    onChange={(e) => setEmailTo((s) => ({ ...s, [p.id]: e.target.value }))}
                    placeholder="owner@email.com"
                    style={{ padding: '7px 10px', borderRadius: 9, border: `1px solid ${emailState[p.id] === 'error' ? C.red : C.border}`, fontSize: 13, width: 170, outline: 'none', fontFamily: font }}
                  />
                  <button
                    onClick={() => sendEmail(p.id, text)}
                    disabled={emailState[p.id] === 'sending'}
                    style={{ padding: '7px 14px', borderRadius: 9, border: 'none', background: emailState[p.id] === 'sent' ? C.green : emailState[p.id] === 'error' ? C.red : C.gold, color: '#fff', fontWeight: 700, fontSize: 13, cursor: emailState[p.id] === 'sending' ? 'default' : 'pointer', opacity: emailState[p.id] === 'sending' ? 0.7 : 1 }}
                  >{emailState[p.id] === 'sending' ? 'Sending…' : emailState[p.id] === 'sent' ? '✓ Sent' : emailState[p.id] === 'error' ? 'Retry' : 'Email to owner'}</button>
                </div>
              </div>
              {emailState[p.id] === 'error' && emailErr[p.id] && (
                <div style={{ marginTop: 8, fontSize: 12, color: C.red, textAlign: 'right' }}>{emailErr[p.id]}</div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 10, marginTop: 14 }}>
                <Stat label="Complete" value={h.percentComplete != null ? `${Math.round(h.percentComplete)}%` : '—'} />
                <Stat label="Budget" value={h.variancePct != null ? `${h.variancePct > 0 ? '+' : ''}${h.variancePct.toFixed(0)}%` : '—'} color={h.variancePct != null && h.variancePct > 5 ? C.red : h.variancePct != null && h.variancePct > 1 ? C.yellow : C.text} />
                <Stat label="Milestones slipping" value={slipping} color={slipping ? C.yellow : C.text} />
                <Stat label="Long-lead ⚠" value={llRisk} color={llRisk ? C.red : C.text} />
                <Stat label="Open risks" value={`${openRisks}${critRisks ? ` (${critRisks}!)` : ''}`} color={critRisks ? C.red : C.text} />
                <Stat label="Escalations" value={esc} color={esc ? C.red : C.text} />
              </div>
              {upcoming.length > 0 && (
                <div style={{ marginTop: 12, fontSize: 13, color: C.dim }}>
                  <b style={{ color: C.text }}>Next up:</b> {upcoming.map((m: any) => `${m.title || m.name} (${fmtDate(m.current_date || m.baseline_date)})`).join(' · ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div style={{ background: '#16243A', borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, color: C.faint }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: color || C.text, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}
