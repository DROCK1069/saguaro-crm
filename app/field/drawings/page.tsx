'use client';
/**
 * Saguaro Control Systems — Field Drawings.
 *
 * Project/sheet browser + the flagship DrawingViewer (components/drawings/):
 * pdf.js rendering (multi-page), PlanTracer-grade pan/zoom, the full B1 markup
 * tool set (pen/cloud/arrow/text/callout/rect/circle/measure/stamp/eraser),
 * per-markup persistence with offline enqueue, punch-from-drawing, and the
 * ?pin=<pinId> deep link that opens the right sheet zoomed to the pin.
 */
import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import FieldPageHeader from '../FieldPageHeader';
import { scopedFieldIcon } from '../field-icons';
import DrawingViewer, { type DrawingDoc, type DrawingPin } from '@/components/drawings/DrawingViewer';

const RAISED = '#141416', BORDER = 'rgba(255,255,255,0.12)', TEXT = '#FFFFFF', DIM = '#CBD5E1';
const RED = '#EF4444';
const ACCENT = 'var(--brand-primary, #F59E0B)';
const ACCENT_12 = 'var(--brand-primary-12, rgba(245,158,11,0.12))';
const ACCENT_25 = 'var(--brand-primary-25, rgba(245,158,11,0.25))';

type View = 'list' | 'viewer';

/** Raw row from /api/projects/[projectId]/drawings — live columns are
 *  sheet_number/name/notes/url, but older deployments carried
 *  sheet/description/file_url; tolerate BOTH. */
interface RawDrawing {
  id: string;
  sheet_number?: string | null;
  sheet?: string | null;
  name: string;
  notes?: string | null;
  description?: string | null;
  url?: string | null;
  file_url?: string | null;
  thumbnail_url?: string | null;
  discipline?: string | null;
}

function normalize(d: RawDrawing): DrawingDoc & { thumbnailUrl: string; discipline: string } {
  return {
    id: d.id,
    sheet: d.sheet_number || d.sheet || '',
    name: d.name || 'Untitled sheet',
    description: d.notes || d.description || '',
    fileUrl: d.file_url || d.url || '',
    thumbnailUrl: d.thumbnail_url || '',
    discipline: d.discipline || '',
  };
}

function DrawingsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams.get('projectId') || '';
  const deepPinId = searchParams.get('pin') || '';

  const [view, setView] = useState<View>('list');
  const [drawings, setDrawings] = useState<ReturnType<typeof normalize>[]>([]);
  const [selected, setSelected] = useState<ReturnType<typeof normalize> | null>(null);
  const [initialPin, setInitialPin] = useState<DrawingPin | null>(null);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [projectName, setProjectName] = useState('');
  const [me, setMe] = useState<{ id: string; name: string }>({ id: '', name: '' });

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.id) setMe({ id: d.id, name: d.name || d.email || 'You' }); })
      .catch(() => {});
  }, []);

  const loadDrawings = useCallback(async (): Promise<ReturnType<typeof normalize>[]> => {
    try {
      const r = await fetch(`/api/projects/${projectId}/drawings`);
      const d = await r.json();
      const rows: RawDrawing[] = Array.isArray(d.drawings) ? d.drawings : [];
      const docs = rows.map(normalize);
      setDrawings(docs);
      return docs;
    } catch { return []; /* offline */ }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) { setLoading(false); return; }
    let dead = false;
    fetch('/api/projects/list')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { const p = d?.projects?.find((x: { id: string; name: string }) => x.id === projectId); if (p && !dead) setProjectName(p.name); })
      .catch(() => {});
    (async () => {
      setLoading(true);
      const docs = await loadDrawings();
      if (dead) return;
      // DEEP LINK: ?pin=<pinId> → resolve the pin, open its sheet zoomed to it
      if (deepPinId && docs.length) {
        try {
          const r = await fetch(`/api/drawings/pins?projectId=${projectId}`);
          const d = await r.json().catch(() => ({}));
          const pin: DrawingPin | undefined = (d.pins || []).find((p: DrawingPin) => p.id === deepPinId);
          if (pin && !dead) {
            const doc = docs.find((x) => x.id === pin.drawing_id);
            if (doc) { setInitialPin(pin); setSelected(doc); setView('viewer'); }
          }
        } catch { /* pin link best-effort */ }
      }
      if (!dead) setLoading(false);
    })();
    return () => { dead = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, deepPinId]);

  const openDrawing = (doc: ReturnType<typeof normalize>) => {
    setInitialPin(null);
    setSelected(doc);
    setView('viewer');
  };

  /* ── VIEWER ── */
  if (view === 'viewer' && selected) {
    return (
      <div style={{ padding: '0 16px 32px' }}>
        <FieldPageHeader
          title={selected.sheet || selected.name}
          subtitle={selected.sheet ? selected.name : projectName || undefined}
          icon={scopedFieldIcon('drawings', 'ph')}
          onBack={() => { setView('list'); setSelected(null); setInitialPin(null); }}
        />
        {!online && (
          <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 13, color: RED, fontWeight: 600 }}>
            Offline — changes will sync when reconnected
          </div>
        )}
        <DrawingViewer
          projectId={projectId}
          drawing={selected}
          me={me.id ? me : { id: '', name: 'You' }}
          online={online}
          initialPin={initialPin}
        />
      </div>
    );
  }

  /* ── LIST (project/sheet browser chrome) ── */
  return (
    <div style={{ padding: '0 16px 24px' }}>
      <FieldPageHeader
        title="Drawings"
        subtitle={projectName || undefined}
        icon={scopedFieldIcon('drawings', 'ph')}
        onBack={() => router.back()}
      />

      {!online && (
        <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 13, color: RED, fontWeight: 600 }}>
          Offline — cached data only
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: DIM }}>Loading drawings…</div>
      ) : drawings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 16px', color: DIM }}>
          <div style={{ marginBottom: 12, color: DIM, display: 'flex', justifyContent: 'center' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" width={48} height={48}><rect x={2} y={2} width={20} height={20} rx={2} /><path d="M2 9h20M9 2v20" /></svg>
          </div>
          <p style={{ margin: 0, fontSize: 15 }}>No drawings found for this project.</p>
          <p style={{ margin: '6px 0 0', fontSize: 13 }}>Upload drawings in the web portal.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {drawings.map((doc) => (
            <button key={doc.id} onClick={() => openDrawing(doc)} className="lift" style={{ background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '12px 14px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
              {doc.thumbnailUrl ? (
                <img src={doc.thumbnailUrl} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, flexShrink: 0, background: '#1c1c1e' }} />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: 8, background: '#1c1c1e', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: DIM, flexShrink: 0 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" width={26} height={26}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  {doc.sheet && (
                    <span style={{ background: ACCENT_12, border: `1px solid ${ACCENT_25}`, borderRadius: 6, padding: '2px 7px', fontSize: 11, fontWeight: 700, color: ACCENT }}>{doc.sheet}</span>
                  )}
                  {doc.discipline && <span style={{ fontSize: 11, color: DIM }}>{doc.discipline}</span>}
                </div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: TEXT, lineHeight: 1.3 }}>{doc.name}</p>
                {doc.description && <p style={{ margin: '3px 0 0', fontSize: 12, color: DIM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.description}</p>}
              </div>
              <span style={{ color: DIM, fontSize: 20, flexShrink: 0 }}>&rsaquo;</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FieldDrawingsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32, color: '#CBD5E1', textAlign: 'center' }}>Loading…</div>}>
      <DrawingsPage />
    </Suspense>
  );
}
