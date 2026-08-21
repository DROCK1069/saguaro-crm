'use client';
/**
 * Sage — Ask your project docs (keyword-retrieval RAG). Pick a project, ask in
 * plain English, get a cited answer grounded in the project's real records
 * (RFIs, submittals, daily logs, change orders, safety, meetings…). Calls
 * /api/sage/ask-docs which retrieves → re-ranks (lib/rag) → Claude answers.
 */
import { useEffect, useRef, useState } from 'react';
import { humanError } from '@/lib/errors';
import { Sparkle, PaperPlaneRight, FileText, CaretRight, Question } from '@phosphor-icons/react';

const GOLD = '#F59E0B', DARK = '#0a0a0a', RAISED = '#141416', BORDER = 'rgba(255,255,255,0.12)';
const DIM = '#CBD5E1', TEXT = '#FFFFFF', BLUE = '#FBBF24';
const TYPE_LABEL: Record<string, string> = { rfi: 'RFI', change_order: 'Change Order', daily_log: 'Daily Log', inspection: 'Inspection', safety: 'Safety', punch: 'Punch List', submittal: 'Submittal', meeting: 'Meeting', correspondence: 'Correspondence', observation: 'Observation', tm: 'T&M Ticket', field_issue: 'Field Issue' };
const EXAMPLES = ['What tile is specified in the lobby?', 'Any open RFIs about the footing rebar?', 'What did the latest daily log say about weather?', 'Were there any safety incidents this month?', 'What change orders affect the schedule?'];

interface Citation { n: number; source: string; sourceType: string; recordId?: string; route?: string }
interface Turn { q: string; answer: string; citations: Citation[]; searched: number }

export default function AskDocsPage() {
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [projectId, setProjectId] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [err, setErr] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetch('/api/projects/list').then((r) => r.json()).then((d) => { const ps = d.projects || d.data || []; setProjects(ps); if (ps[0]) setProjectId(ps[0].id); }).catch(() => {}); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [turns, busy]);

  const ask = async (question?: string) => {
    const query = (question ?? q).trim();
    if (!query) return;
    if (!projectId) { setErr('Pick a project first'); return; }
    setErr(''); setBusy(true); setQ('');
    try {
      const r = await fetch('/api/sage/ask-docs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, question: query }) });
      const d = await r.json();
      if (d.error) { setErr(d.error); setBusy(false); return; }
      setTurns((t) => [...t, { q: query, answer: d.answer || '', citations: d.citations || [], searched: d.searched || 0 }]);
    } catch (e) { console.error(e); setErr(humanError(e, 'Something went wrong. Please try again.')); }
    setBusy(false);
  };

  const inp: React.CSSProperties = { background: DARK, border: `1px solid ${BORDER}`, borderRadius: 10, color: TEXT, padding: '12px 14px', fontSize: 15, width: '100%' };

  return (
    <div style={{ background: DARK, color: TEXT, minHeight: '100vh', fontFamily: 'system-ui,Segoe UI,sans-serif' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '26px 22px 40px', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(245,158,11,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Sparkle size={22} weight="fill" color={GOLD} /></div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>Ask your project docs</h1>
            <p style={{ color: DIM, margin: '2px 0 0', fontSize: 13.5 }}>Sage answers from this project’s real records — RFIs, submittals, daily logs, change orders, safety — and cites every source.</p>
          </div>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ ...inp, width: 'auto', padding: '9px 11px', fontSize: 14 }}>
            {projects.length === 0 ? <option value="">No projects yet</option> : projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div style={{ flex: 1, marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {turns.length === 0 && !busy && (
            <div style={{ background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18 }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Try asking</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{EXAMPLES.map((ex) => <button key={ex} onClick={() => ask(ex)} style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', background: DARK, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 12px', color: TEXT, cursor: 'pointer', fontSize: 14 }}><Question size={16} color={GOLD} />{ex}</button>)}</div>
            </div>
          )}
          {turns.map((t, i) => (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}><div style={{ background: 'rgba(245,158,11,0.14)', color: TEXT, borderRadius: '14px 14px 4px 14px', padding: '10px 14px', maxWidth: '80%', fontSize: 15 }}>{t.q}</div></div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(245,158,11,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Sparkle size={16} weight="fill" color={GOLD} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ background: RAISED, border: `1px solid ${BORDER}`, borderRadius: '14px 14px 14px 4px', padding: '12px 14px', fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{t.answer}</div>
                  {t.citations.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {t.citations.map((c) => <a key={c.n} href={c.route || '#'} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: DARK, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '6px 10px', color: DIM, textDecoration: 'none', fontSize: 12.5 }}><span style={{ color: GOLD, fontWeight: 800 }}>{c.n}</span><FileText size={13} color={BLUE} /><span style={{ color: TEXT }}>{c.source}</span><span style={{ color: DIM }}>· {TYPE_LABEL[c.sourceType] || c.sourceType}</span><CaretRight size={11} /></a>)}
                    </div>
                  )}
                  <div style={{ color: DIM, fontSize: 11.5, marginTop: 6 }}>Searched {t.searched} matching record{t.searched === 1 ? '' : 's'} in this project.</div>
                </div>
              </div>
            </div>
          ))}
          {busy && <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: DIM, fontSize: 14 }}><div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(245,158,11,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Sparkle size={16} weight="fill" color={GOLD} /></div>Reading the project records…</div>}
          <div ref={endRef} />
        </div>

        {err && <div style={{ color: '#f87171', fontSize: 13, marginTop: 8 }}>{err}</div>}
        <div style={{ position: 'sticky', bottom: 0, background: DARK, paddingTop: 12, marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !busy && ask()} placeholder="Ask anything about this project…" style={inp} />
            <button onClick={() => ask()} disabled={busy || !q.trim()} className="btn-gold" style={{ padding: '0 16px', cursor: busy ? 'default' : 'pointer', opacity: busy || !q.trim() ? 0.6 : 1 }}><PaperPlaneRight size={20} weight="fill" /></button>
          </div>
          <div style={{ color: DIM, fontSize: 11, marginTop: 6, textAlign: 'center' }}>Grounded in your records only — Sage cites its sources and won’t invent answers.</div>
        </div>
      </div>
    </div>
  );
}
