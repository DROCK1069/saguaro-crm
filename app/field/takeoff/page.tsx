'use client';
/**
 * Saguaro Field — AI Takeoff (mobile-first)
 * Lets iOS/field users run an AI blueprint takeoff WITHOUT being ejected to the
 * desktop CRM. Reuses the exact desktop API sequence:
 *   1. POST /api/takeoff/create            { projectId }            -> { data: { id } }
 *   2. POST /api/takeoff/{id}/upload       FormData( file )
 *   3. EventSource /api/takeoff/{id}/analyze  (SSE progress + result/done)
 *   4. GET  /api/takeoff/{id}              -> { data: Takeoff w/ materials[] }
 * Project comes from ?projectId= (FieldLayout auto-appends it).
 */
import React, { useState, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Ruler } from '@phosphor-icons/react';

const GOLD   = '#C8881C';
const RAISED  = '#FFFFFF';
const BORDER = '#E5E5EA';
const TEXT   = '#1C1C1E';
const DIM    = '#6E6E73';
const GREEN  = '#22C55E';
const RED    = '#EF4444';

// ── Types (match the desktop takeoff shapes) ───────────────────────────────
interface TakeoffMaterial {
  id: string; csi_code: string; csi_name: string; description: string;
  quantity: number; unit: string; unit_cost: number; total_cost: number;
  labor_hours: number; notes: string; sort_order: number;
}
interface Takeoff {
  id: string; name: string; project_id: string;
  project_name?: string;
  status: 'pending' | 'uploaded' | 'analyzing' | 'complete' | 'failed';
  total_cost: number; material_cost: number; labor_cost: number;
  building_area: number; floor_count: number; confidence: number;
  building_type: string; summary: string; project_name_detected: string;
  contingency_pct: number; recommendations: string[];
  file_name: string; created_at: string; analyzed_at: string;
  materials?: TakeoffMaterial[];
}

type Phase = 'upload' | 'processing' | 'done' | 'error';

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

interface CsiDivision {
  divCode: string; divName: string; items: TakeoffMaterial[]; totalCost: number;
}
// Group materials by CSI division (first 2 chars of csi_code) — same approach
// as the desktop page.
function groupByDivision(materials: TakeoffMaterial[]): CsiDivision[] {
  const map = new Map<string, CsiDivision>();
  for (const m of materials) {
    const divCode = (m.csi_code || '00').slice(0, 2).replace(/\s/g, '');
    if (!map.has(divCode)) {
      map.set(divCode, { divCode, divName: m.csi_name || `Division ${divCode}`, items: [], totalCost: 0 });
    }
    const div = map.get(divCode)!;
    div.items.push(m);
    div.totalCost += m.total_cost || 0;
  }
  return Array.from(map.values()).sort((a, b) => a.divCode.localeCompare(b.divCode));
}

function FieldTakeoff() {
  const sp = useSearchParams();
  const router = useRouter();
  const projectId = sp.get('projectId') || '';

  const [phase, setPhase] = useState<Phase>('upload');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [progress, setProgress] = useState({ pct: 0, message: '' });
  const [errorMsg, setErrorMsg] = useState('');
  const [takeoff, setTakeoff] = useState<Takeoff | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preserve ?projectId when navigating back into the field hub.
  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push('/field');
  };

  function reset() {
    setPhase('upload');
    setPendingFile(null);
    setProgress({ pct: 0, message: '' });
    setErrorMsg('');
    setTakeoff(null);
  }

  // ── Upload → analyze flow (faithful to the desktop sequence) ─────────────
  async function runTakeoff(file: File) {
    if (!projectId) {
      setErrorMsg('Select a project first.');
      setPhase('error');
      return;
    }
    setPhase('processing');
    setProgress({ pct: 5, message: 'Creating takeoff record…' });
    setErrorMsg('');

    try {
      // 1. Create takeoff record
      const createRes = await fetch('/api/takeoff/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      const createJson = await createRes.json();
      if (!createRes.ok) throw new Error(createJson.error || 'Failed to create takeoff');
      const takeoffId: string = createJson.data.id;

      // 2. Upload file (FormData)
      setProgress({ pct: 20, message: 'Uploading blueprint…' });
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await fetch(`/api/takeoff/${takeoffId}/upload`, {
        method: 'POST',
        body: formData,
      });
      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadJson.error || 'Upload failed');

      // 3. Analyze via SSE
      setProgress({ pct: 25, message: 'AI is reading your blueprint…' });
      await new Promise<void>((resolve, reject) => {
        const evtSource = new EventSource(`/api/takeoff/${takeoffId}/analyze`);
        let sseResolved = false;

        evtSource.onmessage = (e) => {
          try {
            const evt = JSON.parse(e.data);
            if (evt.event === 'progress') {
              setProgress({ pct: evt.pct, message: evt.message });
            } else if (evt.event === 'result') {
              sseResolved = true;
              evtSource.close();
              resolve();
            } else if (evt.event === 'error') {
              sseResolved = true;
              evtSource.close();
              reject(new Error(evt.message));
            } else if (evt.event === 'done') {
              sseResolved = true;
              evtSource.close();
              resolve();
            }
          } catch {
            // ignore parse errors
          }
        };

        evtSource.onerror = () => {
          evtSource.close();
          if (!sseResolved) {
            reject(new Error('Connection lost during analysis. Please try again.'));
          }
        };
      });

      // 4. Load the completed takeoff + its materials
      setProgress({ pct: 100, message: 'Complete!' });
      const detailRes = await fetch(`/api/takeoff/${takeoffId}`);
      const detailJson = await detailRes.json();
      if (!detailRes.ok || !detailJson.data) throw new Error(detailJson.error || 'Failed to load takeoff');
      setTakeoff(detailJson.data);
      setPhase('done');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Analysis failed';
      setErrorMsg(msg);
      setPhase('error');
    }
  }

  function handleFile(file: File) {
    const valid = ['application/pdf', 'image/png', 'image/jpeg', 'image/tiff', 'image/webp', 'image/heic'];
    if (file.type && !valid.includes(file.type) && !file.type.startsWith('image/')) {
      setErrorMsg('Invalid file type. Use a PDF or a photo of the plan.');
      setPhase('error');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setErrorMsg('File too large. Maximum 50MB.');
      setPhase('error');
      return;
    }
    setPendingFile(file);
  }

  // ── Header (back control + title) ────────────────────────────────────────
  const Header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <button onClick={goBack} aria-label="Back"
        style={{ background: 'none', border: 'none', color: GOLD, fontSize: 17, fontWeight: 700, cursor: 'pointer', padding: '4px 6px 4px 0', display: 'flex', alignItems: 'center', gap: 2 }}>
        ‹ Back
      </button>
      <div style={{ flex: 1 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: TEXT, display: 'flex', alignItems: 'center', gap: 7 }}>
          <Ruler size={22} weight="duotone" color={GOLD} /> AI Takeoff
        </h1>
      </div>
      <button onClick={goBack} aria-label="Close"
        style={{ background: 'none', border: 'none', color: DIM, fontSize: 26, lineHeight: 1, cursor: 'pointer', padding: '0 2px' }}>
        ×
      </button>
    </div>
  );

  // ── No project ───────────────────────────────────────────────────────────
  if (!projectId) {
    return (
      <div style={{ padding: '18px 16px' }}>
        {Header}
        <div style={{ background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '32px 20px', textAlign: 'center' }}>
          <div style={{ marginBottom: 12 }}><Ruler size={40} weight="duotone" color={GOLD} /></div>
          <p style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700, color: TEXT }}>Select a project first</p>
          <p style={{ margin: 0, fontSize: 14, color: DIM, lineHeight: 1.5 }}>
            Use the project switcher at the top of the screen to pick a project, then come back to run an AI takeoff.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '18px 16px' }}>
      {Header}

      {/* ── UPLOAD ── */}
      {phase === 'upload' && (
        <>
          <p style={{ margin: '0 0 14px', fontSize: 14, color: DIM }}>
            Upload a PDF or snap a photo of a plan for an instant AI material &amp; cost estimate.
          </p>

          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${pendingFile ? GOLD : BORDER}`,
              borderRadius: 16, padding: '36px 18px', textAlign: 'center',
              background: pendingFile ? 'rgba(200,136,28,.06)' : RAISED, cursor: 'pointer',
              marginBottom: 14,
            }}
          >
            <div style={{ marginBottom: 12 }}><Ruler size={44} weight="duotone" color={GOLD} /></div>
            <div style={{ color: TEXT, fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
              {pendingFile ? 'Tap to choose a different file' : 'Tap to upload a plan'}
            </div>
            <div style={{ color: DIM, fontSize: 13 }}>PDF or photo · max 50MB</div>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: '100%', padding: '15px', marginBottom: 12, background: RAISED,
              color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 14,
              fontWeight: 700, fontSize: 16, cursor: 'pointer',
            }}
          >
            Choose PDF or Photo
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/*"
            capture="environment"
            hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />

          {pendingFile && (
            <div style={{ background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '12px 14px', marginBottom: 14, fontSize: 14 }}>
              <span style={{ color: DIM }}>Selected: </span>
              <span style={{ color: TEXT, fontWeight: 600, wordBreak: 'break-all' }}>{pendingFile.name}</span>
            </div>
          )}

          <button
            disabled={!pendingFile}
            onClick={() => pendingFile && runTakeoff(pendingFile)}
            style={{
              width: '100%', padding: '18px', background: pendingFile ? GOLD : '#E5E5EA',
              color: pendingFile ? '#000' : DIM, border: 'none', borderRadius: 14,
              fontWeight: 800, fontSize: 17, cursor: pendingFile ? 'pointer' : 'not-allowed',
            }}
          >
            Run AI Takeoff
          </button>
        </>
      )}

      {/* ── PROCESSING ── */}
      {phase === 'processing' && (
        <div style={{ background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '28px 20px', textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, margin: '0 auto 18px', border: `4px solid ${BORDER}`, borderTopColor: GOLD, borderRadius: '50%', animation: 'tspin 0.9s linear infinite' }} />
          <p style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700, color: TEXT }}>{progress.message || 'Working…'}</p>
          <div style={{ height: 10, background: '#F2F2F7', borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ height: '100%', width: `${progress.pct}%`, background: GOLD, borderRadius: 6, transition: 'width 0.3s' }} />
          </div>
          <p style={{ margin: 0, fontSize: 13, color: DIM }}>{progress.pct}% complete</p>
          <p style={{ margin: '14px 0 0', fontSize: 12, color: DIM }}>Keep this screen open while the AI works.</p>
          <style>{`@keyframes tspin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* ── DONE / RESULTS ── */}
      {phase === 'done' && takeoff && (
        <>
          {/* Stat tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            <Tile label="Project" value={takeoff.project_name || takeoff.project_name_detected || '—'} />
            <Tile label="Building Type" value={takeoff.building_type || '—'} />
            <Tile label="Total Cost" value={fmt(takeoff.total_cost)} accent={GOLD} />
            <Tile label="Confidence" value={takeoff.confidence > 0 ? `${takeoff.confidence}%` : '—'} accent={GREEN} />
          </div>

          {/* Line items grouped by CSI division */}
          {takeoff.materials?.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              {groupByDivision(takeoff.materials).map(div => (
                <div key={div.divCode} style={{ background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', background: '#F2F2F7', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: GOLD, letterSpacing: 0.3 }}>
                      DIV {div.divCode} — {div.divName}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: TEXT, flexShrink: 0 }}>{fmt(div.totalCost)}</span>
                  </div>
                  {div.items.map((m, i) => (
                    <div key={m.id || i} style={{ padding: '11px 14px', borderBottom: i < div.items.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>
                            <span style={{ fontFamily: 'monospace', fontSize: 12, color: DIM, marginRight: 6 }}>{m.csi_code}</span>
                            {m.csi_name}
                          </div>
                          {m.description && (
                            <div style={{ fontSize: 13, color: DIM, marginTop: 2, lineHeight: 1.4 }}>{m.description}</div>
                          )}
                          <div style={{ fontSize: 12, color: DIM, marginTop: 4 }}>
                            {(m.quantity || 0).toLocaleString()} {m.unit}
                          </div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, flexShrink: 0 }}>{fmt(m.total_cost)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '24px', textAlign: 'center', color: DIM, fontSize: 14, marginBottom: 16 }}>
              No line items were extracted.
            </div>
          )}

          {takeoff.summary && (
            <div style={{ background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px', marginBottom: 16 }}>
              <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: DIM, textTransform: 'uppercase', letterSpacing: 0.6 }}>AI Summary</p>
              <p style={{ margin: 0, fontSize: 14, color: TEXT, lineHeight: 1.6 }}>{takeoff.summary}</p>
            </div>
          )}

          <button
            onClick={reset}
            style={{ width: '100%', padding: '18px', background: GOLD, color: '#000', border: 'none', borderRadius: 14, fontWeight: 800, fontSize: 17, cursor: 'pointer' }}
          >
            Start a new takeoff
          </button>
        </>
      )}

      {/* ── ERROR ── */}
      {phase === 'error' && (
        <>
          <div style={{ background: 'rgba(239,68,68,.1)', border: `1px solid rgba(239,68,68,.3)`, borderRadius: 14, padding: '16px 16px', marginBottom: 14, color: RED, fontSize: 14, fontWeight: 600 }}>
            {errorMsg || 'Something went wrong. Please try again.'}
          </div>
          <button
            onClick={reset}
            style={{ width: '100%', padding: '18px', background: GOLD, color: '#000', border: 'none', borderRadius: 14, fontWeight: 800, fontSize: 17, cursor: 'pointer' }}
          >
            Retry
          </button>
        </>
      )}
    </div>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '12px 14px' }}>
      <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: DIM, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</p>
      <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: accent || TEXT, wordBreak: 'break-word', lineHeight: 1.2 }}>{value}</p>
    </div>
  );
}

export default function FieldTakeoffPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32, color: DIM, textAlign: 'center' }}>Loading…</div>}>
      <FieldTakeoff />
    </Suspense>
  );
}
