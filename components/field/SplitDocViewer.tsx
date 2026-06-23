'use client';
/**
 * SplitDocViewer — real side-by-side document review for the field app.
 *
 * Renders TWO documents at once in independent panes (each its own iframe for
 * PDFs / <img> for images), with a per-pane document picker, a swap button,
 * and independent scroll/zoom. Replaces the old "compare" toast stub
 * (`// In a real app, this would open a comparison viewer`).
 *
 * It is intentionally self-contained: pass the real file list and it works.
 */
import React, { useState } from 'react';
import SelectMenu from '../ui/SelectMenu';

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

function Pane({
  docs,
  value,
  onChange,
  side,
}: {
  docs: SplitDoc[];
  value: string;
  onChange: (id: string) => void;
  side: 'left' | 'right';
}) {
  const doc = docs.find((d) => d.id === value);
  const kind = kindOf(doc);
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#fff' }}>
      {/* Pane header with document picker */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          borderBottom: `1px solid ${BORDER}`,
          background: BASE,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: side === 'left' ? '#3B82F6' : '#22C55E',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            flexShrink: 0,
          }}
        >
          {side === 'left' ? 'A' : 'B'}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <SelectMenu
            aria-label={`Document ${side === 'left' ? 'A' : 'B'}`}
            value={value}
            onChange={onChange}
            placeholder="Select a document…"
            minWidth={120}
            triggerStyle={{ width: '100%', fontSize: 12, padding: '7px 10px' }}
            options={docs.map((d) => ({ value: d.id, label: d.name }))}
          />
        </div>
      </div>

      {/* Pane body — independent scroll per side */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: '#fff', WebkitOverflowScrolling: 'touch' }}>
        {!doc || !doc.url ? (
          <div style={{ padding: 24, textAlign: 'center', color: DIM, fontSize: 13 }}>No document selected.</div>
        ) : kind === 'pdf' ? (
          <iframe
            title={doc.name}
            src={doc.url}
            style={{ width: '100%', height: '100%', minHeight: '60vh', border: 'none', background: '#fff' }}
          />
        ) : kind === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={doc.url} alt={doc.name} style={{ width: '100%', height: 'auto', display: 'block' }} />
        ) : (
          <div style={{ padding: 24, textAlign: 'center', color: DIM, fontSize: 13 }}>
            <div style={{ marginBottom: 10 }}>Inline preview isn&apos;t available for this file type.</div>
            <a
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: GOLD, fontWeight: 700, textDecoration: 'none' }}
            >
              Open / download →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SplitDocViewer({
  docs,
  initialLeftId,
  initialRightId,
  onClose,
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

  const swap = () => {
    setLeftId(rightId);
    setRightId(leftId);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: BASE,
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: `1px solid ${BORDER}`,
          background: '#fff',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 800, color: TEXT }}>Side-by-Side Review</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={swap}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 12px',
              borderRadius: 8,
              border: `1px solid ${BORDER}`,
              background: '#fff',
              color: TEXT,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
            Swap
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '7px 14px',
              borderRadius: 8,
              border: 'none',
              background: GOLD,
              color: '#000',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </div>

      {/* Two panes side by side */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <Pane docs={docs} value={leftId} onChange={setLeftId} side="left" />
        <div style={{ width: 1, background: BORDER, flexShrink: 0 }} />
        <Pane docs={docs} value={rightId} onChange={setRightId} side="right" />
      </div>
    </div>
  );
}
