'use client';
/**
 * PDFViewer — a real in-app PDF reader (pdf.js), built to beat Procore's
 * viewer on the one place theirs is weak: the iOS WebView.
 *
 * Features: crisp canvas rendering at device pixel ratio, page navigation +
 * jump, zoom (−/fit/+) and rotate, lazy-rendered thumbnail rail, in-document
 * text search with match navigation, and download. Works the same on web and
 * inside the Capacitor iOS WebView (no native iframe PDF dependency).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */

const GOLD = '#C8881C';
const BASE = '#F2F2F7';
const BORDER = '#E5E5EA';
const TEXT = '#1C1C1E';
const DIM = '#6E6E73';

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
        const scale = 90 / vp.width;
        const v = p.getViewport({ scale });
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

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const renderRef = useRef<any>(null);

  // Load the document
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setErr(''); setPdf(null); setPage(1);
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

  // Render the current page
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
    canvas.style.width = `${vp.width / dpr}px`;
    canvas.style.height = `${vp.height / dpr}px`;
    if (renderRef.current) { try { renderRef.current.cancel(); } catch { /* */ } }
    const task = p.render({ canvasContext: ctx, viewport: vp });
    renderRef.current = task;
    try { await task.promise; } catch { /* cancelled */ }
  }, [pdf, page, scale, rotation]);

  useEffect(() => { render(); }, [render]);

  const runSearch = useCallback(async () => {
    const q = query.trim().toLowerCase();
    if (!pdf || !q) { setMatches([]); setMatchIdx(0); return; }
    setSearching(true);
    const found: number[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const pg = await pdf.getPage(i);
        const tc = await pg.getTextContent();
        const text = tc.items.map((it: any) => ('str' in it ? it.str : '')).join(' ').toLowerCase();
        if (text.includes(q)) found.push(i);
      } catch { /* skip */ }
    }
    setMatches(found); setMatchIdx(0); setSearching(false);
    if (found.length) setPage(found[0]);
  }, [pdf, query]);

  const gotoMatch = (dir: 1 | -1) => {
    if (matches.length === 0) return;
    const next = (matchIdx + dir + matches.length) % matches.length;
    setMatchIdx(next); setPage(matches[next]);
  };

  const download = () => {
    const a = document.createElement('a');
    a.href = url; a.download = fileName || 'document.pdf'; a.target = '_blank';
    document.body.appendChild(a); a.click(); a.remove();
  };

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
          <input value={page} onChange={(e) => { const n = parseInt(e.target.value || '1', 10); if (!isNaN(n)) setPage(Math.min(numPages || 1, Math.max(1, n))); }}
            style={{ width: 38, height: 30, textAlign: 'center', border: `1px solid ${BORDER}`, borderRadius: 7, fontSize: 13 }} />
          <span style={{ fontSize: 12, color: DIM }}>/ {numPages || '–'}</span>
          <button style={tBtn} disabled={page >= numPages} onClick={() => setPage((p) => Math.min(numPages, p + 1))}>›</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button style={tBtn} onClick={() => setScale((s) => Math.max(0.4, +(s - 0.25).toFixed(2)))} title="Zoom out">−</button>
          <button style={{ ...tBtn, fontSize: 11 }} onClick={() => setScale(1)} title="Fit width">{Math.round(scale * 100)}%</button>
          <button style={tBtn} onClick={() => setScale((s) => Math.min(4, +(s + 0.25).toFixed(2)))} title="Zoom in">+</button>
          <button style={tBtn} onClick={() => setRotation((r) => (r + 90) % 360)} title="Rotate">⟳</button>
        </div>
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
          <input value={query} placeholder="Search…" onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
            style={{ height: 30, width: 120, padding: '0 10px', border: `1px solid ${BORDER}`, borderRadius: 7, fontSize: 13, outline: 'none' }} />
          <button style={tBtn} onClick={runSearch} title="Search">{searching ? '…' : '⌕'}</button>
          {matches.length > 0 && (
            <>
              <button style={tBtn} onClick={() => gotoMatch(-1)}>‹</button>
              <span style={{ fontSize: 11, color: DIM, minWidth: 44, textAlign: 'center' }}>{matchIdx + 1}/{matches.length} pg</span>
              <button style={tBtn} onClick={() => gotoMatch(1)}>›</button>
            </>
          )}
          {query && matches.length === 0 && !searching && <span style={{ fontSize: 11, color: DIM }}>no hits</span>}
          <button style={tBtn} onClick={download} title="Download">⬇</button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {showThumbs && pdf && (
          <div style={{ width: 116, flexShrink: 0, overflowY: 'auto', borderRight: `1px solid ${BORDER}`, background: '#fff', padding: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Array.from({ length: numPages }, (_, i) => (
              <Thumb key={i} pdf={pdf} pageNum={i + 1} active={page === i + 1} onClick={() => setPage(i + 1)} />
            ))}
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
            <canvas ref={canvasRef} style={{ display: 'block', borderRadius: 2, boxShadow: '0 2px 12px rgba(0,0,0,0.14)', background: '#fff' }} />
          )}
        </div>
      </div>
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */
