'use client';
/**
 * ModelViewer3D — real 3D model viewer for the BIM page.
 *
 * Renders a GLB model with orbit/zoom/pan controls using Google's
 * <model-viewer> web component. Replaces the empty "3D viewer placeholder"
 * canvas. SSR-safe: the web component is dynamically imported on the client
 * only (it touches browser APIs / customElements).
 */
import React, { useEffect, useState } from 'react';

export default function ModelViewer3D({
  src,
  alt,
  height = 280,
}: {
  src: string;
  alt?: string;
  height?: number;
}) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    import('@google/model-viewer')
      .then(() => { if (active) setReady(true); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);

  const box: React.CSSProperties = {
    width: '100%',
    height,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#fff',
    color: '#6E6E73',
    fontSize: 13,
  };

  if (failed) return <div style={box}>3D viewer could not load.</div>;
  if (!ready) return <div style={box}>Loading 3D viewer…</div>;

  // Use createElement so we don't need JSX typings for the custom element.
  return React.createElement('model-viewer', {
    src,
    alt: alt || '3D model',
    'camera-controls': '',
    'auto-rotate': '',
    'touch-action': 'pan-y',
    'shadow-intensity': '1',
    exposure: '1.0',
    'interaction-prompt': 'none',
    loading: 'eager',
    style: {
      width: '100%',
      height,
      background: '#fff',
      display: 'block',
      borderRadius: 12,
    } as React.CSSProperties,
  });
}
