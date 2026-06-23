'use client';
/**
 * ModelViewer3D — real, polished 3D model viewer for the BIM page.
 *
 * Google <model-viewer> with studio lighting, orbit/zoom/pan, auto-rotate
 * (toggle), reset-view, fullscreen, and AR on supported devices. SSR-safe:
 * the web component is imported on the client only.
 */
import React, { useEffect, useRef, useState } from 'react';

const GOLD = '#C8881C';
const DIM = '#6E6E73';
const BORDER = '#E5E5EA';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function ModelViewer3D({
  src,
  alt,
  height = 300,
}: {
  src: string;
  alt?: string;
  height?: number;
}) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [rotating, setRotating] = useState(true);
  const mvRef = useRef<any>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    import('@google/model-viewer')
      .then(() => { if (active) setReady(true); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);

  const resetView = () => {
    const el = mvRef.current;
    if (!el) return;
    el.cameraOrbit = '0deg 75deg 105%';
    el.fieldOfView = 'auto';
    if (typeof el.resetTurntableRotation === 'function') el.resetTurntableRotation();
  };

  const toggleRotate = () => {
    const el = mvRef.current;
    if (!el) return;
    const next = !rotating;
    el.autoRotate = next;
    setRotating(next);
  };

  const fullscreen = () => {
    const node = wrapRef.current;
    if (!node) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else node.requestFullscreen?.().catch(() => {});
  };

  const box: React.CSSProperties = {
    width: '100%', height, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(160deg,#FFFFFF,#F2F2F7)', color: DIM, fontSize: 13,
  };

  if (failed) return <div style={box}>3D viewer could not load.</div>;
  if (!ready) {
    return (
      <div style={box}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 16, height: 16, border: `2px solid ${BORDER}`, borderTopColor: GOLD, borderRadius: '50%', animation: 'mvspin .8s linear infinite' }} />
          Loading 3D viewer…
        </span>
        <style>{`@keyframes mvspin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  const ctrlBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 34, height: 34, borderRadius: 9, border: `1px solid ${BORDER}`,
    background: 'rgba(255,255,255,0.92)', color: '#1C1C1E', cursor: 'pointer',
    backdropFilter: 'blur(8px)',
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height, background: 'linear-gradient(160deg,#FFFFFF,#EEF1F6)', borderRadius: 12, overflow: 'hidden' }}>
      {React.createElement('model-viewer', {
        ref: mvRef,
        src,
        alt: alt || '3D model',
        'camera-controls': '',
        'auto-rotate': rotating ? '' : undefined,
        'auto-rotate-delay': '0',
        'rotation-per-second': '18deg',
        'touch-action': 'pan-y',
        'interaction-prompt': 'none',
        'shadow-intensity': '1.1',
        'shadow-softness': '0.9',
        'environment-image': 'neutral',
        exposure: '1.05',
        'tone-mapping': 'neutral',
        ar: '',
        'ar-modes': 'webxr scene-viewer quick-look',
        loading: 'eager',
        style: { width: '100%', height: '100%', background: 'transparent', display: 'block' } as React.CSSProperties,
      })}

      {/* Control bar */}
      <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 6 }}>
        <button onClick={toggleRotate} title={rotating ? 'Pause rotation' : 'Auto-rotate'} style={{ ...ctrlBtn, color: rotating ? GOLD : '#1C1C1E' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
        </button>
        <button onClick={resetView} title="Reset view" style={ctrlBtn}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
        </button>
        <button onClick={fullscreen} title="Fullscreen" style={ctrlBtn}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
        </button>
      </div>
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */
