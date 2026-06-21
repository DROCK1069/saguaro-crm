'use client';
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Blueprint, Robot, CurrencyDollar, DeviceMobile, WifiHigh, Cube, Drone, Buildings, Hammer, HouseSimple, Building, ShieldCheck, ChartLine, User, UsersThree, PenNib, Handshake, BookOpen, Calculator, Scales, Wrench, Trophy, CaretDown, List, X } from '@phosphor-icons/react';
import { IntegrationStrip } from '../components/Integrations';

/* ── palette ── */
const BG = '#F2F2F7';
const CARD = '#FFFFFF';
const GOLD = '#C8881C';
const GREEN = '#34C759';
const TEXT = '#1C1C1E';
const DIM = '#6E6E73';

/* ── icons (inline SVG) ── */
const Icon = ({ d, size = 22 }: { d: string; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">{d.split('|').map((p, i) => <path key={i} d={p} />)}</svg>
);

const CheckIcon = () => <svg viewBox="0 0 20 20" width={18} height={18} fill={GREEN}><path d="M10 0a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.3 7.7-5 5a1 1 0 0 1-1.4 0l-2-2a1 1 0 1 1 1.4-1.4L8.6 10.6l4.3-4.3a1 1 0 0 1 1.4 1.4z" /></svg>;
const XIcon = () => <svg viewBox="0 0 20 20" width={18} height={18} fill="#EF4444"><circle cx={10} cy={10} r={10} opacity={0.15} /><path d="M7 7l6 6M13 7l-6 6" stroke="#EF4444" strokeWidth={2} strokeLinecap="round" /></svg>;
const PartialIcon = () => <svg viewBox="0 0 20 20" width={18} height={18} fill={GOLD}><circle cx={10} cy={10} r={10} opacity={0.15} /><path d="M6 10h8" stroke={GOLD} strokeWidth={2} strokeLinecap="round" /></svg>;

/* ── nav links (legacy — replaced by dropdown menus) ── */

/* ── features data ── */
const FEATURES = [
  {
    icon: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z|M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z',
    title: 'AI Blueprint Takeoff',
    desc: 'Upload any PDF blueprint. Sage reads dimensions, calculates materials, and generates a full bid estimate in under 60 seconds.',
    href: '/product/ai-takeoff',
  },
  {
    icon: 'M12 2a8 8 0 0 0-8 8c0 6 8 12 8 12s8-6 8-12a8 8 0 0 0-8-8zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6z',
    title: 'Sage AI Assistant',
    desc: 'Ask Sage anything about your projects. Get instant answers on budgets, schedules, and compliance across every active job.',
    href: '/signup',
  },
  {
    icon: 'M12 1v22|M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
    title: 'Financial Suite',
    desc: 'AIA G702/G703 pay apps, invoicing, lien waivers for all 50 states, and certified payroll — generated automatically.',
    href: '/product/pay-applications',
  },
  {
    icon: 'M5 2h14a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z|M12 18h.01',
    title: 'Field Mobile App',
    desc: 'Native iPhone & iPad app for daily logs, photos, GPS clock-in, punch lists, and inspections. Works offline. Now in TestFlight beta.',
    href: '/get-the-app',
  },
  {
    icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2|M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z|M23 21v-2a4 4 0 0 0-3-3.87|M16 3.13a4 4 0 0 1 0 7.75',
    title: 'Client & Sub Portals',
    desc: 'Branded owner portal for approvals and sub portal for bids, W-9s, and insurance. White-label your business.',
    href: '/signup',
  },
  {
    icon: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z|M9 22V12h6v10',
    title: 'Smart Building & Low Volt',
    desc: 'IoT device management, structured cabling, and AV scheduling for technology-forward builds and smart home installs.',
    href: '/signup',
  },
];

/* ── comparison data ── */
const COMPARISON_ROWS: { feature: string; saguaro: 'yes' | 'no' | 'partial'; procore: 'yes' | 'no' | 'partial'; buildertrend: 'yes' | 'no' | 'partial' }[] = [
  { feature: 'AI Blueprint Takeoff', saguaro: 'yes', procore: 'no', buildertrend: 'no' },
  { feature: 'Sage AI Assistant', saguaro: 'yes', procore: 'no', buildertrend: 'no' },
  { feature: 'Bid Package Auto-Generation', saguaro: 'yes', procore: 'partial', buildertrend: 'no' },
  { feature: 'Smart Building Module', saguaro: 'yes', procore: 'no', buildertrend: 'no' },
  { feature: 'Mobile Offline', saguaro: 'yes', procore: 'partial', buildertrend: 'partial' },
  { feature: 'Owner Portal', saguaro: 'yes', procore: 'yes', buildertrend: 'yes' },
  { feature: 'Sub Portal', saguaro: 'yes', procore: 'partial', buildertrend: 'partial' },
  { feature: 'Starting Price', saguaro: 'yes', procore: 'no', buildertrend: 'partial' },
];

const StatusCell = ({ v }: { v: 'yes' | 'no' | 'partial' }) =>
  v === 'yes' ? <CheckIcon /> : v === 'partial' ? <PartialIcon /> : <XIcon />;

const PriceLabel = ({ v }: { v: 'yes' | 'no' | 'partial' }) =>
  v === 'yes' ? <span style={{ color: GREEN, fontWeight: 600, fontSize: 13 }}>$49/mo</span>
    : v === 'partial' ? <span style={{ color: GOLD, fontWeight: 600, fontSize: 13 }}>$399/mo</span>
    : <span style={{ color: '#EF4444', fontWeight: 600, fontSize: 13 }}>$1,000+/mo</span>;

/* ── pricing data ── */
const PLANS = [
  {
    name: 'Starter',
    price: '$49',
    period: '/mo',
    desc: 'Perfect for small GCs getting started',
    features: ['3 active projects', 'AI Takeoff (5/mo)', 'Pay apps & invoicing', 'Lien waivers', 'Mobile field app', 'Email support'],
    cta: 'Start Free Trial',
    highlighted: false,
  },
  {
    name: 'Professional',
    price: '$99',
    period: '/mo',
    desc: 'For growing contractors who need it all',
    features: ['Unlimited projects', 'Unlimited AI Takeoffs', 'Sage AI Assistant', 'Bid package manager', 'Client & sub portals', 'Certified payroll', 'Priority support'],
    cta: 'Start Free Trial',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    desc: 'For large firms with custom needs',
    features: ['Everything in Professional', 'Dedicated account manager', 'Custom integrations', 'SSO & advanced security', 'On-site training', 'SLA guarantee', 'API access'],
    cta: 'Contact Sales',
    highlighted: false,
  },
];

/* ===========================
   MARKETING NAV (own component so hooks are valid)
   =========================== */
function MarketingNav() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const menus: Record<string, { label: string; groups: { heading: string; links: { label: string; href: string }[] }[] }> = {
    platform: {
      label: 'Platform',
      groups: [
        { heading: 'Preconstruction', links: [
          { label: 'AI Blueprint Takeoff', href: '/product/ai-takeoff' },
          { label: 'Bid Intelligence', href: '/product/bid-intelligence' },
          { label: 'Sage AI Assistant', href: '/features#sage-ai-assistant' },
        ] },
        { heading: 'Financials', links: [
          { label: 'AIA Pay Applications', href: '/product/pay-applications' },
          { label: 'Lien Waivers', href: '/product/lien-waivers' },
          { label: 'Financials & Reporting', href: '/features#financials-reporting' },
          { label: 'Executive Intelligence', href: '/intelligence' },
        ] },
        { heading: 'Field & Project Mgmt', links: [
          { label: 'Field Mobile App', href: '/get-the-app' },
          { label: 'Daily Logs & Field App', href: '/features#daily-logs-field-app-saguaro-field' },
          { label: 'RFIs & Change Orders', href: '/features#rfis-change-orders' },
          { label: 'Submittals & Compliance', href: '/features#submittals-compliance' },
          { label: 'Punch Lists & Inspections', href: '/features#punch-lists-inspections' },
          { label: 'Owner & Sub Portals', href: '/features#owner-subcontractor-portals' },
        ] },
      ],
    },
    solutions: {
      label: 'Solutions',
      groups: [
        { heading: 'By Trade', links: [
          { label: 'General Contractors', href: '/industry/general-contractors' },
          { label: 'Specialty Subcontractors', href: '/industry/specialty-subcontractors' },
          { label: 'Residential Remodelers', href: '/industry/residential-remodelers' },
          { label: 'Commercial Contractors', href: '/industry/commercial-contractors' },
          { label: 'Roofing Contractors', href: '/industry/roofing-contractors' },
        ] },
        { heading: 'By Need', links: [
          { label: 'Estimating & Bidding', href: '/product/ai-takeoff' },
          { label: 'Project Management', href: '/features#rfis-change-orders' },
          { label: 'Billing & Compliance', href: '/product/pay-applications' },
          { label: 'Field Operations', href: '/features#daily-logs-field-app-saguaro-field' },
        ] },
      ],
    },
    resources: {
      label: 'Resources',
      groups: [
        { heading: 'Learn', links: [
          { label: 'How It Works', href: '/how-it-works' },
          { label: 'Help Center', href: '/help-center' },
          { label: 'Changelog', href: '/changelog' },
          { label: 'Get the iOS App', href: '/get-the-app' },
        ] },
        { heading: 'Compare', links: [
          { label: 'Compare to Procore', href: '/compare/procore' },
          { label: 'ROI Calculator', href: '/roi-calculator' },
          { label: 'Switch from Procore', href: '/switch-from-procore' },
        ] },
        { heading: 'Company', links: [
          { label: 'About', href: '/about' },
          { label: 'Owner & Sub Portals', href: '/portals/client' },
          { label: 'API Docs', href: '/api-docs' },
          { label: 'Contact', href: '/contact' },
        ] },
      ],
    },
  };

  return (
    <nav ref={navRef} style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
      borderBottom: '1px solid rgba(212,160,23,0.12)',
      padding: '0 max(24px, 4vw)', height: 56,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      {/* Logo lockup — full horizontal badge + wordmark artwork */}
      <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }} aria-label="Saguaro Control Systems — home">
        <img src="/logo-horizontal.png" alt="Saguaro Control Systems" height={34} style={{ height: 34, width: 'auto', display: 'block' }} />
      </a>

      {/* Desktop menu — Procore/Buildertrend-style grouped mega-menu */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 4, position: 'relative' }}
        className="desktop-nav"
        onMouseLeave={() => setOpenMenu(null)}
      >
        {Object.entries(menus).map(([key, menu]) => (
          <button
            key={key}
            onClick={() => setOpenMenu(openMenu === key ? null : key)}
            onMouseEnter={() => setOpenMenu(key)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: openMenu === key ? '#C8881C' : '#1C1C1E',
              fontSize: 13, fontWeight: 500, padding: '8px 14px',
              display: 'flex', alignItems: 'center', gap: 4,
              transition: 'color 0.15s ease',
            }}
          >
            {menu.label}
            <CaretDown size={12} weight="bold" style={{ transform: openMenu === key ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
          </button>
        ))}

        {/* Pricing link */}
        <a href="/#pricing" style={{ color: '#1C1C1E', fontSize: 13, fontWeight: 500, padding: '8px 14px', textDecoration: 'none' }}>Pricing</a>

        {/* Single mega-menu panel — grouped columns of text links.
            Outer wrapper starts flush at the nav bottom (top:100%) with a
            transparent paddingTop "bridge" so moving the mouse from the button
            to the panel never crosses dead space (keeps the menu open). */}
        {openMenu && menus[openMenu] && (
          <div style={{ position: 'absolute', top: '100%', left: 0, paddingTop: 14, zIndex: 110 }}>
          <div
            style={{
              position: 'relative',
              background: '#FFFFFF', border: '1px solid #EAE8E4', borderRadius: 12,
              boxShadow: '0 1px 2px rgba(28,25,23,0.04), 0 16px 44px rgba(28,25,23,0.13)',
              padding: '28px 34px', display: 'flex', gap: 52,
              maxWidth: 'calc(100vw - 48px)',
              animation: 'navDropFadeIn 0.15s ease',
            }}
          >
            {/* gold signature edge */}
            <span style={{ position: 'absolute', top: 0, left: 18, right: 18, height: 3, background: 'linear-gradient(90deg,#E8B420,#C8881C)', borderRadius: '0 0 3px 3px' }} />
            {menus[openMenu].groups.map((group) => (
              <div key={group.heading} style={{ minWidth: 168 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#C8881C', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid #EFEDE8' }}>
                  {group.heading}
                </div>
                {group.links.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    style={{ display: 'block', color: '#1C1C1E', fontSize: 14, fontWeight: 500, padding: '8px 0', textDecoration: 'none', transition: 'color 0.12s, transform 0.12s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#C8881C'; e.currentTarget.style.transform = 'translateX(3px)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#1C1C1E'; e.currentTarget.style.transform = 'translateX(0)'; }}
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            ))}
          </div>
          </div>
        )}
      </div>

      {/* Right side CTAs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <a href="/login" style={{ color: '#86868B', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>Log In</a>
        <a href="/signup" style={{
          background: 'linear-gradient(135deg, #C8881C, #C8960F)',
          color: '#000', fontSize: 13, fontWeight: 700,
          padding: '8px 20px', borderRadius: 8, textDecoration: 'none',
          boxShadow: '0 0 20px rgba(212,160,23,0.2)',
        }}>Start Free</a>

        {/* Mobile hamburger */}
        <button onClick={() => setMobileOpen(!mobileOpen)} style={{ display: 'none', background: 'none', border: 'none', color: '#1C1C1E', cursor: 'pointer', padding: 4 }} className="mobile-menu-btn">
          {mobileOpen ? <X size={24} /> : <List size={24} />}
        </button>
      </div>
    </nav>
  );
}

/* ===========================
   MAIN PAGE COMPONENT
   =========================== */
export default function LandingPage() {
  const [bannerVisible, setBannerVisible] = useState(true);

  useEffect(() => {
    const els = document.querySelectorAll('.reveal, .reveal-stagger');
    if (!els.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('revealed'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div data-landing style={{ background: `linear-gradient(180deg, #FAFAF8 0%, ${BG} 30%, #F5F5F0 100%)`, color: TEXT, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", minHeight: '100vh', overflowX: 'hidden' as const }}>

      {/* ══════════ 1. TOP BANNER ══════════ */}
      {bannerVisible && (
        <div style={{ background: 'linear-gradient(90deg, rgba(212,160,23,0.12) 0%, rgba(212,160,23,0.05) 100%)', borderBottom: '1px solid rgba(212,160,23,0.2)', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, position: 'relative' as const }}>
          <span style={{ color: GOLD, fontWeight: 600 }}>AI reads your blueprints in 60 seconds. Estimating, billing, and field ops &mdash; one platform.</span>
          <Link href="/signup" style={{ color: GOLD, textDecoration: 'underline', fontWeight: 500 }}>Try it free &rarr;</Link>
          <button onClick={() => setBannerVisible(false)} style={{ position: 'absolute' as const, right: 16, background: 'none', border: 'none', color: DIM, cursor: 'pointer', fontSize: 18, lineHeight: 1 }} aria-label="Dismiss banner">&times;</button>
        </div>
      )}

      {/* ══════════ 2. NAV WITH DROPDOWNS ══════════ */}
      <MarketingNav />

      {/* ══════════ 3. HERO — full-bleed Arizona desert photography ══════════ */}
      <section style={{ position: 'relative' as const, width: '100%', overflow: 'hidden', minHeight: 620, display: 'flex', alignItems: 'center' }}>
        {/* ── Real desert sunset photograph ── */}
        <div style={{ position: 'absolute' as const, inset: 0, zIndex: 0 }}>
          <img
            src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1920&q=85&auto=format"
            alt=""
            aria-hidden="true"
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 40%' }}
          />
        </div>
        {/* ── Cinematic gradient overlay: dark left → clear right (shows desert on right) ── */}
        <div style={{ position: 'absolute' as const, inset: 0, zIndex: 1, background: 'linear-gradient(105deg, rgba(10,6,14,0.92) 0%, rgba(10,6,14,0.78) 35%, rgba(10,6,14,0.45) 60%, rgba(10,6,14,0.18) 80%, transparent 100%)' }} />
        {/* ── Bottom vignette for smooth transition to content below ── */}
        <div style={{ position: 'absolute' as const, bottom: 0, left: 0, right: 0, height: 200, zIndex: 1, background: 'linear-gradient(to top, rgba(10,6,14,0.95) 0%, transparent 100%)' }} />
        {/* ── Warm gold glow accent near horizon ── */}
        <div style={{ position: 'absolute' as const, bottom: '15%', right: '20%', width: 600, height: 400, zIndex: 1, background: 'radial-gradient(ellipse, rgba(232,168,60,0.15) 0%, transparent 70%)', pointerEvents: 'none' as const }} />

        {/* ── Content ── */}
        <div style={{ position: 'relative' as const, zIndex: 2, maxWidth: 1200, width: '100%', margin: '0 auto', padding: '120px 24px 160px' }}>
          <div style={{ maxWidth: 640 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(255,220,140,0.12)', border: '1px solid rgba(255,220,140,0.30)', color: '#F5D990', fontSize: 11, fontWeight: 700, letterSpacing: 1.2, padding: '6px 14px', borderRadius: 999, marginBottom: 24, textTransform: 'uppercase' as const, backdropFilter: 'blur(8px)' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F5D990', boxShadow: '0 0 10px rgba(245,217,144,0.7)' }} />AI-Powered Construction CRM</span>
            <h1 style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.04, letterSpacing: '-0.035em', margin: '0 0 22px', color: '#FFFFFF' }}>Build smarter.<br />Bid faster.<br />Get paid.</h1>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 18, lineHeight: 1.65, margin: '0 0 36px', maxWidth: 480 }}>The AI-powered CRM that reads blueprints, generates estimates, handles pay apps, and runs your field crew — at a third the cost of Procore.</p>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' as const, alignItems: 'center' }}>
              <Link href="/signup" className="cta-glow" style={{ background: 'linear-gradient(135deg, #F5C645 0%, #E8A020 100%)', color: '#1A1400', textDecoration: 'none', fontWeight: 800, fontSize: 16, padding: '16px 36px', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 20px rgba(232,160,32,0.50), 0 12px 40px rgba(232,160,32,0.25)', letterSpacing: '-0.01em' }}>Start Free Trial <span style={{ fontSize: 18 }}>&rarr;</span></Link>
              <Link href="/#demo" style={{ color: 'rgba(255,255,255,0.9)', textDecoration: 'none', fontWeight: 600, fontSize: 15, padding: '16px 28px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.25)', display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(8px)', transition: 'background 0.2s, border-color 0.2s' }}>
                <svg viewBox="0 0 20 20" width={14} height={14} fill="rgba(255,255,255,0.9)"><polygon points="6,3 18,10 6,17" /></svg> Watch Demo
              </Link>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 16, letterSpacing: '0.02em' }}>No credit card required &middot; 14-day free trial &middot; Cancel anytime</p>
          </div>
        </div>
      </section>

      {/* ══════════ AI TAKEOFF — baked into the page, no card ══════════ */}
      <span id="how-it-works" aria-hidden="true" style={{ scrollMarginTop: 72 }} />
      <section id="demo" style={{ maxWidth: 1080, margin: '0 auto', padding: '88px 24px 76px', display: 'grid', gridTemplateColumns: '0.82fr 1.18fr', gap: 64, alignItems: 'center', scrollMarginTop: 72 }} className="reveal demo-grid">
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.6, textTransform: 'uppercase' as const, color: GOLD, marginBottom: 18 }}>AI Blueprint Takeoff</div>
          <h2 style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.05, margin: '0 0 20px', color: TEXT }}>47 line items.<br />38 seconds.</h2>
          <p style={{ fontSize: 16.5, lineHeight: 1.65, color: DIM, margin: '0 0 26px', maxWidth: 390 }}>Drop in a PDF blueprint. Sage reads every dimension, counts every material, and prices a full estimate before your coffee&apos;s cold — work that takes an estimator half a day.</p>
          <Link href="/signup" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: GOLD, fontWeight: 700, fontSize: 15, textDecoration: 'none', borderBottom: `2px solid ${GOLD}`, paddingBottom: 3 }}>Run your first takeoff free <span style={{ fontSize: 17 }}>&rarr;</span></Link>
        </div>
        {/* line items, set directly onto the page — hairline rules, no box */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 14, borderBottom: `2px solid ${TEXT}` }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: TEXT, letterSpacing: '-0.01em' }}>AI Takeoff Results</span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: GOLD, fontVariantNumeric: 'tabular-nums' }}>38s &middot; 47 items</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 0.8fr 0.6fr 1fr', padding: '10px 0 8px' }}>
            {['Item', 'Qty', 'Unit', 'Cost'].map((h, j) => (
              <div key={h} style={{ fontSize: 10.5, color: DIM, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', textAlign: j === 0 ? 'left' : 'right' }}>{h}</div>
            ))}
          </div>
          {[
            ['Concrete Footing', '124', 'CY', '$18,600'],
            ['#5 Rebar', '2,400', 'LF', '$4,320'],
            ['CMU 8″ Block', '3,650', 'EA', '$10,950'],
            ['Rigid Insulation', '4,800', 'SF', '$7,200'],
            ['Structural Steel', '48', 'TON', '$96,000'],
          ].map((row, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2.2fr 0.8fr 0.6fr 1fr', padding: '13px 0', borderTop: i === 0 ? 'none' : '1px solid #E7E5E1' }}>
              {row.map((cell, j) => (
                <div key={j} style={{ fontSize: 14, color: j === 3 ? GOLD : j === 0 ? TEXT : DIM, fontWeight: j === 3 ? 700 : j === 0 ? 600 : 500, fontVariantNumeric: 'tabular-nums', textAlign: j === 0 ? 'left' : 'right' }}>{cell}</div>
              ))}
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 6, paddingTop: 16, borderTop: `2px solid ${TEXT}` }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: TEXT, letterSpacing: '-0.01em' }}>Total Estimate</span>
            <span style={{ fontSize: 26, fontWeight: 800, color: GOLD, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>$137,070</span>
          </div>
        </div>
      </section>

      {/* ══════════ capability proof — inline figures, divider rules, no boxes ══════════ */}
      <section style={{ borderTop: '1px solid #E7E5E1', borderBottom: '1px solid #E7E5E1' }} className="reveal">
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }} className="stats-row reveal-stagger">
            {[
              { val: '< 60s', lbl: 'Per blueprint takeoff' },
              { val: 'G702/703', lbl: 'AIA pay apps built in' },
              { val: '50-state', lbl: 'Lien waivers included' },
              { val: '⅓', lbl: 'The cost of Procore' },
            ].map((s, i) => (
              <div key={s.lbl} style={{ padding: '40px 28px', textAlign: 'center' as const, borderLeft: i === 0 ? 'none' : '1px solid #E7E5E1' }}>
                <div style={{ fontSize: 34, fontWeight: 800, color: GOLD, letterSpacing: '-0.03em' }}>{s.val}</div>
                <div style={{ fontSize: 13, color: DIM, marginTop: 8, fontWeight: 500 }}>{s.lbl}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integration logos — real vendor marks (react-icons), only for shipped integrations */}
      <IntegrationStrip />

      {/* ══════════ 4. FEATURES — editorial grid, hairline rules, no cards ══════════ */}
      <section id="features" style={{ maxWidth: 1080, margin: '0 auto', padding: '88px 24px 80px' }} className="reveal">
        <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 12, color: TEXT, maxWidth: 600 }}>Everything you need.<br />Nothing you don&apos;t.</h2>
        <p style={{ color: DIM, fontSize: 16, marginBottom: 56, maxWidth: 480, lineHeight: 1.6 }}>One platform replaces Procore, spreadsheets, and five other tools.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', columnGap: 48, rowGap: 4 }} className="feature-grid reveal-stagger">
          {FEATURES.map(f => (
            <div key={f.title} style={{ padding: '28px 0', borderTop: `1px solid #E7E5E1`, display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
              <div style={{ color: GOLD }}>
                <Icon d={f.icon} size={26} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: TEXT, letterSpacing: '-0.01em' }}>{f.title}</h3>
              <p style={{ fontSize: 13.5, color: DIM, lineHeight: 1.65, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════ 6. COMPARISON — table set into the page, no wrapper box ══════════ */}
      <section id="compare" style={{ background: '#FAFAF8', borderTop: '1px solid #E7E5E1', borderBottom: '1px solid #E7E5E1' }} className="reveal">
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '88px 24px' }}>
          <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 12, color: TEXT }}>Why GCs switch from Procore</h2>
          <p style={{ color: DIM, fontSize: 16, marginBottom: 44, maxWidth: 460, lineHeight: 1.6 }}>Feature-for-feature, here&apos;s how Saguaro compares — at a third of the price.</p>
          {/* header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', borderBottom: `2px solid ${TEXT}`, paddingBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: DIM, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Feature</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: GOLD, textAlign: 'center' as const }}>Saguaro</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: DIM, textAlign: 'center' as const }}>Procore</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: DIM, textAlign: 'center' as const, opacity: 0.65 }}>Buildertrend</div>
          </div>
          {/* rows */}
          {COMPARISON_ROWS.map((r, i) => (
            <div key={r.feature} className="compare-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', alignItems: 'center', borderTop: i === 0 ? 'none' : '1px solid #E7E5E1', transition: 'background 0.2s ease' }}>
              <div style={{ padding: '15px 0', fontSize: 14, color: TEXT, fontWeight: 500 }}>{r.feature}</div>
              <div style={{ padding: '15px 12px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {r.feature === 'Starting Price' ? <PriceLabel v={r.saguaro} /> : <StatusCell v={r.saguaro} />}
              </div>
              <div style={{ padding: '15px 12px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {r.feature === 'Starting Price' ? <PriceLabel v={r.procore} /> : <StatusCell v={r.procore} />}
              </div>
              <div style={{ padding: '15px 12px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {r.feature === 'Starting Price' ? <PriceLabel v={r.buildertrend} /> : <StatusCell v={r.buildertrend} />}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════ 7. PRICING — columns split by hairlines, no boxes ══════════ */}
      <section id="pricing" style={{ maxWidth: 1040, margin: '0 auto', padding: '88px 24px 80px' }} className="reveal">
        <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 12, color: TEXT }}>Simple, transparent pricing</h2>
        <p style={{ color: DIM, fontSize: 16, marginBottom: 8, maxWidth: 460, lineHeight: 1.6 }}>No hidden fees. No per-user charges. Cancel anytime.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderTop: `2px solid ${TEXT}`, marginTop: 36 }} className="pricing-grid">
          {PLANS.map((plan, i) => (
            <div key={plan.name} style={{
              padding: '32px 28px 28px',
              borderLeft: i === 0 ? 'none' : '1px solid #E7E5E1',
              display: 'flex',
              flexDirection: 'column' as const,
              position: 'relative' as const,
              boxShadow: plan.highlighted ? `inset 0 3px 0 ${GOLD}` : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: TEXT, letterSpacing: '-0.01em' }}>{plan.name}</h3>
                {plan.highlighted && (
                  <span style={{ background: 'rgba(200,136,28,0.12)', color: GOLD, fontSize: 9.5, fontWeight: 800, padding: '3px 9px', borderRadius: 4, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>Most Popular</span>
                )}
              </div>
              <div style={{ marginBottom: 8, display: 'flex', alignItems: 'baseline', gap: 2 }}>
                <span style={{ fontSize: 40, fontWeight: 800, color: plan.highlighted ? GOLD : TEXT, letterSpacing: '-0.03em' }}>{plan.price}</span>
                {plan.period && <span style={{ fontSize: 15, color: DIM }}>{plan.period}</span>}
              </div>
              <p style={{ fontSize: 13, color: DIM, marginBottom: 26, lineHeight: 1.5 }}>{plan.desc}</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', flex: 1 }}>
                {plan.features.map(f => (
                  <li key={f} style={{ fontSize: 13.5, color: TEXT, padding: '7px 0', display: 'flex', alignItems: 'flex-start', gap: 9, lineHeight: 1.45 }}>
                    <svg viewBox="0 0 16 16" width={15} height={15} fill={plan.highlighted ? GOLD : GREEN} style={{ flexShrink: 0, marginTop: 1 }}><path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm3.4 6.2-4 4a.7.7 0 0 1-1 0l-1.8-1.8a.7.7 0 1 1 1-1l1.3 1.3 3.5-3.5a.7.7 0 0 1 1 1z" /></svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href={plan.name === 'Enterprise' ? '/contact' : '/signup'} className={plan.highlighted ? 'cta-glow' : undefined} style={{
                display: 'block',
                textAlign: 'center' as const,
                padding: '13px 0',
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 14.5,
                textDecoration: 'none',
                transition: 'all 0.2s ease',
                ...(plan.highlighted
                  ? { background: `linear-gradient(135deg, #F5C645, #E8A020)`, color: '#1A1400', boxShadow: '0 4px 16px rgba(232,160,32,0.28)' }
                  : { border: `1.5px solid ${TEXT}`, color: TEXT }),
              }}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════ 8+9. DARK CTA SECTION — bookends the hero ══════════ */}
      <section style={{ position: 'relative' as const, overflow: 'hidden', background: '#0E0B08', padding: '100px 24px', textAlign: 'center' as const }} className="reveal">
        {/* warm ambient glow */}
        <div style={{ position: 'absolute' as const, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 800, height: 500, background: 'radial-gradient(ellipse, rgba(200,136,28,0.12) 0%, transparent 70%)', pointerEvents: 'none' as const }} />
        <div style={{ position: 'relative' as const, zIndex: 1, maxWidth: 650, margin: '0 auto' }}>
          <blockquote style={{ fontSize: 28, color: '#FFFFFF', lineHeight: 1.35, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 18px' }}>
            The estimating, billing, and field work that used to take five tools and a spreadsheet — done in one place, in a fraction of the time.
          </blockquote>
          <p style={{ color: 'rgba(255,255,255,0.50)', fontSize: 15, margin: '0 0 40px' }}>That&apos;s the whole point of Saguaro.</p>
          <Link href="/signup" className="cta-glow" style={{ background: 'linear-gradient(135deg, #F5C645 0%, #E8A020 100%)', color: '#1A1400', textDecoration: 'none', fontWeight: 800, fontSize: 17, padding: '18px 48px', borderRadius: 14, display: 'inline-block', boxShadow: '0 4px 24px rgba(232,160,32,0.50), 0 16px 48px rgba(232,160,32,0.25)', letterSpacing: '-0.01em' }}>Start Your Free Trial</Link>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 14 }}>No credit card required &middot; 14-day free trial &middot; Cancel anytime</p>
        </div>
      </section>

      {/* ══════════ 10. FOOTER ══════════ */}
      <footer style={{ borderTop: '1px solid #E5E5EA', maxWidth: 1200, margin: '0 auto', padding: '40px 24px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32, marginBottom: 32 }} className="footer-grid">
          {/* product */}
          <div>
            <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1, color: TEXT, marginBottom: 14 }}>Product</h4>
            {['AI Takeoff', 'Pay Applications', 'Invoicing', 'Lien Waivers', 'Field App', 'Bid Packages'].map(l => (
              <div key={l}><Link href="/#features" style={{ color: DIM, textDecoration: 'none', fontSize: 13, lineHeight: 2 }}>{l}</Link></div>
            ))}
          </div>
          {/* company */}
          <div>
            <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1, color: TEXT, marginBottom: 14 }}>Company</h4>
            {['About', 'Careers', 'Contact', 'Partners'].map(l => (
              <div key={l}><Link href={`/${l.toLowerCase()}`} style={{ color: DIM, textDecoration: 'none', fontSize: 13, lineHeight: 2 }}>{l}</Link></div>
            ))}
          </div>
          {/* resources */}
          <div>
            <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1, color: TEXT, marginBottom: 14 }}>Resources</h4>
            {['Blog', 'API Docs', 'Help Center', 'Changelog'].map(l => (
              <div key={l}><Link href={`/${l.toLowerCase().replace(' ', '-')}`} style={{ color: DIM, textDecoration: 'none', fontSize: 13, lineHeight: 2 }}>{l}</Link></div>
            ))}
          </div>
          {/* legal */}
          <div>
            <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1, color: TEXT, marginBottom: 14 }}>Legal</h4>
            {[{ label: 'Privacy Policy', href: '/privacy' }, { label: 'Terms of Service', href: '/terms' }, { label: 'Security', href: '/security' }].map(l => (
              <div key={l.label}><Link href={l.href} style={{ color: DIM, textDecoration: 'none', fontSize: 13, lineHeight: 2 }}>{l.label}</Link></div>
            ))}
          </div>
        </div>
        <div style={{ borderTop: '1px solid #E5E5EA', paddingTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: 12 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }} aria-label="Saguaro Control Systems — home">
            <img src="/logo-horizontal.png" alt="Saguaro Control Systems" height={30} style={{ height: 30, width: 'auto', display: 'block' }} />
          </a>
          <span style={{ fontSize: 12, color: DIM }}>&copy; {new Date().getFullYear()} Saguaro Technologies Inc. All rights reserved.</span>
        </div>
      </footer>

      {/* ══════════ RESPONSIVE CSS ══════════ */}
      <style>{`
        @keyframes navDropFadeIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        .desktop-nav { display: flex !important; }
        .mobile-menu-btn { display: none !important; }
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: block !important; }
          .demo-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
          .feature-grid { grid-template-columns: 1fr !important; }
          /* stat figures stack with top hairlines instead of side dividers */
          .stats-row { grid-template-columns: repeat(2, 1fr) !important; }
          .stats-row > div { border-left: none !important; border-top: 1px solid #E7E5E1 !important; }
          /* pricing columns stack with top hairlines instead of side dividers */
          .pricing-grid { grid-template-columns: 1fr !important; }
          .pricing-grid > div { border-left: none !important; border-top: 1px solid #E7E5E1 !important; }
          .pricing-grid > div:first-child { border-top: none !important; }
          .footer-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 480px) {
          .stats-row { grid-template-columns: 1fr !important; }
          .footer-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
