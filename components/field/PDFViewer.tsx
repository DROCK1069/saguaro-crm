'use client';
/**
 * PDFViewer — in-app PDF reader (pdf.js) that beats Procore's viewer on iOS,
 * now with calibrated on-sheet MEASUREMENT.
 *
 * Reader: crisp canvas render at DPR, page nav/jump, zoom/fit/rotate, lazy
 * thumbnail rail, in-document text search, download.
 * Measure: tap two points to drop a dimension; calibrate once against a known
 * length and every measurement reads in feet-inches. Measurements are stored in
 * PDF-point space so they stay correct through zoom/rotate.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */

const GOLD = '#C8881C';
const BASE = '#F2F2F7';
const BORDER = '#E5E5EA';
const TEXT = '#1C1C1E';
const DIM = '#6E6E73';
const GREEN = '#22C55E';

let pdfjsPromise: Promise<any> | null = null;
function getPdfjs(): Promise<any> {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

function Thumb({ pdf, pageNum, active, onClick }: { pdf: any; pageNum: number; active: boolean; onClick: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || done) return;
    const io = new IntersectionObserver(async (entries) => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      try {
        const p = await pdf.getPage(pageNum);
        const vp = p.getViewport({ scale: 1 });
        const v = p.getViewport({ scale: 90 / vp.width });
        el.width = v.width; el.height = v.height;
        await p.render({ canvasContext: el.getContext('2d')!, viewport: v }).promise;
        setDone(true);
      } catch { /* ignore */ }
    }, { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, [pdf, pageNum, done]);
  return (
    <button onClick={onClick} style={{ display: 'block', padding: 4, borderRadius: 8, cursor: 'pointer', background: active ? 'rgba(200,136,28,0.14)' : 'transparent', border: `1px solid ${active ? GOLD : 'transparent'}`, width: '100%' }}>
      <canvas ref={ref} style={{ width: 90, height: 'auto', display: 'block', margin: '0 auto', borderRadius: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.12)', background: '#fff' }} />
      <div style={{ fontSize: 10, color: active ? GOLD : DIM, textAlign: 'center', marginTop: 3, fontWeight: active ? 700 : 500 }}>{pageNum}</div>
    </button>
  );
}

export default function PDFViewer({ url, fileName, height }: { url: string; fileName?: string; height?: number | string }) {
  const [pdf, setPdf] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [showThumbs, setShowThumbs] = useState(false);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<number[]>([]);
  const [matchIdx, setMatchIdx] = useState(0);
  const [searching, setSearching] = useState(false);

  // Measurement
  const [measure, setMeasure] = useState(false);
  const [calPtPerFt, setCalPtPerFt] = useState<number | null>(null); // PDF points per foot
  const [measurements, setMeasurements] = useState<{ ax: number; ay: number; bx: number; by: number }[]>([]);
  const pendingRef = useRef<{ x: number; y: number } | null>(null);
  const [calOpen, setCalOpen] = useState(false);
  const [calVal, setCalVal] = useState('10');
  const [calUnit, setCalUnit] = useState<'ft' | 'in' | 'm'>('ft');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const renderRef = useRef<any>(null);
  const rsRef = useRef(1); // CSS px per PDF point at current zoom/rotation

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setErr(''); setPdf(null); setPage(1); setMeasurements([]); setCalPtPerFt(null); pendingRef.current = null;
    (async () => {
      try {
        const pdfjs = await getPdfjs();
        const doc = await pdfjs.getDocument({ url, isEvalSupported: false }).promise;
        if (cancelled) return;
        setPdf(doc); setNumPages(doc.numPages); setLoading(false);
      } catch { if (!cancelled) { setErr('Could not load this PDF.'); setLoading(false); } }
    })();
    return () => { cancelled = true; };
  }, [url]);

  const fmtLen = useCallback((pts: number): string => {
    if (calPtPerFt == null || calPtPerFt <= 0) return 'calibrate';
    const feet = pts / calPtPerFt;
    const ft = Math.floor(feet);
    const inch = Math.round((feet - ft) * 12);
    return inch === 12 ? `${ft + 1}'-0"` : `${ft}'-${inch}"`;
  }, [calPtPerFt]);

  const redrawOverlay = useCallback(() => {
    const ov = overlayRef.current; if (!ov) return;
    const ctx = ov.getContext('2d'); if (!ctx) return;
    ctx.clearRect(0, 0, ov.width, ov.height);
    const rs = rsRef.current;
    ctx.lineWidth = 2; ctx.strokeStyle = GOLD; ctx.fillStyle = GOLD; ctx.font = '12px -apple-system,sans-serif';
    measurements.forEach((m) => {
      const ax = m.ax * rs, ay = m.ay * rs, bx = m.bx * rs, by = m.by * rs;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      [[ax, ay], [bx, by]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill(); });
      const pts = Math.hypot(m.bx - m.ax, m.by - m.ay);
      const label = fmtLen(pts);
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fillRect(mx - tw / 2 - 5, my - 17, tw + 10, 16);
      ctx.fillStyle = TEXT; ctx.fillText(label, mx - tw / 2, my - 5);
      ctx.fillStyle = GOLD;
    });
    if (pendingRef.current) { const p = pendingRef.current; ctx.fillStyle = GREEN; ctx.beginPath(); ctx.arc(p.x * rs, p.y * rs, 4, 0, Math.PI * 2); ctx.fill(); }
  }, [measurements, fmtLen]);

  const render = useCallback(async () => {
    if (!pdf || !canvasRef.current || !scrollRef.current) return;
    const p = await pdf.getPage(page);
    const containerW = scrollRef.current.clientWidth || 800;
    const unit = p.getViewport({ scale: 1, rotation });
    const fit = Math.max(0.2, (containerW - 24) / unit.width);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vp = p.getViewport({ scale: fit * scale * dpr, rotation });
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    canvas.width = vp.width; canvas.height = vp.height;
    const cssW = vp.width / dpr, cssH = vp.height / dpr;
    canvas.style.width = `${cssW}px`; canvas.style.height = `${cssH}px`;
    rsRef.current = fit * scale; // CSS px per PDF point
    const ov = overlayRef.current;
    if (ov) { ov.width = cssW; ov.height = cssH; ov.style.width = `${cssW}px`; ov.style.height = `${cssH}px`; }
    if (renderRef.current) { try { renderRef.current.cancel(); } catch { /* */ } }
    const task = p.render({ canvasContext: ctx, viewport: vp });
    renderRef.current = task;
    try { await task.promise; } catch { /* cancelled */ }
    redrawOverlay();
  }, [pdf, page, scale, rotation, redrawOverlay]);

  useEffect(() => { render(); }, [render]);
  useEffect(() => { redrawOverlay(); }, [redrawOverlay]);

  const onMeasureClick = (e: React.MouseEvent) => {
    if (!measure) return;
    const ov = overlayRef.current; if (!ov) return;
    const r = ov.getBoundingClientRect();
    const rs = rsRef.current || 1;
    const x = (e.clientX - r.left) / rs, y = (e.clientY - r.top) / rs;
    if (!pendingRef.current) { pendingRef.current = { x, y }; redrawOverlay(); return; }
    const a = pendingRef.current; pendingRef.current = null;
    setMeasurements((prev) => [...prev, { ax: a.x, ay: a.y, bx: x, by: y }]);
    if (calPtPerFt == null) setCalOpen(true);
  };

  const applyCal = () => {
    const last = measurements[measurements.length - 1];
    if (last) {
      const pts = Math.hypot(last.bx - last.ax, last.by - last.ay);
      const v = parseFloat(calVal) || 0;
      const feet = calUnit === 'ft' ? v : calUnit === 'in' ? v / 12 : v * 3.28084;
      if (pts > 0 && feet > 0) setCalPtPerFt(pts / feet);
    }
    setCalOpen(false);
  };

  const runSearch = useCallback(async () => {
    const q = query.trim().toLowerCase();
    if (!pdf || !q) { setMatches([]); setMatchIdx(0); return; }
    setSearching(true);
    const found: number[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const pg = await pdf.getPage(i);
        const tc = await pg.getTextContent();
        if (tc.items.map((it: any) => ('str' in it ? it.str : '')).join(' ').toLowerCase().includes(q)) found.push(i);
      } catch { /* skip */ }
    }
    setMatches(found); setMatchIdx(0); setSearching(false);
    if (found.length) setPage(found[0]);
  }, [pdf, query]);

  const gotoMatch = (dir: 1 | -1) => { if (matches.length === 0) return; const n = (matchIdx + dir + matches.length) % matches.length; setMatchIdx(n); setPage(matches[n]); };
  const download = () => { const a = document.createElement('a'); a.href = url; a.download = fileName || 'document.pdf'; a.target = '_blank'; document.body.appendChild(a); a.click(); a.remove(); };

  const tBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 30, minWidth: 30, padding: '0 8px', borderRadius: 7, border: `1px solid ${BORDER}`, background: '#fff', color: TEXT, cursor: 'pointer', fontSize: 13, fontWeight: 600 };
  const box: React.CSSProperties = { width: '100%', height: height ?? '70vh', display: 'flex', flexDirection: 'column', background: BASE, borderRadius: 10, overflow: 'hidden', border: `1px solid ${BORDER}` };

  if (err) return <div style={{ ...box, alignItems: 'center', justifyContent: 'center', color: DIM, fontSize: 13 }}>{err} <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: GOLD, marginLeft: 6 }}>Open directly →</a></div>;

  return (
    <div style={box}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 8px', background: '#fff', borderBottom: `1px solid ${BORDER}`, flexWrap: 'wrap' }}>
        <button style={tBtn} onClick={() => setShowThumbs((s) => !s)} title="Thumbnails">▤</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button style={tBtn} disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹</button>
          <input value={page} onChange={(e) => { const n = parseInt(e.target.value || '1', 10); if (!isNaN(n)) setPage(Math.min(numPages || 1, Math.max(1, n))); }} style={{ width: 38, height: 30, textAlign: 'center', border: `1px solid ${BORDER}`, borderRadius: 7, fontSize: 13 }} />
          <span style={{ fontSize: 12, color: DIM }}>/ {numPages || '–'}</span>
          <button style={tBtn} disabled={page >= numPages} onClick={() => setPage((p) => Math.min(numPages, p + 1))}>›</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button style={tBtn} onClick={() => setScale((s) => Math.max(0.4, +(s - 0.25).toFixed(2)))} title="Zoom out">−</button>
          <button style={{ ...tBtn, fontSize: 11 }} onClick={() => setScale(1)} title="Fit width">{Math.round(scale * 100)}%</button>
          <button style={tBtn} onClick={() => setScale((s) => Math.min(4, +(s + 0.25).toFixed(2)))} title="Zoom in">+</button>
          <button style={tBtn} onClick={() => setRotation((r) => (r + 90) % 360)} title="Rotate">⟳</button>
          <button style={{ ...tBtn, background: measure ? GOLD : '#fff', color: measure ? '#000' : TEXT }} onClick={() => { setMeasure((m) => !m); pendingRef.current = null; redrawOverlay(); }} title="Measure">📏</button>
          {measure && measurements.length > 0 && <button style={tBtn} onClick={() => { setMeasurements([]); pendingRef.current = null; setCalPtPerFt(null); }} title="Clear measurements">⌫</button>}
        </div>
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
          <input value={query} placeholder="Search…" onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }} style={{ height: 30, width: 110, padding: '0 10px', border: `1px solid ${BORDER}`, borderRadius: 7, fontSize: 13, outline: 'none' }} />
          <button style={tBtn} onClick={runSearch} title="Search">{searching ? '…' : '⌕'}</button>
          {matches.length > 0 && (<><button style={tBtn} onClick={() => gotoMatch(-1)}>‹</button><span style={{ fontSize: 11, color: DIM, minWidth: 44, textAlign: 'center' }}>{matchIdx + 1}/{matches.length} pg</span><button style={tBtn} onClick={() => gotoMatch(1)}>›</button></>)}
          <button style={tBtn} onClick={download} title="Download">⬇</button>
        </div>
        {measure && (
          <div style={{ width: '100%', fontSize: 11, color: DIM, marginTop: 2 }}>
            {calPtPerFt == null ? 'Measure mode: tap two points, then enter the real length to calibrate.' : `Calibrated (${(calPtPerFt).toFixed(1)} pt/ft) — tap two points to measure.`}
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {showThumbs && pdf && (
          <div style={{ width: 116, flexShrink: 0, overflowY: 'auto', borderRight: `1px solid ${BORDER}`, background: '#fff', padding: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Array.from({ length: numPages }, (_, i) => (<Thumb key={i} pdf={pdf} pageNum={i + 1} active={page === i + 1} onClick={() => setPage(i + 1)} />))}
          </div>
        )}
        <div ref={scrollRef} style={{ flex: 1, minWidth: 0, overflow: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: 12, background: BASE, WebkitOverflowScrolling: 'touch' }}>
          {loading ? (
            <div style={{ margin: 'auto', color: DIM, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 16, height: 16, border: `2px solid ${BORDER}`, borderTopColor: GOLD, borderRadius: '50%', animation: 'pdfspin .8s linear infinite' }} />
              Loading PDF…
              <style>{`@keyframes pdfspin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <canvas ref={canvasRef} style={{ display: 'block', borderRadius: 2, boxShadow: '0 2px 12px rgba(0,0,0,0.14)', background: '#fff' }} />
              <canvas ref={overlayRef} onClick={onMeasureClick} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: measure ? 'auto' : 'none', cursor: measure ? 'crosshair' : 'default' }} />
              {calOpen && (
                <div style={{ position: 'absolute', top: 8, left: 8, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 8, padding: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', zIndex: 5 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, marginBottom: 6 }}>Calibrate — real length of this line</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input value={calVal} onChange={(e) => setCalVal(e.target.value)} style={{ width: 56, height: 28, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '0 6px', fontSize: 13 }} />
                    <select value={calUnit} onChange={(e) => setCalUnit(e.target.value as 'ft' | 'in' | 'm')} style={{ height: 28, border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13 }}><option value="ft">ft</option><option value="in">in</option><option value="m">m</option></select>
                    <button onClick={applyCal} style={{ ...tBtn, background: GOLD, color: '#000', border: 'none', fontWeight: 800 }}>Set</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */
