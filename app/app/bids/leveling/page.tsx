'use client';
/**
 * Bid Leveling (web) — side-by-side sub-quote tabulation with budget compare,
 * award recommendation, CSI scope templates, a color-coded scope matrix, stacked
 * leveled-total bars, normalization adjustments, and a branded bid-tab PDF.
 * All math from the shared deterministic lib/bidleveling engine (same as iOS).
 */
import { useMemo, useState } from 'react';
import { humanError } from '@/lib/errors';
import { levelBids, usd, TRADE_TEMPLATES, type ScopeLine, type Bidder, type ScopeStatus } from '@/lib/bidleveling';
import { Plus, Trash, Sparkle, Trophy, Warning, Info, FilePdf, Target, CaretDown, CaretRight } from '@phosphor-icons/react';

const GOLD = '#F59E0B', DARK = '#0a0a0a', RAISED = '#141416', BORDER = 'rgba(255,255,255,0.12)';
const DIM = '#CBD5E1', TEXT = '#FFFFFF', GREEN = '#3dd68c', RED = '#ef4444', HEAD = '#1c1c1e', BLUE = '#FBBF24';
const uid = () => Math.random().toString(36).slice(2, 9);
const toCents = (s: string) => Math.round((parseFloat(String(s).replace(/[^0-9.]/g, '')) || 0) * 100);
const STC: Record<ScopeStatus, string> = { included: GREEN, excluded: RED, clarify: GOLD, alternate: BLUE };
const STL: Record<ScopeStatus, string> = { included: 'Incl', excluded: 'Excl', clarify: 'Clar', alternate: 'Alt' };
const nextStatus = (s: ScopeStatus): ScopeStatus => ({ included: 'excluded', excluded: 'clarify', clarify: 'alternate', alternate: 'included' } as const)[s];

export default function BidLevelingPage() {
  const [scopeLines, setScopeLines] = useState<ScopeLine[]>([]);
  const [bidders, setBidders] = useState<Bidder[]>([]);
  const [selAlts, setSelAlts] = useState<string[]>([]);
  const [budget, setBudget] = useState('');
  const [scopeInput, setScopeInput] = useState('');
  const [tplOpen, setTplOpen] = useState(false);
  const [adjOpen, setAdjOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const result = useMemo(() => levelBids(scopeLines, bidders, { selectedAlternateKeys: selAlts, budgetCents: toCents(budget) || undefined }), [scopeLines, bidders, selAlts, budget]);
  const altKeys = useMemo(() => Array.from(new Set(bidders.flatMap((b) => (b.alternates || []).map((a) => a.key)))), [bidders]);
  const altMeta = useMemo(() => { const m: Record<string, string> = {}; bidders.forEach((b) => (b.alternates || []).forEach((a) => { m[a.key] = a.description; })); return m; }, [bidders]);
  const maxTotal = Math.max(1, ...result.bidders.map((b) => b.leveledTotalCents), toCents(budget) || 0);
  const rec = result.recommendation.bidderId ? result.bidders.find((b) => b.id === result.recommendation.bidderId) : null;

  const addScope = () => { const d = scopeInput.trim(); if (!d) return; setScopeLines((x) => [...x, { id: uid(), description: d, required: true }]); setScopeInput(''); };
  const seedTemplate = (t: typeof TRADE_TEMPLATES[number]) => { setScopeLines(t.lines.map((d, i) => ({ id: uid(), csi: t.csi, description: d, required: i < 6 }))); setBidders((bs) => bs.map((b) => ({ ...b, scope: [] }))); setTplOpen(false); setMsg(`Loaded ${t.trade} scope (${t.lines.length} lines)`); };
  const addBidder = () => setBidders((x) => [...x, { id: uid(), name: `Bidder ${x.length + 1}`, baseBidCents: 0, scope: scopeLines.map((s) => ({ scopeLineId: s.id, status: 'included' as ScopeStatus })), alternates: [] }]);
  const patchBidder = (id: string, p: Partial<Bidder>) => setBidders((x) => x.map((b) => b.id === id ? { ...b, ...p } : b));
  const patchAdj = (id: string, k: 'bondCents' | 'taxCents' | 'carryCents', v: string) => setBidders((x) => x.map((b) => b.id === id ? { ...b, adjustments: { ...(b.adjustments || {}), [k]: toCents(v) } } : b));
  const cycleCell = (bid: string, lineId: string) => setBidders((x) => x.map((b) => {
    if (b.id !== bid) return b;
    const cur = b.scope.find((s) => s.scopeLineId === lineId);
    const scope = cur ? b.scope.map((s) => s.scopeLineId === lineId ? { ...s, status: nextStatus(s.status) } : s) : [...b.scope, { scopeLineId: lineId, status: 'excluded' as ScopeStatus }];
    return { ...b, scope };
  }));

  const [aiText, setAiText] = useState(''); const [aiBusy, setAiBusy] = useState(false);
  const extract = async () => {
    if (!scopeLines.length) { setMsg('Define or load a scope checklist first'); return; }
    if (!aiText.trim()) { setMsg('Paste a bid'); return; }
    setAiBusy(true); setMsg('Reading bid…');
    try {
      const r = await fetch('/api/bids/level-extract', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: aiText, scopeLines: scopeLines.map((s) => ({ id: s.id, description: s.description })) }) });
      const d = await r.json();
      if (d.error) { setMsg(`AI: ${d.error}`); setAiBusy(false); return; }
      setBidders((x) => [...x, { id: uid(), name: d.bidderName || 'Subcontractor', baseBidCents: d.baseBidCents || 0, scope: d.scope || [], alternates: d.alternates || [] }]);
      setAiText(''); setMsg(`Added ${d.bidderName} — review the scope grid`);
    } catch (e) { console.error(e); setMsg(humanError(e, 'Something went wrong. Please try again.')); }
    setAiBusy(false);
  };

  const exportPdf = () => {
    const w = window.open('', '_blank'); if (!w) return;
    const cell = (t: string, c = '#111') => `<td style="padding:6px 9px;border:1px solid #ccc;text-align:right;color:${c}">${t}</td>`;
    const head = `<th style="padding:6px 9px;border:1px solid #ccc;background:#141416;color:#fff">${''}</th>` + result.bidders.map((b) => `<th style="padding:6px 9px;border:1px solid #ccc;background:${b.id === rec?.id ? '#1a8a4a' : '#141416'};color:#fff">${b.name}${b.id === rec?.id ? ' ★' : ''}</th>`).join('');
    const row = (label: string, fn: (b: typeof result.bidders[number]) => string) => `<tr><td style="padding:6px 9px;border:1px solid #ccc;font-weight:600">${label}</td>${result.bidders.map((b) => cell(fn(b))).join('')}</tr>`;
    const matrix = scopeLines.map((l) => `<tr><td style="padding:5px 9px;border:1px solid #ccc">${l.description}</td>${result.bidders.map((b) => { const it = b.lines.find((s) => s.scopeLineId === l.id); const st: ScopeStatus = (it && it.status !== 'missing') ? it.status : 'excluded'; const col = st === 'included' ? '#1a8a4a' : st === 'excluded' ? '#c03030' : st === 'clarify' ? '#b8860b' : '#D97706'; return `<td style="padding:5px 9px;border:1px solid #ccc;text-align:center;color:${col};font-weight:600">${STL[st]}${it?.valueCents ? ' · ' + usd(it.valueCents) : ''}</td>`; }).join('')}</tr>`).join('');
    w.document.write(`<html><head><title>Bid Tabulation</title></head><body style="font-family:Arial;padding:24px;color:#111">
      <h2 style="margin:0">Bid Tabulation</h2><div style="color:#555;font-size:12px;margin-bottom:14px">Leveled — allowances fill scope gaps for apples-to-apples comparison${result.budgetCents ? ` · Budget ${usd(result.budgetCents)}` : ''}</div>
      <table style="border-collapse:collapse;font-size:12px;width:100%"><thead><tr>${head}</tr></thead><tbody>
      ${row('Base bid', (b) => usd(b.baseBidCents))}${row('+ Gap allowances', (b) => b.gapAllowanceCents ? '+' + usd(b.gapAllowanceCents) : '—')}${row('+ Alternates', (b) => b.alternatesAdjCents ? usd(b.alternatesAdjCents) : '—')}${row('+ Adjustments', (b) => b.adjustmentsCents ? '+' + usd(b.adjustmentsCents) : '—')}
      <tr style="font-weight:800"><td style="padding:6px 9px;border:1px solid #ccc">LEVELED TOTAL</td>${result.bidders.map((b) => cell(usd(b.leveledTotalCents), b.isLow ? '#1a8a4a' : '#111')).join('')}</tr>
      ${result.budgetCents ? row('vs Budget', (b) => (b.vsBudgetCents! > 0 ? '+' : '') + usd(b.vsBudgetCents!) + ` (${b.vsBudgetPct}%)`) : ''}
      </tbody></table>
      <h3 style="margin:18px 0 6px">Scope Coverage</h3>
      <table style="border-collapse:collapse;font-size:11px;width:100%"><thead><tr>${head}</tr></thead><tbody>${matrix}</tbody></table>
      ${rec ? `<div style="margin-top:16px;padding:10px 12px;border-left:3px solid #1a8a4a;background:#f0faf4"><b>Recommendation:</b> ${result.recommendation.rationale}</div>` : ''}
      </body></html>`);
    w.document.close(); w.focus(); w.print();
  };

  const inp: React.CSSProperties = { background: DARK, border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, padding: '9px 11px', fontSize: 14 };
  const btn: React.CSSProperties = { background: GOLD, color: DARK, fontWeight: 700, border: 'none', borderRadius: 8, padding: '9px 16px', cursor: 'pointer', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 };
  const ghost: React.CSSProperties = { background: 'transparent', color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 };

  return (
    <div style={{ background: DARK, color: TEXT, minHeight: '100vh', fontFamily: 'system-ui,Segoe UI,sans-serif' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '26px 22px 90px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: GOLD, fontWeight: 700 }}>Bid tabulation · deterministic</div>
            <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', margin: '6px 0 4px' }}>Bid Leveling</h1>
            <p style={{ color: DIM, margin: 0, fontSize: 14 }}>Normalize every sub bid to the same scope, compare against your budget, and award on price + coverage — not just the lowest number.</p>
          </div>
          {bidders.length > 0 && <button onClick={exportPdf} style={ghost}><FilePdf size={16} />Export bid tab</button>}
        </div>

        {/* toolbar: budget + template */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: DIM, fontSize: 13 }}><Target size={16} color={GOLD} />Your budget $<input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="optional" style={{ ...inp, width: 140 }} /></label>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setTplOpen((o) => !o)} style={ghost}>CSI scope template <CaretDown size={13} /></button>
            {tplOpen && <div style={{ position: 'absolute', zIndex: 20, top: 42, left: 0, background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 6, width: 240, maxHeight: 320, overflowY: 'auto' }}>{TRADE_TEMPLATES.map((t) => <button key={t.trade} onClick={() => seedTemplate(t)} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: TEXT, padding: '8px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>{t.trade}<span style={{ color: DIM, fontSize: 11 }}> · {t.csi}</span></button>)}</div>}
          </div>
          {msg && <span style={{ fontSize: 13, color: DIM }}>{msg}</span>}
        </div>

        {/* recommendation */}
        {rec && (
          <div style={{ background: 'linear-gradient(180deg,rgba(61,214,140,0.12),rgba(61,214,140,0.03))', border: `1px solid rgba(61,214,140,0.4)`, borderRadius: 14, padding: 16, marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}><Trophy size={18} weight="fill" color={GREEN} /><span style={{ fontWeight: 800, color: GREEN }}>Recommend: {rec.name}</span><span style={{ color: DIM, fontSize: 13 }}>· {usd(rec.leveledTotalCents)} leveled · {rec.requiredCoveragePct}% scope coverage</span></div>
            <div style={{ color: DIM, fontSize: 13.5, lineHeight: 1.5 }}>{result.recommendation.rationale}</div>
          </div>
        )}

        {/* leveled totals + stacked bars */}
        {bidders.length > 0 && scopeLines.length > 0 && (
          <div style={{ background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18, marginTop: 14, overflowX: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: DIM, fontWeight: 700, letterSpacing: 0.8 }}>LEVELED TOTALS</div>
              <span style={{ color: DIM, fontSize: 12 }}>spread {usd(result.spreadCents)}{result.budgetCents ? ` · budget ${usd(result.budgetCents)}` : ''}</span>
            </div>
            {/* stacked bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
              {result.bidders.map((b) => { const seg = (v: number, c: string) => v > 0 ? <div style={{ width: `${(v / maxTotal) * 100}%`, background: c }} /> : null; return (
                <div key={b.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3 }}><span style={{ color: b.isLow ? GREEN : TEXT, fontWeight: 700 }}>{b.isLow && <Trophy size={12} weight="fill" color={GREEN} style={{ verticalAlign: 'middle', marginRight: 4 }} />}{b.name}</span><span style={{ color: b.vsBudgetPct != null && b.vsBudgetPct > 0 ? RED : DIM }}>{usd(b.leveledTotalCents)}{b.vsBudgetPct != null ? ` · ${b.vsBudgetPct > 0 ? '+' : ''}${b.vsBudgetPct}% vs budget` : ''}</span></div>
                  <div style={{ position: 'relative', height: 16, background: DARK, borderRadius: 4, display: 'flex', overflow: 'hidden' }}>
                    {seg(b.baseBidCents, '#334155')}{seg(b.gapAllowanceCents, GOLD)}{seg(Math.max(0, b.alternatesAdjCents), BLUE)}{seg(b.adjustmentsCents, '#7c5cff')}
                    {result.budgetCents ? <div style={{ position: 'absolute', top: -2, bottom: -2, left: `${(result.budgetCents / maxTotal) * 100}%`, width: 2, background: '#fff' }} title="budget" /> : null}
                  </div>
                </div>
              ); })}
              <div style={{ display: 'flex', gap: 14, fontSize: 11, color: DIM, flexWrap: 'wrap' }}>{[['#334155', 'Base'], [GOLD, 'Gap allowance'], [BLUE, 'Alternates'], ['#7c5cff', 'Adjustments'], ['#fff', 'Your budget']].map(([c, l]) => <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, background: c, borderRadius: 2, display: 'inline-block' }} />{l}</span>)}</div>
            </div>
            {/* totals table */}
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13, minWidth: 520 }}>
              <thead><tr style={{ background: HEAD }}><th style={{ textAlign: 'left', padding: '8px 10px', color: DIM, position: 'sticky', left: 0, background: HEAD }}>Line</th>{result.bidders.map((b) => <th key={b.id} style={{ padding: '8px 10px', color: b.isLow ? GREEN : TEXT, fontWeight: 700, whiteSpace: 'nowrap' }}>{b.name}</th>)}</tr></thead>
              <tbody>
                <tr><td style={cellL}>Base bid</td>{result.bidders.map((b) => <td key={b.id} style={cell}>{usd(b.baseBidCents)}</td>)}</tr>
                <tr><td style={cellL}>+ Gap allowances</td>{result.bidders.map((b) => <td key={b.id} style={{ ...cell, color: b.gapAllowanceCents ? GOLD : DIM }}>{b.gapAllowanceCents ? '+' + usd(b.gapAllowanceCents) : '—'}</td>)}</tr>
                <tr><td style={cellL}>+ Alternates</td>{result.bidders.map((b) => <td key={b.id} style={{ ...cell, color: b.alternatesAdjCents ? BLUE : DIM }}>{b.alternatesAdjCents ? (b.alternatesAdjCents > 0 ? '+' : '') + usd(b.alternatesAdjCents) : '—'}</td>)}</tr>
                <tr><td style={cellL}>+ Adjustments</td>{result.bidders.map((b) => <td key={b.id} style={{ ...cell, color: b.adjustmentsCents ? '#a78bfa' : DIM }}>{b.adjustmentsCents ? '+' + usd(b.adjustmentsCents) : '—'}</td>)}</tr>
                <tr style={{ borderTop: `2px solid ${BORDER}` }}><td style={{ ...cellL, fontWeight: 800 }}>Leveled total</td>{result.bidders.map((b) => <td key={b.id} style={{ ...cell, fontWeight: 800, fontSize: 15, color: b.isLow ? GREEN : TEXT, background: b.isLow ? 'rgba(61,214,140,0.10)' : 'transparent' }}>{usd(b.leveledTotalCents)}</td>)}</tr>
                <tr><td style={cellL}>Δ vs low</td>{result.bidders.map((b) => <td key={b.id} style={{ ...cell, color: DIM }}>{b.isLow ? '—' : '+' + usd(b.deltaFromLowCents)}</td>)}</tr>
                {result.budgetCents ? <tr><td style={cellL}>vs Budget</td>{result.bidders.map((b) => <td key={b.id} style={{ ...cell, color: (b.vsBudgetCents || 0) > 0 ? RED : GREEN }}>{(b.vsBudgetCents || 0) > 0 ? '+' : ''}{usd(b.vsBudgetCents || 0)} ({b.vsBudgetPct}%)</td>)}</tr> : null}
                <tr><td style={cellL}>Scope coverage</td>{result.bidders.map((b) => <td key={b.id} style={{ ...cell, color: b.requiredCoveragePct < 100 ? GOLD : DIM }}>{b.requiredCoveragePct}%</td>)}</tr>
              </tbody>
            </table>
            {result.flags.length > 0 && <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>{result.flags.map((f, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: f.level === 'warn' ? GOLD : DIM }}>{f.level === 'warn' ? <Warning size={15} weight="fill" color={GOLD} /> : <Info size={15} color={DIM} />}{f.message}</div>)}</div>}
          </div>
        )}

        {/* scope matrix */}
        {bidders.length > 0 && scopeLines.length > 0 && (
          <div style={{ background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18, marginTop: 14, overflowX: 'auto' }}>
            <div style={{ fontSize: 12, color: DIM, fontWeight: 700, letterSpacing: 0.8, marginBottom: 10 }}>SCOPE MATRIX · click a cell to change</div>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12.5, minWidth: 560 }}>
              <thead><tr style={{ background: HEAD }}><th style={{ textAlign: 'left', padding: '7px 10px', color: DIM, position: 'sticky', left: 0, background: HEAD }}>Scope line</th><th style={{ padding: '7px 6px', color: DIM }}>Cov</th>{result.bidders.map((b) => <th key={b.id} style={{ padding: '7px 8px', color: TEXT, whiteSpace: 'nowrap' }}>{b.name}</th>)}</tr></thead>
              <tbody>{scopeLines.map((l) => { const cov = result.scopeCoverage.find((c) => c.scopeLineId === l.id)!; return (
                <tr key={l.id}>
                  <td style={{ ...cellL, fontWeight: 500 }}>{l.description}{l.required === false && <span style={{ color: DIM, fontSize: 11 }}> (opt)</span>}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'center', color: cov.noneCovered ? RED : cov.singleBid ? GOLD : GREEN, fontWeight: 700 }}>{cov.includedBy}</td>
                  {result.bidders.map((b) => { const it = b.lines.find((s) => s.scopeLineId === l.id); const st = (it && it.status !== 'missing' ? it.status : 'excluded') as ScopeStatus; return (
                    <td key={b.id} onClick={() => cycleCell(b.id, l.id)} title="click to cycle" style={{ padding: '5px 8px', textAlign: 'center', cursor: 'pointer', color: STC[st], background: `${STC[st]}14`, borderLeft: `1px solid ${BORDER}` }}>{STL[st]}{it?.valueCents ? <div style={{ fontSize: 10.5, color: DIM }}>{usd(it.valueCents)}</div> : null}</td>
                  ); })}
                </tr>
              ); })}</tbody>
            </table>
            {result.uncoveredRequired > 0 && <div style={{ marginTop: 8, fontSize: 12.5, color: RED, display: 'flex', alignItems: 'center', gap: 6 }}><Warning size={14} weight="fill" color={RED} />{result.uncoveredRequired} required scope line{result.uncoveredRequired > 1 ? 's have' : ' has'} no coverage — re-solicit or carry.</div>}
          </div>
        )}

        {/* alternates */}
        {altKeys.length > 0 && (
          <div style={{ background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, marginTop: 14 }}>
            <div style={{ fontSize: 12, color: DIM, fontWeight: 700, letterSpacing: 0.8, marginBottom: 8 }}>ALTERNATES TO APPLY</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{altKeys.map((k) => { const on = selAlts.includes(k); return <button key={k} onClick={() => setSelAlts((x) => on ? x.filter((y) => y !== k) : [...x, k])} style={{ ...ghost, borderColor: on ? BLUE : BORDER, color: on ? BLUE : TEXT, background: on ? 'rgba(56,189,248,0.12)' : 'transparent' }}>{k} · {altMeta[k]}</button>; })}</div>
          </div>
        )}

        {/* AI extract */}
        <div style={{ border: `1.5px solid rgba(56,189,248,0.5)`, background: 'linear-gradient(180deg,rgba(56,189,248,0.08),rgba(56,189,248,0.02))', borderRadius: 12, padding: 14, marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 14, marginBottom: 6 }}><Sparkle size={18} weight="fill" color={BLUE} />AI extract a bid</div>
          <textarea value={aiText} onChange={(e) => setAiText(e.target.value)} placeholder="Paste a subcontractor's proposal — AI maps it onto your scope checklist and adds it as a bidder." style={{ ...inp, width: '100%', minHeight: 70, resize: 'vertical' }} />
          <button onClick={extract} disabled={aiBusy} style={{ ...btn, marginTop: 8, background: BLUE, opacity: aiBusy ? 0.6 : 1 }}>{aiBusy ? 'Reading…' : 'Extract & add bidder'}</button>
        </div>

        {/* scope checklist */}
        <div style={{ background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, marginTop: 16 }}>
          <div style={{ fontSize: 12, color: DIM, fontWeight: 700, letterSpacing: 0.8, marginBottom: 10 }}>SCOPE CHECKLIST</div>
          {scopeLines.map((l) => (
            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: `1px solid ${BORDER}` }}>
              <button onClick={() => setScopeLines((x) => x.map((s) => s.id === l.id ? { ...s, required: !(s.required !== false) } : s))} style={{ ...ghost, padding: '3px 8px', fontSize: 11, borderColor: l.required !== false ? GOLD : BORDER, color: l.required !== false ? GOLD : DIM }}>{l.required !== false ? 'Required' : 'Optional'}</button>
              <span style={{ flex: 1 }}>{l.description}</span>
              <button onClick={() => setScopeLines((x) => x.filter((s) => s.id !== l.id))} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><Trash size={16} color={RED} /></button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input value={scopeInput} onChange={(e) => setScopeInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addScope()} placeholder="Add a scope line — or load a CSI template above" style={{ ...inp, flex: 1 }} />
            <button onClick={addScope} style={btn}><Plus size={15} />Add</button>
          </div>
        </div>

        {/* bidders */}
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: DIM, fontWeight: 700, letterSpacing: 0.8 }}>BIDDERS</div>
            <button onClick={addBidder} style={{ ...btn, marginLeft: 'auto' }}><Plus size={15} />Add bidder</button>
          </div>
          {bidders.length === 0 ? <div style={{ color: DIM, fontSize: 13 }}>Add bidders manually or extract them from bid text above.</div> : bidders.map((b) => {
            const lb = result.bidders.find((x) => x.id === b.id);
            return (
              <div key={b.id} style={{ background: RAISED, border: `1px solid ${lb?.isLow ? 'rgba(61,214,140,0.4)' : BORDER}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input value={b.name} onChange={(e) => patchBidder(b.id, { name: e.target.value })} style={{ ...inp, flex: 2, minWidth: 150, fontWeight: 700 }} />
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ color: DIM, fontSize: 13 }}>Base $</span><input value={b.baseBidCents ? (b.baseBidCents / 100).toString() : ''} onChange={(e) => patchBidder(b.id, { baseBidCents: toCents(e.target.value) })} placeholder="0" style={{ ...inp, width: 120 }} /></div>
                  {lb && <span style={{ color: lb.isLow ? GREEN : DIM, fontSize: 13, fontWeight: 700 }}>= {usd(lb.leveledTotalCents)}</span>}
                  <button onClick={() => setAdjOpen(adjOpen === b.id ? null : b.id)} style={{ ...ghost, padding: '5px 9px', fontSize: 12 }}>Adjust {adjOpen === b.id ? <CaretDown size={12} /> : <CaretRight size={12} />}</button>
                  <button onClick={() => setBidders((x) => x.filter((y) => y.id !== b.id))} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><Trash size={17} color={RED} /></button>
                </div>
                {adjOpen === b.id && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    {([['bondCents', 'Bond $'], ['taxCents', 'Sales tax $'], ['carryCents', 'Carry $']] as const).map(([k, lbl]) => <label key={k} style={{ fontSize: 12, color: DIM }}>{lbl}<input value={(b.adjustments?.[k] || 0) ? ((b.adjustments![k] as number) / 100).toString() : ''} onChange={(e) => patchAdj(b.id, k, e.target.value)} placeholder="0" style={{ ...inp, width: 100, marginLeft: 6 }} /></label>)}
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: DIM }}><input type="checkbox" checked={b.insuranceMeets !== false} onChange={(e) => patchBidder(b.id, { insuranceMeets: e.target.checked })} />Insurance meets</label>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: DIM }}><input type="checkbox" checked={b.bondIncluded === true} onChange={(e) => patchBidder(b.id, { bondIncluded: e.target.checked })} />Bond in base</label>
                  </div>
                )}
                {scopeLines.length > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {scopeLines.map((l) => { const it = b.scope.find((s) => s.scopeLineId === l.id); const st = (it?.status || 'excluded') as ScopeStatus; return (
                      <button key={l.id} onClick={() => cycleCell(b.id, l.id)} title="click to cycle Incl → Excl → Clarify → Alt" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: `1px solid ${STC[st]}55`, background: `${STC[st]}18`, color: STC[st], borderRadius: 7, padding: '5px 9px', cursor: 'pointer', fontSize: 12 }}>
                        <span style={{ width: 7, height: 7, borderRadius: 4, background: STC[st] }} />{l.description}<span style={{ opacity: 0.7 }}>{STL[st]}</span>
                      </button>
                    ); })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 20, fontSize: 12 }}><a href="/app/bids" style={{ color: DIM }}>← Back to Bid Center</a></div>
      </div>
    </div>
  );
}
const cell: React.CSSProperties = { padding: '7px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
const cellL: React.CSSProperties = { padding: '7px 10px', textAlign: 'left', color: '#CBD5E1', position: 'sticky', left: 0, background: '#141416' };
