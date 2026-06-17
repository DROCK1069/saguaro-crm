'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';

const SAGUARO_GOLD = '#C8881C';

export interface WhiteLabelBranding {
  logoUrl: string;
  primaryColor: string;
  companyName: string;
  whiteLabelEnabled: boolean;
}

const defaults: WhiteLabelBranding = {
  logoUrl: '',
  primaryColor: SAGUARO_GOLD,
  companyName: '',
  whiteLabelEnabled: false,
};

const WhiteLabelContext = createContext<WhiteLabelBranding>(defaults);

export function useWhiteLabel(): WhiteLabelBranding {
  return useContext(WhiteLabelContext);
}

// Only accept a plain hex color (#rgb / #rrggbb). Anything else is ignored so a
// stored value can never inject arbitrary CSS via setProperty.
function safeHex(v: unknown): string | null {
  return typeof v === 'string' && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v.trim()) ? v.trim() : null;
}

// Override the single --brand-primary token (+ the derived strong/hover/alpha
// vars that globals.css and design-tokens.ts resolve through), so one color
// reskins the whole app.
function applyBrandColor(c: string) {
  const root = document.documentElement.style;
  root.setProperty('--brand-primary', c);
  root.setProperty('--brand-primary-strong', `color-mix(in srgb, ${c} 78%, white)`);
  root.setProperty('--brand-primary-hover', `color-mix(in srgb, ${c} 84%, black)`);
  root.setProperty('--brand-primary-12', `color-mix(in srgb, ${c} 12%, transparent)`);
  root.setProperty('--brand-primary-18', `color-mix(in srgb, ${c} 18%, transparent)`);
  root.setProperty('--brand-primary-25', `color-mix(in srgb, ${c} 25%, transparent)`);
  root.setProperty('--brand-primary-35', `color-mix(in srgb, ${c} 35%, transparent)`);
}

export default function WhiteLabelProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<WhiteLabelBranding>(defaults);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/branding/tenant');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        const enabled = !!data.white_label_enabled;
        const hex = safeHex(data.primary_color);

        setBranding({
          logoUrl: typeof data.logo_url === 'string' ? data.logo_url : '',
          primaryColor: hex ?? SAGUARO_GOLD,
          companyName: typeof data.name === 'string' ? data.name : '',
          whiteLabelEnabled: enabled,
        });

        // App-chrome reskin is gated to the white-label tier. Without it the app
        // stays fully Saguaro (the :root defaults are untouched).
        if (enabled && hex) applyBrandColor(hex);
      } catch {
        // Silently keep Saguaro defaults.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <WhiteLabelContext.Provider value={branding}>
      {children}
    </WhiteLabelContext.Provider>
  );
}
