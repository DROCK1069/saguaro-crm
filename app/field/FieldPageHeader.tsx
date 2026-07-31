'use client';
/**
 * FieldPageHeader — the one shared header for every /field screen.
 * Uniform back control + title (+ optional subtitle + right-aligned actions),
 * so screens stop hand-rolling divergent headers. Professional weight (600, not 800).
 */
import React from 'react';
import { useRouter } from 'next/navigation';

const TEXT = '#FFFFFF';
const DIM = '#CBD5E1';

export default function FieldPageHeader({
  title,
  subtitle,
  actions,
  backHref,
  onBack,
  icon,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  backHref?: string;
  /** custom back handler — overrides backHref/router.back(); for screens whose
   *  back does in-page view switching (setView('list')) instead of navigating. */
  onBack?: () => void;
  /** optional raw SVG string (e.g. a bespoke field icon) shown in a steel badge */
  icon?: string;
}) {
  const router = useRouter();
  return (
    <div className="fld-ph">
      <button
        className="fld-ph-back"
        onClick={() => { if (onBack) { onBack(); } else if (backHref) { router.push(backHref); } else { router.back(); } }}
        aria-label="Back"
      >
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
      </button>
      <div className="fld-ph-row">
        <div className="fld-ph-titles">
          {icon && <span className="fld-ph-icon" dangerouslySetInnerHTML={{ __html: icon }} />}
          <div style={{ minWidth: 0 }}>
            <h1 className="fld-ph-title">{title}</h1>
            {subtitle && <p className="fld-ph-sub">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="fld-ph-actions">{actions}</div>}
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        .fld-ph { padding: 16px 16px 12px; }
        .fld-ph-back { background: none; border: none; color: ${TEXT}; cursor: pointer; padding: 4px; margin: 0 0 8px -4px; display: inline-flex; }
        .fld-ph-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .fld-ph-titles { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .fld-ph-icon { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: linear-gradient(160deg,#1b2330,#141b26); border: 1px solid rgba(255,255,255,0.08); flex-shrink: 0; }
        .fld-ph-icon svg { display: block; }
        .fld-ph-title { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.02em; color: ${TEXT}; line-height: 1.15; }
        .fld-ph-sub { margin: 3px 0 0; font-size: 13px; color: ${DIM}; }
        .fld-ph-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        @media (min-width: 1000px) { .fld-ph { padding: 22px 28px 16px; } }
      ` }} />
    </div>
  );
}
