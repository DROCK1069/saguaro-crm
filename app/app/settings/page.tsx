'use client';
import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { CreditCard, DeviceMobile, Bell, Users, Key, Clipboard, FileText, Gear, Rocket, GraduationCap, Books, ChatCircle, Clock, ArrowRight, CloudArrowUp, ShieldCheck, Plugs, UserCircle, Palette, Lifebuoy } from '@phosphor-icons/react';
import { PremiumSurface, ModuleHero, SectionCard, StatStrip, goldButtonStyle, ghostButtonStyle } from '@/components/ui/premium';

const GOLD  = '#F59E0B';
const BORDER = 'rgba(255,255,255,0.12)';
const DIM   = '#CBD5E1';
const TEXT  = '#FFFFFF';
const GREEN = '#22c55e';
const RED   = '#ef4444';
// Premium-surface field styling — legible on the aurora/glass backdrop.
const FIELD_BG = 'rgba(0,0,0,0.22)';

interface SubInfo {
  plan_name: string;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
}

const SETTINGS_SECTIONS = [
  {
    title: 'Account & Billing',
    sectionIcon: CreditCard,
    items: [
      { icon: CreditCard, label: 'Subscription & Plan', desc: 'Manage your plan, upgrade, view invoices', href: '/app/billing', highlight: true },
      { icon: DeviceMobile, label: 'Get the iOS App', desc: 'Download Saguaro Control Systems for iPhone & iPad on Apple TestFlight — Android coming soon', href: '/get-the-app' },
      { icon: Bell, label: 'Notifications', desc: 'Configure email and push notification preferences', href: '/app/notification-settings' },
    ],
  },
  {
    title: 'Team & Permissions',
    sectionIcon: Users,
    items: [
      { icon: Users, label: 'Roles & Permissions', desc: 'Control what each team role can access', href: '/app/people?tab=access' },
      { icon: Plugs, label: 'Integration Hub', desc: 'API keys, outbound webhooks, and the integration marketplace', href: '/app/settings/integrations-hub' },
      { icon: CloudArrowUp, label: 'External Storage', desc: 'Connect S3, OneDrive, SharePoint, Egnyte, Dropbox, Google Drive, or Box', href: '/app/settings/storage' },
    ],
  },
  {
    title: 'Compliance & Documents',
    sectionIcon: Clipboard,
    items: [
      { icon: Clipboard, label: 'Custom Fields', desc: 'Add custom fields to projects, contacts, and bids', href: '/app/custom-fields' },
      { icon: FileText, label: 'Document Templates', desc: 'Manage your company document templates', href: '/app/documents' },
      { icon: Gear, label: 'Autopilot Rules', desc: 'Configure RFI, change order, and approval automations', href: '/app/autopilot' },
    ],
  },
  {
    title: 'Support & Resources',
    sectionIcon: Lifebuoy,
    items: [
      { icon: Rocket, label: 'Free Migration', desc: 'Migrate your data from any platform or spreadsheet', href: 'mailto:support@saguarocontrol.net?subject=Migration Request' },
      { icon: GraduationCap, label: 'Guided Onboarding', desc: 'Book a hands-on setup session with a Saguaro specialist ($1,200)', href: 'mailto:support@saguarocontrol.net?subject=Guided Onboarding' },
      { icon: Books, label: 'Help Center', desc: 'Tutorials, walkthroughs, and FAQs', href: 'mailto:support@saguarocontrol.net' },
      { icon: ChatCircle, label: 'Contact Support', desc: 'Email support@saguarocontrol.net — we respond within 48hrs', href: 'mailto:support@saguarocontrol.net' },
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
  const [platformAdmin, setPlatformAdmin] = useState(false);

  useEffect(() => {
    fetch('/api/billing/subscription').then(r => r.ok ? r.json() : null).then(setSub);
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(setUser);
    fetch('/api/platform/me').then(r => r.ok ? r.json() : null).then(d => setPlatformAdmin(!!d?.isPlatformAdmin));
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

  const acctBorder = isPastDue ? RED : (isTrialing && trialDays !== null && trialDays <= 5 ? 'rgba(245,158,11,0.4)' : undefined);

  return (
    <PremiumSurface maxWidth={920}>

      <ModuleHero
        eyebrow="Workspace"
        eyebrowIcon={<Gear size={13} weight="fill" color={GOLD} />}
        title="Settings"
        accent="& Preferences"
        subtitle="Manage your account, team, billing, and app preferences."
      />

      {/* Workspace snapshot — what the system knows about this account */}
      {(user || sub) && (
        <StatStrip items={[
          { label: 'Plan', value: sub?.plan_name || 'Free Trial', accent: isPastDue ? RED : undefined, sub: sub?.status === 'active' ? 'subscription active' : isTrialing ? 'trial in progress' : isPastDue ? 'payment failed — fix in Billing' : 'manage in Billing' },
          ...(isTrialing && trialDays !== null
            ? [{ label: 'Trial', value: `${trialDays}d left`, accent: trialDays <= 5 ? GOLD : undefined, sub: 'upgrade any time in Billing' }]
            : sub?.current_period_end
              ? [{ label: 'Renews', value: new Date(sub.current_period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), sub: 'next billing date' }]
              : []),
          { label: 'Branding', value: (branding.logo_url || branding.company_name) ? 'Custom' : 'Default', accent: (branding.logo_url || branding.company_name) ? GREEN : undefined, sub: branding.company_name || 'set a name + logo below' },
          { label: 'Brand Color', value: branding.primary_color || 'Saguaro Gold', sub: branding.primary_color ? 'white-label accent' : 'default accent' },
          { label: 'Signed In As', value: user?.name || '—', sub: user?.email || undefined },
        ]} />
      )}

      {/* Account summary card */}
      {(user || sub) && (
        <div style={{ marginBottom: 24 }}>
          <SectionCard
            title="Your Account"
            icon={<UserCircle size={18} weight="duotone" color={GOLD} />}
            accent={isPastDue ? RED : GOLD}
            style={acctBorder ? { borderColor: acctBorder } : undefined}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div>
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
                  <Link href="/app/billing" style={{ fontSize: 12, color: GOLD, textDecoration: 'none', fontWeight: 600 }}>Manage Billing <span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><ArrowRight size={12} weight="regular" color={GOLD} /></span></Link>
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      )}

      {/* Trial warning banner */}
      {isTrialing && trialDays !== null && trialDays <= 7 && (
        <div style={{ background: 'rgba(245,158,11,0.08)', border: `1px solid rgba(245,158,11,0.3)`, borderRadius: 12, padding: '14px 20px', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontSize: 14, color: TEXT }}>
            <span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><Clock size={16} weight="fill" color={GOLD} /></span> <strong>{trialDays} days left</strong> in your free trial — upgrade to keep access for your whole team.
          </div>
          <Link href="/app/billing" className="pmBtn" style={{ ...goldButtonStyle, whiteSpace: 'nowrap' }}>
            Upgrade Now
          </Link>
        </div>
      )}

      {/* Company Branding */}
      <div style={{ marginBottom: 24 }}>
        <SectionCard title="Company Branding" icon={<Palette size={18} weight="duotone" color={GOLD} />}>
          <div style={{ fontSize: 13, color: DIM, marginBottom: 18 }}>
            Your company name and logo will appear on all exported reports (PDF and Excel).
          </div>

          {/* Logo preview */}
          {branding.logo_url && (
            <div style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
              <img
                src={branding.logo_url}
                alt="Company logo"
                style={{ maxHeight: 56, maxWidth: 180, objectFit: 'contain', borderRadius: 6, border: `1px solid ${BORDER}`, background: 'rgba(0,0,0,0.2)', padding: 8 }}
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
                style={{ width: '100%', maxWidth: 420, background: FIELD_BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 14px', color: TEXT, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: DIM, fontWeight: 600, display: 'block', marginBottom: 6 }}>LOGO URL</label>
              <input
                type="url"
                value={branding.logo_url}
                onChange={e => setBranding(b => ({ ...b, logo_url: e.target.value }))}
                placeholder="https://yoursite.com/logo.png or Supabase storage URL"
                style={{ width: '100%', maxWidth: 520, background: FIELD_BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 14px', color: TEXT, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
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
                className="pmBtn"
                style={{ ...ghostButtonStyle, marginTop: 10, cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.7 : 1 }}
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
                  value={/^#[0-9a-fA-F]{6}$/.test(branding.primary_color) ? branding.primary_color : '#F59E0B'}
                  onChange={e => setBranding(b => ({ ...b, primary_color: e.target.value }))}
                  style={{ width: 48, height: 40, border: `1px solid ${BORDER}`, borderRadius: 8, background: 'none', cursor: 'pointer', padding: 2 }}
                  aria-label="Brand color"
                />
                <input
                  type="text"
                  value={branding.primary_color}
                  onChange={e => setBranding(b => ({ ...b, primary_color: e.target.value }))}
                  placeholder="#F59E0B"
                  style={{ width: 130, background: FIELD_BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 14px', color: TEXT, fontSize: 14, outline: 'none' }}
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
                className="pmBtn"
                style={{ ...goldButtonStyle, cursor: brandingSaving ? 'not-allowed' : 'pointer', opacity: brandingSaving ? 0.7 : 1 }}
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
        </SectionCard>
      </div>

      {/* Platform Owner section */}
      {platformAdmin && (
        <div style={{ marginBottom: 24 }}>
          <SectionCard title="Platform Owner" icon={<ShieldCheck size={18} weight="duotone" color={GOLD} />} flush>
            <a href="/app/settings/platform-integrations" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 24px', textDecoration: 'none', background: 'rgba(245,158,11,0.03)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,158,11,0.08)')} onMouseLeave={e => (e.currentTarget.style.background = 'rgba(245,158,11,0.03)')}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(245,158,11,0.1)', border: `1px solid rgba(245,158,11,0.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><ShieldCheck size={20} color={GOLD} /></div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600, color: GOLD, marginBottom: 2 }}>Platform Integrations</div><div style={{ fontSize: 12, color: DIM }}>Configure the cloud-storage OAuth apps once — enables one-click connect for every tenant</div></div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={DIM} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6" /></svg>
            </a>
          </SectionCard>
        </div>
      )}

      {SETTINGS_SECTIONS.map(section => (
        <div key={section.title} style={{ marginBottom: 24 }}>
          <SectionCard title={section.title} icon={<section.sectionIcon size={18} weight="duotone" color={GOLD} />} flush>
            {section.items.map((item, i) => (
              <a key={item.label} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '18px 24px',
                borderBottom: i < section.items.length - 1 ? `1px solid rgba(255,255,255,0.06)` : 'none',
                textDecoration: 'none',
                background: item.highlight ? 'rgba(245,158,11,0.05)' : 'transparent',
                transition: 'background .15s',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = item.highlight ? 'rgba(245,158,11,0.05)' : 'transparent')}
              >
                <div style={{ width: 40, height: 40, borderRadius: 10, background: item.highlight ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.05)', border: `1px solid ${item.highlight ? 'rgba(245,158,11,0.2)' : BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                  <item.icon size={20} weight="regular" color={item.highlight ? GOLD : TEXT} />
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
          </SectionCard>
        </div>
      ))}

      {/* Install App CTA */}
      <div style={{ marginBottom: 24 }}>
        <SectionCard>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontSize: 40, display: 'flex' }}><DeviceMobile size={40} weight="duotone" color={GOLD} /></div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: TEXT, marginBottom: 4 }}>Get the Saguaro Control Systems iOS app</div>
              <div style={{ fontSize: 13, color: DIM }}>Native iOS app on Apple TestFlight — free for your entire team. Android coming soon.</div>
            </div>
            <Link href="/get-the-app" className="pmBtn" style={{ ...goldButtonStyle, whiteSpace: 'nowrap' }}>
              Get Install Guide
            </Link>
          </div>
        </SectionCard>
      </div>

      {/* Logout */}
      <div style={{ textAlign: 'center', paddingBottom: 8 }}>
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

    </PremiumSurface>
  );
}
