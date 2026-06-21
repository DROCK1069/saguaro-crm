'use client';
import React, { useEffect, useState, useRef } from 'react';
import { DeviceMobile } from '@phosphor-icons/react';

const GOLD  = '#F59E0B';
const DARK  = '#F2F2F7';
const RAISED = '#FFFFFF';
const BORDER = '#E5E5EA';
const DIM   = '#6E6E73';
const TEXT  = '#1C1C1E';
const GREEN = '#22c55e';
const RED   = '#ef4444';

interface SubInfo {
  plan_name: string;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
}

const SETTINGS_SECTIONS = [
  {
    title: 'Account & Billing',
    items: [
      { icon: '💳', label: 'Subscription & Plan', desc: 'Manage your plan, upgrade, view invoices', href: '/app/billing', highlight: true },
      { icon: '📱', label: 'Get the iOS App', desc: 'Download Saguaro Field for iPhone & iPad from the App Store', href: '/get-the-app' },
      { icon: '🔔', label: 'Notifications', desc: 'Configure email and push notification preferences', href: '/app/notification-settings' },
    ],
  },
  {
    title: 'Team & Permissions',
    items: [
      { icon: '👥', label: 'Roles & Permissions', desc: 'Control what each team role can access', href: '/app/roles-permissions' },
      { icon: '🔑', label: 'API Access', desc: 'Generate API keys for integrations', href: '/app/billing' },
    ],
  },
  {
    title: 'Compliance & Documents',
    items: [
      { icon: '📋', label: 'Custom Fields', desc: 'Add custom fields to projects, contacts, and bids', href: '/app/custom-fields' },
      { icon: '📄', label: 'Document Templates', desc: 'Manage your company document templates', href: '/app/documents' },
      { icon: '⚙️', label: 'Autopilot Rules', desc: 'Configure RFI, change order, and approval automations', href: '/app/autopilot' },
    ],
  },
  {
    title: 'Support & Resources',
    items: [
      { icon: '🚀', label: 'Free Migration', desc: 'Migrate your data from Procore, Buildertrend, or any platform', href: 'mailto:support@saguarocontrol.net?subject=Migration Request' },
      { icon: '🎓', label: 'Guided Onboarding', desc: 'Book a hands-on setup session with a Saguaro specialist ($1,200)', href: 'mailto:support@saguarocontrol.net?subject=Guided Onboarding' },
      { icon: '📚', label: 'Help Center', desc: 'Tutorials, walkthroughs, and FAQs', href: 'mailto:support@saguarocontrol.net' },
      { icon: '💬', label: 'Contact Support', desc: 'Email support@saguarocontrol.net — we respond within 48hrs', href: 'mailto:support@saguarocontrol.net' },
    ],
  },
];

function daysLeft(dateStr: string | null): number {
  if (!dateStr) return 0;
  return Math.max(0, Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000));
}

export default function SettingsPage() {
  const [sub, setSub] = useState<SubInfo | null>(null);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [branding, setBranding] = useState({ company_name: '', logo_url: '', primary_color: '' });
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [brandingMsg, setBrandingMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const brandingMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch('/api/billing/subscription').then(r => r.ok ? r.json() : null).then(setSub);
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(setUser);
    fetch('/api/branding').then(r => r.ok ? r.json() : null).then(d => {
      if (d) setBranding({ company_name: d.company_name ?? '', logo_url: d.logo_url ?? '', primary_color: d.primary_color ?? '' });
    });
  }, []);

  const saveBranding = async () => {
    setBrandingSaving(true);
    try {
      const res = await fetch('/api/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(branding),
      });
      const ok = res.ok;
      setBrandingMsg({ text: ok ? 'Branding saved.' : 'Save failed.', ok });
    } catch {
      setBrandingMsg({ text: 'Save failed.', ok: false });
    } finally {
      setBrandingSaving(false);
      if (brandingMsgTimer.current) clearTimeout(brandingMsgTimer.current);
      brandingMsgTimer.current = setTimeout(() => setBrandingMsg(null), 3500);
    }
  };

  const uploadLogo = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/branding/logo', { method: 'POST', body: fd });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.logo_url) {
        setBranding(b => ({ ...b, logo_url: d.logo_url }));
        setBrandingMsg({ text: 'Logo uploaded.', ok: true });
      } else {
        setBrandingMsg({ text: d.error || 'Upload failed.', ok: false });
      }
    } catch {
      setBrandingMsg({ text: 'Upload failed.', ok: false });
    } finally {
      setUploading(false);
      if (brandingMsgTimer.current) clearTimeout(brandingMsgTimer.current);
      brandingMsgTimer.current = setTimeout(() => setBrandingMsg(null), 3500);
    }
  };

  const trialDays = sub?.trial_ends_at ? daysLeft(sub.trial_ends_at) : null;
  const isTrialing = sub?.status === 'trialing';
  const isPastDue = sub?.status === 'past_due';

  return (
    <div style={{ minHeight: '100vh', background: DARK, color: TEXT, fontFamily: "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", padding: '32px 24px', maxWidth: 860, margin: '0 auto' }}>

      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, margin: '0 0 4px', letterSpacing: -0.5 }}>Settings</h1>
        <p style={{ fontSize: 14, color: DIM, margin: 0 }}>Manage your account, team, billing, and app preferences.</p>
      </div>

      {/* Account summary card */}
      {(user || sub) && (
        <div style={{ background: RAISED, border: `1px solid ${isPastDue ? RED : isTrialing && trialDays !== null && trialDays <= 5 ? 'rgba(245,158,11,0.4)' : BORDER}`, borderRadius: 14, padding: '22px 28px', marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: DIM, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>Your Account</div>
            {user && <div style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>{user.name}</div>}
            {user && <div style={{ fontSize: 13, color: DIM }}>{user.email}</div>}
          </div>
          {sub && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, color: DIM, marginBottom: 4 }}>
                Plan: <strong style={{ color: TEXT }}>{sub.plan_name ?? 'Free Trial'}</strong>
              </div>
              {isTrialing && trialDays !== null && (
                <div style={{ fontSize: 13, color: trialDays <= 5 ? GOLD : DIM }}>
                  {trialDays} day{trialDays !== 1 ? 's' : ''} left in trial
                </div>
              )}
              {isPastDue && <div style={{ fontSize: 13, color: RED, fontWeight: 600 }}>Payment failed</div>}
              {sub.status === 'active' && sub.current_period_end && (
                <div style={{ fontSize: 13, color: GREEN }}>Active · renews {new Date(sub.current_period_end).toLocaleDateString()}</div>
              )}
              <a href="/app/billing" style={{ fontSize: 12, color: GOLD, textDecoration: 'none', fontWeight: 600 }}>Manage Billing →</a>
            </div>
          )}
        </div>
      )}

      {/* Trial warning banner */}
      {isTrialing && trialDays !== null && trialDays <= 7 && (
        <div style={{ background: 'rgba(245,158,11,0.08)', border: `1px solid rgba(245,158,11,0.3)`, borderRadius: 10, padding: '14px 20px', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontSize: 14, color: TEXT }}>
            ⏰ <strong>{trialDays} days left</strong> in your free trial — upgrade to keep access for your whole team.
          </div>
          <a href="/app/billing" style={{ padding: '8px 20px', background: `linear-gradient(135deg, ${GOLD}, #D97706)`, borderRadius: 7, color: '#000', fontWeight: 800, fontSize: 13, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            Upgrade Now
          </a>
        </div>
      )}

      {/* Company Branding */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: DIM, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>
          Company Branding
        </div>
        <div style={{ background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '24px 28px' }}>
          <div style={{ fontSize: 13, color: DIM, marginBottom: 18 }}>
            Your company name and logo will appear on all exported reports (PDF and Excel).
          </div>

          {/* Logo preview */}
          {branding.logo_url && (
            <div style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
              <img
                src={branding.logo_url}
                alt="Company logo"
                style={{ maxHeight: 56, maxWidth: 180, objectFit: 'contain', borderRadius: 6, border: `1px solid ${BORDER}`, background: 'rgba(0,0,0,0.04)', padding: 8 }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <span style={{ fontSize: 12, color: DIM }}>Logo preview</span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, color: DIM, fontWeight: 600, display: 'block', marginBottom: 6 }}>COMPANY NAME</label>
              <input
                type="text"
                value={branding.company_name}
                onChange={e => setBranding(b => ({ ...b, company_name: e.target.value }))}
                placeholder="e.g. Acme General Contractors"
                style={{ width: '100%', maxWidth: 420, background: 'rgba(0,0,0,0.05)', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 14px', color: TEXT, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: DIM, fontWeight: 600, display: 'block', marginBottom: 6 }}>LOGO URL</label>
              <input
                type="url"
                value={branding.logo_url}
                onChange={e => setBranding(b => ({ ...b, logo_url: e.target.value }))}
                placeholder="https://yoursite.com/logo.png or Supabase storage URL"
                style={{ width: '100%', maxWidth: 520, background: 'rgba(0,0,0,0.05)', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 14px', color: TEXT, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
              <div style={{ fontSize: 11, color: DIM, marginTop: 5 }}>
                Paste a public URL, or upload a file (PNG, JPG, WEBP, SVG · max 5 MB).
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.currentTarget.value = ''; }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                style={{ marginTop: 10, padding: '8px 16px', background: 'rgba(0,0,0,0.04)', border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontWeight: 600, fontSize: 13, cursor: uploading ? 'not-allowed' : 'pointer' }}
              >
                {uploading ? 'Uploading…' : 'Upload logo file'}
              </button>
            </div>

            {/* Brand color */}
            <div>
              <label style={{ fontSize: 12, color: DIM, fontWeight: 600, display: 'block', marginBottom: 6 }}>BRAND COLOR</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(branding.primary_color) ? branding.primary_color : '#C8881C'}
                  onChange={e => setBranding(b => ({ ...b, primary_color: e.target.value }))}
                  style={{ width: 48, height: 40, border: `1px solid ${BORDER}`, borderRadius: 8, background: 'none', cursor: 'pointer', padding: 2 }}
                  aria-label="Brand color"
                />
                <input
                  type="text"
                  value={branding.primary_color}
                  onChange={e => setBranding(b => ({ ...b, primary_color: e.target.value }))}
                  placeholder="#C8881C"
                  style={{ width: 130, background: 'rgba(0,0,0,0.05)', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 14px', color: TEXT, fontSize: 14, outline: 'none' }}
                />
                {branding.primary_color
                  ? <button onClick={() => setBranding(b => ({ ...b, primary_color: '' }))} style={{ background: 'none', border: 'none', color: DIM, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>Reset to Saguaro gold</button>
                  : <span style={{ fontSize: 12, color: DIM }}>Defaults to Saguaro gold</span>}
              </div>
              <div style={{ fontSize: 11, color: DIM, marginTop: 5 }}>
                Applies across your dashboard, portals, and document letterheads on the white-label plan.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4 }}>
              <button
                onClick={saveBranding}
                disabled={brandingSaving}
                style={{ padding: '10px 24px', background: `linear-gradient(135deg, ${GOLD}, #D97706)`, borderRadius: 8, color: '#000', fontWeight: 800, fontSize: 13, cursor: brandingSaving ? 'not-allowed' : 'pointer', border: 'none', opacity: brandingSaving ? 0.7 : 1 }}
              >
                {brandingSaving ? 'Saving...' : 'Save Branding'}
              </button>
              {brandingMsg && (
                <span style={{ fontSize: 13, color: brandingMsg.ok ? GREEN : RED, fontWeight: 600 }}>
                  {brandingMsg.text}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Settings sections */}
      {SETTINGS_SECTIONS.map(section => (
        <div key={section.title} style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: DIM, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>
            {section.title}
          </div>
          <div style={{ background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
            {section.items.map((item, i) => (
              <a key={item.label} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '18px 24px',
                borderBottom: i < section.items.length - 1 ? `1px solid rgba(229,229,234,0.6)` : 'none',
                textDecoration: 'none',
                background: item.highlight ? 'rgba(245,158,11,0.03)' : 'transparent',
                transition: 'background .15s',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.03)')}
                onMouseLeave={e => (e.currentTarget.style.background = item.highlight ? 'rgba(245,158,11,0.03)' : 'transparent')}
              >
                <div style={{ width: 40, height: 40, borderRadius: 10, background: item.highlight ? 'rgba(245,158,11,0.1)' : 'rgba(0,0,0,0.05)', border: `1px solid ${item.highlight ? 'rgba(245,158,11,0.2)' : BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                  {item.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: item.highlight ? GOLD : TEXT, marginBottom: 2 }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: DIM }}>{item.desc}</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={DIM} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </a>
            ))}
          </div>
        </div>
      ))}

      {/* Install App CTA */}
      <div style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(255,255,255,0) 100%)', border: `1px solid rgba(245,158,11,0.2)`, borderRadius: 14, padding: '28px 28px', display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap', marginBottom: 32 }}>
        <div style={{ fontSize: 40 }}><DeviceMobile size={40} weight="duotone" color={GOLD} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: TEXT, marginBottom: 4 }}>Get Saguaro Field for iPhone &amp; iPad</div>
          <div style={{ fontSize: 13, color: DIM }}>Download free from the App Store (TestFlight beta now). Free for your entire team.</div>
        </div>
        <a href="/get-the-app" style={{ padding: '12px 24px', background: `linear-gradient(135deg, ${GOLD}, #D97706)`, borderRadius: 9, color: '#000', fontWeight: 800, fontSize: 14, textDecoration: 'none', whiteSpace: 'nowrap' }}>
          Get the App
        </a>
      </div>

      {/* Logout */}
      <div style={{ textAlign: 'center', paddingBottom: 32 }}>
        <button onClick={async () => {
            await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
            try {
              for (const k of Object.keys(localStorage)) {
                if (k.startsWith('sb-') || k.toLowerCase().includes('supabase')) localStorage.removeItem(k);
              }
              sessionStorage.clear();
            } catch { /* storage unavailable — ignore */ }
            window.location.replace('/login');
          }}
          style={{ padding: '10px 28px', background: 'transparent', border: `1px solid rgba(239,68,68,0.3)`, borderRadius: 8, color: RED, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
          Sign Out
        </button>
      </div>

    </div>
  );
}
