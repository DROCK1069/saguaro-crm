'use client';
import React, { useState, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

const GOLD = '#D4A017', RAISED = '#0D1D2E', BORDER = '#1E3A5F', TEXT = '#F0F4FF', DIM = '#8BAAC8';
const GREEN = '#22C55E', RED = '#EF4444', BLUE = '#3B82F6';

type Phase = 'idle' | 'uploading' | 'analyzing' | 'done' | 'error';
interface LineItem { csiCode?: string; csiName?: string; description?: string; quantity?: number; unit?: string; unitCost?: number; totalCost?: number; }
interface Result {
  projectName?: string; buildingType?: string; estimatedSF?: number; confidence?: number;
  summary?: string; items?: LineItem[]; totalMaterialCost?: number; totalLaborCost?: number;
  totalProjectCost?: number; contingency?: number; recommendations?: string[]; itemCount?: number;
}
const usd = (n?: number) => '$' + Math.round(n || 0).toLocaleString('en-US');

function TakeoffPage() {
  const sp = useSearchParams();
  const projectId = sp.get('projectId') || '';
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [pct, setPct] = useState(0);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [fileName, setFileName] = useState('');

  const reset = () => { setPhase('idle'); setPct(0); setMsg(''); setErr(''); setResult(null); setFileName(''); if (fileRef.current) fileRef.current.value = ''; };

  const startUpload = useCallback(async (file: File) => {
    if (!projectId) { setErr('Open Takeoff from inside a project so it knows where to file the estimate.'); setPhase('error'); return; }
    setFileName(file.name); setErr(''); setResult(null);
    setPhase('uploading'); setPct(5); setMsg('Creating takeoff…');
    try {
      // 1. Create record
      const createRes = await fetch('/api/takeoff/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId }) });
      const createJson = await createRes.json();
      if (!createRes.ok) throw new Error(createJson.error || 'Failed to create takeoff');
      const takeoffId: string = createJson.data?.id || createJson.id;

      // 2. Upload blueprint
      setPct(20); setMsg('Uploading blueprint…');
      const fd = new FormData(); fd.append('file', file);
      const upRes = await fetch(`/api/takeoff/${takeoffId}/upload`, { method: 'POST', body: fd });
      const upJson = await upRes.json();
      if (!upRes.ok) throw new Error(upJson.error || 'Upload failed');

      // 3. Analyze (SSE)
      setPhase('analyzing'); setPct(25); setMsg('AI is reading your blueprint…');
      await new Promise<void>((resolve, reject) => {
        const es = new EventSource(`/api/takeoff/${takeoffId}/analyze`);
        let settled = false;
        es.onmessage = (e) => {
          try {
            const evt = JSON.parse(e.data);
            if (evt.event === 'progress') { setPct(evt.pct ?? pct); setMsg(evt.message || ''); }
            else if (evt.event === 'result') { settled = true; setResult(evt as Result); es.close(); resolve(); }
            else if (evt.event === 'error') { settled = true; es.close(); reject(new Error(evt.message || 'Analysis failed')); }
            else if (evt.event === 'done') { settled = true; es.close(); resolve(); }
          } catch { /* ignore */ }
        };
        es.onerror = () => { es.close(); if (!settled) reject(new Error('Connection lost during analysis. Please try again.')); };
      });
      setPhase('done'); setPct(100); setMsg('Complete!');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Analysis failed'); setPhase('error');
    }
  }, [projectId, pct]);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) startUpload(f); };
  const busy = phase === 'uploading' || phase === 'analyzing';

  return (
    <div style={{ padding: '18px 16px', maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800, color: TEXT }}>AI Takeoff</h1>
      <p style={{ margin: '0 0 16px', fontSize: 14, color: DIM }}>Upload a blueprint (PDF or photo) — AI returns a full material &amp; cost estimate in seconds.</p>

      {!projectId && (
        <div style={{ background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 10, padding: '12px 14px', marginBottom: 14, color: '#F59E0B', fontSize: 13, fontWeight: 600 }}>
          Open Takeoff from inside a project (tap a project first) so the estimate files to the right job.
        </div>
      )}

      {/* Upload zone */}
      {(phase === 'idle' || phase === 'error') && (
        <>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={!projectId}
            style={{ width: '100%', background: RAISED, border: `2px dashed ${projectId ? GOLD : BORDER}`, borderRadius: 16, padding: '36px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, cursor: projectId ? 'pointer' : 'not-allowed', opacity: projectId ? 1 : 0.6 }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={44} height={44}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1={12} y1={3} x2={12} y2={15} /></svg>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: GOLD }}>Upload Blueprint</p>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: DIM }}>PDF, JPG or PNG · tap to choose or take a photo</p>
            </div>
          </button>
          <input ref={fileRef} type="file" accept="application/pdf,image/*" onChange={onPick} style={{ display: 'none' }} />
        </>
      )}

      {err && phase === 'error' && (
        <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 10, padding: '12px 14px', margin: '14px 0', color: RED, fontSize: 14, fontWeight: 600 }}>{err}</div>
      )}

      {/* Progress */}
      {busy && (
        <div style={{ background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '22px 18px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 4px', fontSize: 13, color: DIM }}>{fileName}</p>
          <p style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700, color: GOLD }}>{msg}</p>
          <div style={{ height: 10, borderRadius: 6, background: '#07101C', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: GOLD, transition: 'width .4s ease' }} />
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 12, color: DIM }}>{pct}% · large blueprints can take ~30–60s</p>
        </div>
      )}

      {/* Result */}
      {phase === 'done' && result && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <Stat label="Total Estimate" value={usd(result.totalProjectCost)} color={GOLD} />
            <Stat label="Confidence" value={`${result.confidence ?? 0}%`} color={GREEN} />
            <Stat label="Material" value={usd(result.totalMaterialCost)} color={BLUE} />
            <Stat label="Labor" value={usd(result.totalLaborCost)} color={BLUE} />
          </div>
          {result.summary && <p style={{ margin: '0 0 14px', fontSize: 13, color: DIM, lineHeight: 1.5 }}>{result.summary}</p>}
          <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: DIM, textTransform: 'uppercase', letterSpacing: 0.8 }}>{result.itemCount ?? result.items?.length ?? 0} Line Items</p>
          <div style={{ background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
            {(result.items || []).map((it, i) => (
              <div key={i} style={{ padding: '10px 14px', borderBottom: i < (result.items!.length - 1) ? `1px solid ${BORDER}` : 'none', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.csiName || it.description}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: DIM }}>{it.csiCode ? it.csiCode + ' · ' : ''}{it.quantity} {it.unit} @ {usd(it.unitCost)}</p>
                </div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: GOLD, whiteSpace: 'nowrap' }}>{usd(it.totalCost)}</p>
              </div>
            ))}
          </div>
          <button onClick={reset} style={{ width: '100%', background: GOLD, border: 'none', borderRadius: 14, padding: '16px', color: '#000', fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>New Takeoff</button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '12px 14px' }}>
      <p style={{ margin: 0, fontSize: 11, color: DIM, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</p>
      <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 800, color }}>{value}</p>
    </div>
  );
}

export default function FieldTakeoffPage() {
  return <Suspense fallback={<div style={{ padding: 32, color: DIM, textAlign: 'center' }}>Loading…</div>}><TakeoffPage /></Suspense>;
}
