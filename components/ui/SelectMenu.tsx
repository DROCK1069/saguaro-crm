'use client';
/**
 * SelectMenu — a custom dropdown that renders an anchored menu which drops
 * DOWN from the trigger (like native desktop/app dropdowns), instead of the
 * iOS native <select> behavior that docks a wheel-picker to the bottom of the
 * screen. Drop-in replacement for a simple <select> of string options.
 *
 * Why this exists: in the Capacitor iOS WebView, native <select> elements
 * always open as a bottom sheet/picker. This component gives the "real app"
 * drop-down feel and consistent styling across web + iOS.
 */
import React, { useEffect, useId, useRef, useState } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectMenuProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  /** Style overrides for the trigger button (matches the old <select> look). */
  triggerStyle?: React.CSSProperties;
  minWidth?: number;
  'aria-label'?: string;
}

const GOLD = '#C8881C';
const HAIRLINE = '#E5E5EA';
const TEXT = '#1C1C1E';
const DIM = '#6E6E73';

export default function SelectMenu({
  value,
  options,
  onChange,
  placeholder = 'Select…',
  triggerStyle,
  minWidth = 150,
  ...rest
}: SelectMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const selected = options.find((o) => o.value === value);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent | TouchEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={rest['aria-label']}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '9px 12px',
          background: '#FFFFFF',
          border: `1px solid ${HAIRLINE}`,
          borderRadius: 10,
          color: selected ? TEXT : DIM,
          fontSize: 13,
          cursor: 'pointer',
          outline: 'none',
          minWidth,
          fontFamily: 'inherit',
          ...triggerStyle,
        }}
      >
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke={DIM}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}
          aria-hidden
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          id={id}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            margin: 0,
            padding: 4,
            listStyle: 'none',
            background: '#FFFFFF',
            border: `1px solid ${HAIRLINE}`,
            borderRadius: 10,
            boxShadow: '0 12px 32px rgba(0,0,0,0.14)',
            minWidth: '100%',
            maxHeight: 280,
            overflowY: 'auto',
            zIndex: 9999,
          }}
        >
          {options.map((opt) => {
            const isSel = opt.value === value;
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSel}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '9px 10px',
                  borderRadius: 7,
                  fontSize: 13,
                  color: TEXT,
                  cursor: 'pointer',
                  background: isSel ? 'rgba(200,136,28,0.10)' : 'transparent',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  if (!isSel) e.currentTarget.style.background = 'rgba(0,0,0,0.04)';
                }}
                onMouseLeave={(e) => {
                  if (!isSel) e.currentTarget.style.background = 'transparent';
                }}
              >
                <span>{opt.label}</span>
                {isSel && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
