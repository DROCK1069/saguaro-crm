'use client';
/**
 * SplitDocViewer — real, polished side-by-side document review.
 *
 * Two independent panes, each with its own document picker, file-type badge,
 * and (for images) zoom controls. A layout toggle switches between
 * side-by-side and stacked; a swap button flips the two. PDFs render in an
 * iframe (native zoom), images in a zoomable pane. Replaces the old
 * "compare" toast stub.
 */
import React, { useState } from 'react';
import SelectMenu from '../ui/SelectMenu';
import PDFViewer from './PDFViewer';

export interface SplitDoc {
  id: string;
  name: string;
  url: string;
  mime?: string;
}

type Kind = 'pdf' | 'image' | 'other';

function kindOf(d: SplitDoc | undefined): Kind {
  if (!d) return 'other';
  const s = `${d.name} ${d.url} ${d.mime || ''}`.toLowerCase();
  if (s.includes('pdf')) return 'pdf';
  if (/\.(png|jpe?g|gif|webp|tiff?|bmp|svg)(\?|$|["' ])/.test(s) || s.includes('image/')) return 'image';
  return 'other';
}

const GOLD = '#C8881C';
const BASE = '#F2F2F7';
const BORDER = '#E5E5EA';
const TEXT = '#1C1C1E';
const DIM = '#6E6E73';
const BLUE = '#3B82F6';
const GREEN = '#22C55E';

const kindBadge: Record<Kind, { label: string; color: string }> = {
  pdf: { label: 'PDF', color: '#EF4444' },
  image: { label: 'IMG', color: BLUE },
  other: { label: 'FILE', color: DIM },
};

function Pane({
  docs, value, onChange, side,
}: {
  docs: SplitDoc[];
  value: string;
  onChange: (id: string) => void;
  side: 'left' | 'right';
}) {
  const [zoom, setZoom] = useState(1);
  const doc = docs.find((d) => d.id === value);
  const kind = kindOf(doc);
  const accent = side === 'left' ? BLUE : GREEN;
  const badge = kindBadge[kind];

  const zBtn: React.CSSProperties = {
    width: 26, height: 26, borderRadius: 7, border: `1px solid ${BORDER}`, background: '#fff',
    color: TEXT, cursor: 'pointer', fontSize: 14, fontWeight: 700, lineHeight: 1, display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center',
  };

  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#fff' }}>
      {/* Pane header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderBottom: `1px solid ${BORDER}`, background: BASE }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: accent, borderRadius: 5, padding: '2px 6px', flexShrink: 0 }}>
          {side === 'left' ? 'A' : 'B'}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <SelectMenu
            aria-label={`Document ${side === 'left' ? 'A' : 'B'}`}
            value={value}
            onChange={(v) => { onChange(v); setZoom(1); }}
            placeholder="Select a document…"
            minWidth={100}
            triggerStyle={{ width: '100%', fontSize: 12, padding: '6px 10px' }}
            options={docs.map((d) => ({ value: d.id, label: d.name }))}
          />
        </div>
        <span style={{ fontSize: 9, fontWeight: 800, color: badge.color, background: `${badge.color}1a`, border: `1px solid ${badge.color}33`, borderRadius: 5, padding: '2px 6px', flexShrink: 0 }}>
          {badge.label}
        </span>
        {kind === 'image' && (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <button style={zBtn} title="Zoom out" onClick={() => setZoom((z) => Math.max(0.25, +(z - 0.25).toFixed(2)))}>−</button>
            <button style={{ ...zBtn, width: 'auto', padding: '0 8px', fontSize: 11 }} title="Fit" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
            <button style={zBtn} title="Zoom in" onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}>+</button>
          </div>
        )}
      </div>

      {/* Pane body — independent scroll */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: '#fff', WebkitOverflowScrolling: 'touch' }}>
        {!doc || !doc.url ? (
          <div style={{ padding: 24, textAlign: 'center', color: DIM, fontSize: 13 }}>No document selected.</div>
        ) : kind === 'pdf' ? (
          <PDFViewer url={doc.url} fileName={doc.name} height="100%" />
        ) : kind === 'image' ? (
          <div style={{ minHeight: '100%', display: 'flex', justifyContent: 'center', padding: 8 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={doc.url} alt={doc.name} style={{ width: `${zoom * 100}%`, maxWidth: zoom <= 1 ? '100%' : 'none', height: 'auto', display: 'block', alignSelf: 'flex-start' }} />
          </div>
        ) : (
          <div style={{ padding: 24, textAlign: 'center', color: DIM, fontSize: 13 }}>
            <div style={{ marginBottom: 10 }}>Inline preview isn&apos;t available for this file type.</div>
            <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ color: GOLD, fontWeight: 700, textDecoration: 'none' }}>Open / download →</a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SplitDocViewer({
  docs, initialLeftId, initialRightId, onClose,
}: {
  docs: SplitDoc[];
  initialLeftId?: string;
  initialRightId?: string;
  onClose: () => void;
}) {
  const [leftId, setLeftId] = useState(initialLeftId || docs[0]?.id || '');
  const [rightId, setRightId] = useState(
    initialRightId || docs.find((d) => d.id !== (initialLeftId || docs[0]?.id))?.id || docs[0]?.id || '',
  );
  const [stacked, setStacked] = useState(false);

  const swap = () => { setLeftId(rightId); setRightId(leftId); };

  const hBtn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8,
    border: `1px solid ${BORDER}`, background: '#fff', color: TEXT, fontSize: 12, fontWeight: 600, cursor: 'pointer',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: BASE, display: 'flex', flexDirection: 'column', paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, background: '#fff', flexShrink: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: TEXT }}>Side-by-Side Review</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setStacked((s) => !s)} style={hBtn} title={stacked ? 'Side by side' : 'Stack'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {stacked ? (<><rect x="3" y="4" width="8" height="16" rx="1" /><rect x="13" y="4" width="8" height="16" rx="1" /></>) : (<><rect x="4" y="3" width="16" height="8" rx="1" /><rect x="4" y="13" width="16" height="8" rx="1" /></>)}
            </svg>
            {stacked ? 'Columns' : 'Stack'}
          </button>
          <button onClick={swap} style={hBtn} title="Swap">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>
            Swap
          </button>
          <button onClick={onClose} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: GOLD, color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Done</button>
        </div>
      </div>

      {/* Panes */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: stacked ? 'column' : 'row' }}>
        <Pane docs={docs} value={leftId} onChange={setLeftId} side="left" />
        <div style={{ background: BORDER, flexShrink: 0, ...(stacked ? { height: 1, width: '100%' } : { width: 1, height: '100%' }) }} />
        <Pane docs={docs} value={rightId} onChange={setRightId} side="right" />
      </div>
    </div>
  );
}
