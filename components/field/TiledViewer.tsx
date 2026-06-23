'use client';
/**
 * TiledViewer — deep-zoom drawing viewer for huge sheets.
 *
 * Streams a DZI tile pyramid via OpenSeadragon so a 50MB / 4000px+ sheet pans
 * and zooms instantly (only the visible tiles load). SSR-safe dynamic import.
 */
import React, { useEffect, useRef } from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function TiledViewer({ dziUrl, height = 480 }: { dziUrl: string; height?: number | string }) {
  const ref = useRef<HTMLDivElement>(null);
  const viewer = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const OpenSeadragon = (await import('openseadragon')).default;
      if (cancelled || !ref.current) return;
      viewer.current = OpenSeadragon({
        element: ref.current,
        prefixUrl: '/osd/images/',
        tileSources: dziUrl,
        showNavigator: true,
        navigatorPosition: 'TOP_RIGHT',
        visibilityRatio: 1,
        minZoomImageRatio: 0.8,
        gestureSettingsTouch: { pinchToZoom: true, flickEnabled: true },
        gestureSettingsMouse: { scrollToZoom: true },
      });
    })();
    return () => { cancelled = true; try { viewer.current?.destroy(); } catch { /* */ } };
  }, [dziUrl]);

  return <div ref={ref} style={{ width: '100%', height, background: '#fff', borderRadius: 10, border: '1px solid #E5E5EA', overflow: 'hidden' }} />;
}
