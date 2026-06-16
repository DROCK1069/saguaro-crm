'use client';
import { useState } from 'react';
import { SiQuickbooks, SiStripe, SiXero, SiSage, SiAutodesk } from 'react-icons/si';
import type { IconType } from 'react-icons';

// Real vendor logos load from /public/vendors/<slug>.png (official brand-kit assets
// you drop in). Until a file exists, each falls back to a recognizable mark so the
// strip is NEVER broken. We only list integrations we actually ship.
type Vendor = { slug: string; name: string; color: string; Icon?: IconType };

const VENDORS: Vendor[] = [
  { slug: 'quickbooks', name: 'QuickBooks', color: '#2CA01C', Icon: SiQuickbooks },
  { slug: 'stripe', name: 'Stripe', color: '#635BFF', Icon: SiStripe },
  { slug: 'xero', name: 'Xero', color: '#13B5EA', Icon: SiXero },
  { slug: 'sage', name: 'Sage', color: '#00D639', Icon: SiSage },
  { slug: 'docusign', name: 'DocuSign', color: '#1C1C1E' },
  { slug: 'autodesk', name: 'Autodesk', color: '#1C1C1E', Icon: SiAutodesk },
];

function VendorLogo({ slug, name, color, Icon }: Vendor) {
  const [failed, setFailed] = useState(false);
  if (!failed) {
    // Real official logo, once dropped in /public/vendors/<slug>.png
    return (
      <img
        src={`/vendors/${slug}.png`}
        alt={name}
        style={{ height: 30, width: 'auto', objectFit: 'contain', display: 'block' }}
        onError={() => setFailed(true)}
      />
    );
  }
  // Fallback until the official asset is added.
  return Icon
    ? <Icon size={32} color={color} aria-label={name} />
    : <span style={{ fontSize: 19, fontWeight: 800, color, letterSpacing: '-0.01em' }} aria-label={name}>{name}</span>;
}

export function IntegrationStrip({
  heading = 'Integrates with the tools you already use',
}: {
  heading?: string;
}) {
  return (
    <div style={{ padding: '36px 0', borderTop: '1px solid #E5E5EA', borderBottom: '1px solid #E5E5EA' }}>
      <div style={{ textAlign: 'center', color: '#86868B', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 26, fontWeight: 600 }}>
        {heading}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 46, flexWrap: 'wrap', maxWidth: 1000, margin: '0 auto', padding: '0 24px' }}>
        {VENDORS.map((v) => (
          <div key={v.slug} title={v.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 36 }}>
            <VendorLogo {...v} />
          </div>
        ))}
      </div>
    </div>
  );
}
