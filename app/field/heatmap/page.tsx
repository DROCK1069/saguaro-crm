'use client';
/**
 * LEGACY ROUTE — Signal Studio moved into the /app shell.
 *
 * The full designer now lives at /app/signal-studio (component:
 * components/signal-studio/Designer.tsx, extracted wholesale from this page).
 * This stub exists ONLY so every legacy /field/heatmap link — bookmarks, QR
 * codes, in-app buttons, shared URLs — keeps working: it forwards to the new
 * route with the ENTIRE query string preserved (?projectId= included).
 */
import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LegacyHeatmapRedirect() {
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => {
    const qs = params.toString();
    router.replace(qs ? `/app/signal-studio?${qs}` : '/app/signal-studio');
  }, [router, params]);
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#CBD5E1', fontSize: 13, fontWeight: 600 }}>
      Opening Signal Studio…
    </div>
  );
}

export default function HeatmapDesigner() {
  // useSearchParams requires a Suspense boundary in the app router
  return (
    <Suspense fallback={null}>
      <LegacyHeatmapRedirect />
    </Suspense>
  );
}
