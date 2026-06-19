'use client';
/**
 * Saguaro Field — More (account & settings).
 * The full tool directory now lives at /field/tools; this is the slim
 * account/settings/office surface (5th bottom-nav tab).
 */
import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

const GOLD = '#D4A017', RAISED = 'rgba(255,255,255,0.03)', BORDER = 'rgba(255,255,255,0.06)';
const TEXT = '#F5F5F7', DIM = '#86868B';

const ICON = {
  download: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={20} height={20}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1={12} y1={15} x2={12} y2={3} /></svg>,
  bell: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={20} height={20}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>,
  grid: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={20} height={20}><rect x={3} y={3} width={7} height={7} rx={1} /><rect x={14} y={3} width={7} height={7} rx={1} /><rect x={3} y={14} width={7} height={7} rx={1} /><rect x={14} y={14} width={7} height={7} rx={1} /></svg>,
  desktop: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={20} height={20}><rect x={2} y={3} width={20} height={14} rx={2} /><line x1={8} y1={21} x2={16} y2={21} /><line x1={12} y1={17} x2={12} y2={21} /></svg>,
};

const DESKTOP = [
  { label: 'All Projects', href: '/app/projects' },
  { label: 'Documents', href: '/app/documents' },
  { label: 'Reports', href: '/app/reports' },
  { label: 'AI Autopilot', href: '/app/autopilot' },
  { label: 'Bids', href: '/app/bids' },
];

function MoreInner() {
  const sp = useSearchParams();
  const projectId = sp.get('projectId') || '';
  const q = projectId ? `?projectId=${projectId}` : '';

  const Row = ({ href, icon, label, sub, external }: { href: string; icon: React.ReactNode; label: string; sub?: string; external?: boolean }) => (
    <a href={href} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: `1px solid ${BORDER}`, color: TEXT, textDecoration: 'none' }}>
      <span style={{ color: GOLD, display: 'flex', alignItems: 'center', flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 600 }}>{label}</span>
        {sub && <span style={{ display: 'block', fontSize: 12, color: DIM, marginTop: 1 }}>{sub}</span>}
      </span>
      <span style={{ color: DIM, fontSize: 16 }}>{external ? '↗' : '›'}</span>
    </a>
  );

  return (
    <div style={{ padding: '18px 16px' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800, color: TEXT }}>More</h1>
      <p style={{ margin: '0 0 16px', fontSize: 14, color: DIM }}>Account, app &amp; office tools</p>

      <p style={sLbl}>App</p>
      <div style={{ background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden', marginBottom: 18 }}>
        <a href={`/field/tools${q}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: `1px solid ${BORDER}`, color: TEXT, textDecoration: 'none' }}>
          <span style={{ color: GOLD, display: 'flex', flexShrink: 0 }}>{ICON.grid}</span>
          <span style={{ flex: 1 }}><span style={{ display: 'block', fontSize: 15, fontWeight: 600 }}>All Tools</span><span style={{ display: 'block', fontSize: 12, color: DIM }}>The full field tool directory</span></span>
          <span style={{ color: DIM, fontSize: 16 }}>›</span>
        </a>
        <Row href="/field/install" icon={ICON.download} label="Install App" sub="Add to home screen — works offline" />
        <a href={`/field/more/notifications${q}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', color: TEXT, textDecoration: 'none' }}>
          <span style={{ color: GOLD, display: 'flex', flexShrink: 0 }}>{ICON.bell}</span>
          <span style={{ flex: 1 }}><span style={{ display: 'block', fontSize: 15, fontWeight: 600 }}>Notifications</span><span style={{ display: 'block', fontSize: 12, color: DIM }}>Push alerts &amp; preferences</span></span>
          <span style={{ color: DIM, fontSize: 16 }}>›</span>
        </a>
      </div>

      <p style={sLbl}>Office (Desktop)</p>
      <div style={{ background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden', marginBottom: 18 }}>
        {DESKTOP.map((l, i) => (
          <a key={l.href} href={l.href} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: i < DESKTOP.length - 1 ? `1px solid ${BORDER}` : 'none', color: TEXT, textDecoration: 'none' }}>
            <span style={{ color: DIM, display: 'flex', flexShrink: 0 }}>{ICON.desktop}</span>
            <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{l.label}</span>
            <span style={{ color: DIM, fontSize: 16 }}>↗</span>
          </a>
        ))}
      </div>

      <p style={{ textAlign: 'center', fontSize: 11, color: DIM, margin: '8px 0 0' }}>Saguaro Field</p>
    </div>
  );
}

export default function FieldMorePage() {
  return <Suspense fallback={<div style={{ padding: 32, color: DIM, textAlign: 'center' }}>Loading…</div>}><MoreInner /></Suspense>;
}

const sLbl: React.CSSProperties = { margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: DIM, textTransform: 'uppercase', letterSpacing: 0.8 };
