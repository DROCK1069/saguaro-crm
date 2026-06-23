'use client';
/**
 * TiledViewer — deep-zoom drawing viewer for huge sheets.
 *
 * Streams a DZI tile pyramid via OpenSeadragon so a 50MB / 4000px+ sheet pans
 * and zooms instantly (only the visible tiles load).
 *
 * Tiles live in a PRIVATE storage bucket, served through an authenticated proxy
 * (/api/drawings/sheets/<id>/tile/...). We mint a short-lived signed token for
 * the sheet and embed it in the descriptor + every tile URL, so the main viewer,
 * the navigator/minimap, and any <img> fallback are all authorized uniformly.
 * SSR-safe dynamic import.
 */
import React, { useEffect, useRef, useState } from 'react';
import { getAuthHeaders } from '@/lib/supabase-browser';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface DziMeta { width: number; height: number; tileSize: number; overlap: number; format: string }

function parseDzi(xml: string): DziMeta | null {
  const tile = xml.match(/TileSize="(\d+)"/);
  const overlap = xml.match(/Overlap="(\d+)"/);
  const fmt = xml.match(/Format="([^"]+)"/);
  const w = xml.match(/Width="(\d+)"/);
  const h = xml.match(/Height="(\d+)"/);
  if (!tile || !w || !h) return null;
  return {
    width: parseInt(w[1], 10),
    height: parseInt(h[1], 10),
    tileSize: parseInt(tile[1], 10),
    overlap: overlap ? parseInt(overlap[1], 10) : 1,
    format: fmt ? fmt[1] : 'jpeg',
  };
}

export default function TiledViewer({ sheetId, descriptorUrl, height = 480 }: { sheetId?: string; descriptorUrl?: string; height?: number | string }) {
  const ref = useRef<HTMLDivElement>(null);
  const viewer = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();

        // Resolve a signed descriptor URL. Prefer minting fresh by sheetId so the
        // token is current; fall back to a pre-built descriptorUrl prop.
        let url = descriptorUrl || '';
        if (sheetId) {
          const tk = await fetch(`/api/drawings/sheets/${sheetId}/tile-token`, { headers });
          if (!tk.ok) throw new Error(tk.status === 409 ? 'tiles still processing' : `token ${tk.status}`);
          url = (await tk.json()).descriptorUrl;
        }
        if (!url) throw new Error('no descriptor');

        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error(`descriptor ${res.status}`);
        const meta = parseDzi(await res.text());
        if (!meta) throw new Error('unreadable descriptor');
        if (cancelled || !ref.current) return;

        // Split "<base>.dzi?t=token" → base path + query so the token rides on every tile URL.
        const [pathPart, query] = url.split('?');
        const base = pathPart.replace(/\.dzi$/, ''); // tiles at <base>_files/<level>/<x>_<y>.<format>
        const qs = query ? `?${query}` : '';
        const maxLevel = Math.ceil(Math.log2(Math.max(meta.width, meta.height)));

        const OpenSeadragon = (await import('openseadragon')).default;
        if (cancelled || !ref.current) return;
        viewer.current = OpenSeadragon({
          element: ref.current,
          prefixUrl: '/osd/images/',
          showNavigator: true,
          navigatorPosition: 'TOP_RIGHT',
          visibilityRatio: 1,
          minZoomImageRatio: 0.8,
          gestureSettingsTouch: { pinchToZoom: true, flickEnabled: true },
          gestureSettingsMouse: { scrollToZoom: true },
          tileSources: {
            width: meta.width,
            height: meta.height,
            tileSize: meta.tileSize,
            tileOverlap: meta.overlap,
            minLevel: 0,
            maxLevel,
            getTileUrl: (level: number, x: number, y: number) =>
              `${base}_files/${level}/${x}_${y}.${meta.format}${qs}`,
          },
        });
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load drawing');
      }
    })();
    return () => { cancelled = true; try { viewer.current?.destroy(); } catch { /* */ } };
  }, [sheetId, descriptorUrl]);

  if (error) {
    return (
      <div style={{ width: '100%', height, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', borderRadius: 10, border: '1px solid #E5E5EA', color: '#8E8E93', fontSize: 14 }}>
        Couldn’t load tiled drawing ({error})
      </div>
    );
  }
  return <div ref={ref} style={{ width: '100%', height, background: '#fff', borderRadius: 10, border: '1px solid #E5E5EA', overflow: 'hidden' }} />;
}
