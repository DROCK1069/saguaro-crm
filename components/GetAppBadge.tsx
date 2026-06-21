'use client';
import { useState } from 'react';

const TESTFLIGHT = 'https://testflight.apple.com/join/jg7jdtwx';

// During the open beta the app ships via TestFlight (Apple's official beta
// distribution), not the public App Store — so we show an Apple-style
// "Available on TestFlight" badge for accurate, recognizable Apple branding.
export function GetAppBadge() {
  const [noBadge, setNoBadge] = useState(false);
  if (!noBadge) {
    return (
      <a href={TESTFLIGHT} target="_blank" rel="noopener noreferrer" aria-label="Get Saguaro Field on TestFlight">
        <img
          src="/badges/testflight.svg"
          alt="Available on TestFlight"
          style={{ height: 52, width: 'auto', display: 'block' }}
          onError={() => setNoBadge(true)}
        />
      </a>
    );
  }
  return (
    <a
      href={TESTFLIGHT}
      target="_blank"
      rel="noopener noreferrer"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#C8881C', color: '#000', textDecoration: 'none', fontWeight: 700, fontSize: 15, padding: '14px 28px', borderRadius: 10, boxShadow: '0 4px 20px rgba(212,160,23,0.35)' }}
    >
      Join the iOS Beta →
    </a>
  );
}
