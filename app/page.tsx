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

/* Flat, calm card surface — no glassmorphism. Confident whitespace + a
   single soft warm shadow reads more premium than frosted blur. */
const glass: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #EAE8E4',
  borderRadius: 16,
  boxShadow: '0 1px 2px rgba(28,25,23,0.04), 0 6px 20px rgba(28,25,23,0.05)',
};

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
    href: '/app/takeoff',
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
    href: '/#pricing',
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

  const menus = {
    platform: {
      label: 'Platform',
      items: [
        { icon: <Blueprint size={22} weight="duotone" color="#C8881C" />, title: 'AI Blueprint Takeoff', desc: 'Plans in, full estimate out in 60 seconds', href: '/app/takeoff' },
        { icon: <ChartLine size={22} weight="duotone" color="#C8881C" />, title: 'Executive Intelligence', desc: 'Multi-project command center', href: '/intelligence' },
      ],
    },
    solutions: {
      label: 'Solutions',
      items: [
        { icon: <Buildings size={22} weight="duotone" color="#C8881C" />, title: 'General Contractors', desc: 'Full project management suite', href: '/signup' },
        { icon: <Hammer size={22} weight="duotone" color="#C8881C" />, title: 'Specialty Subcontractors', desc: 'Subs, trades, and field crews', href: '/signup' },
        { icon: <HouseSimple size={22} weight="duotone" color="#C8881C" />, title: 'Residential Remodelers', desc: 'Homes and renovations', href: '/signup' },
        { icon: <Building size={22} weight="duotone" color="#C8881C" />, title: 'Commercial Contractors', desc: 'Multi-project portfolios', href: '/signup' },
        { icon: <Wrench size={22} weight="duotone" color="#C8881C" />, title: 'Roofing Contractors', desc: 'Roofing-specific workflows', href: '/signup' },
      ],
    },
    resources: {
      label: 'Resources',
      items: [
        { icon: <Calculator size={22} weight="duotone" color="#C8881C" />, title: 'ROI Calculator', desc: 'See your savings vs Procore', href: '/roi-calculator' },
        { icon: <Scales size={22} weight="duotone" color="#C8881C" />, title: 'Compare to Procore', desc: 'Feature-by-feature breakdown', href: '/compare/procore' },
        { icon: <BookOpen size={22} weight="duotone" color="#C8881C" />, title: 'Trade Knowledge Base', desc: 'Step-by-step guides for every trade', href: '/field/trade-guide' },
        { icon: <User size={22} weight="duotone" color="#C8881C" />, title: 'Owner & Sub Portals', desc: 'Client and subcontractor access', href: '/portals/client' },
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

      {/* Desktop menu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} className="desktop-nav">
        {Object.entries(menus).map(([key, menu]) => (
          <div key={key} style={{ position: 'relative' }}>
            <button
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

            {/* Dropdown panel */}
            {openMenu === key && (
              <div
                onMouseLeave={() => setOpenMenu(null)}
                style={{
                  position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                  width: 420, marginTop: 8,
                  background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
                  border: '1px solid rgba(212,160,23,0.15)',
                  borderRadius: 16, padding: '8px',
                  boxShadow: '0 2px 6px rgba(28,25,23,0.06), 0 20px 50px rgba(28,25,23,0.14)',
                  animation: 'navDropFadeIn 0.15s ease',
                }}
              >
                {menu.items.map((item, i) => (
                  <a key={i} href={item.href} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '12px 16px', borderRadius: 10,
                    textDecoration: 'none', transition: 'all 0.15s ease',
                    borderLeft: '3px solid transparent',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(212,160,23,0.06)'; e.currentTarget.style.borderLeftColor = '#C8881C'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderLeftColor = 'transparent'; }}
                  >
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(212,160,23,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {item.icon}
                    </div>
                    <div>
                      <div style={{ color: '#1C1C1E', fontSize: 13, fontWeight: 600 }}>{item.title}</div>
                      <div style={{ color: '#86868B', fontSize: 11, marginTop: 2 }}>{item.desc}</div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Pricing link */}
        <a href="/#pricing" style={{ color: '#1C1C1E', fontSize: 13, fontWeight: 500, padding: '8px 14px', textDecoration: 'none' }}>Pricing</a>
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

/* Saguaro cactus silhouette — the classic trunk + two upswept arms, drawn
   with round-capped strokes for the iconic rounded look. */
function Saguaro({ h = 200, color = '#1a0e16', style }: { h?: number; color?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 100 230" width={h * 0.46} height={h} style={style} fill="none" stroke={color} strokeWidth={17} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M50 230 L50 34" />
      <path d="M50 150 L32 150 L32 102" />
      <path d="M50 118 L70 118 L70 80" />
    </svg>
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
    <div data-landing style={{ background: `linear-gradient(180deg, #FAFAF8 0%, ${BG} 30%, #F5F5F0 100%)`, color: TEXT, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", minHeight: '100vh', overflowX: 'hidden' as const }}>

      {/* ══════════ 1. TOP BANNER ══════════ */}
      {bannerVisible && (
        <div style={{ background: 'linear-gradient(90deg, rgba(212,160,23,0.12) 0%, rgba(212,160,23,0.05) 100%)', borderBottom: '1px solid rgba(212,160,23,0.2)', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, position: 'relative' as const }}>
          <span style={{ color: GOLD, fontWeight: 600 }}>Procore users: Switch in 1 day — Free migration included.</span>
          <Link href="/roi-calculator" style={{ color: GOLD, textDecoration: 'underline', fontWeight: 500 }}>Calculate your savings &rarr;</Link>
          <button onClick={() => setBannerVisible(false)} style={{ position: 'absolute' as const, right: 16, background: 'none', border: 'none', color: DIM, cursor: 'pointer', fontSize: 18, lineHeight: 1 }} aria-label="Dismiss banner">&times;</button>
        </div>
      )}

      {/* ══════════ 2. NAV WITH DROPDOWNS ══════════ */}
      <MarketingNav />

      {/* ══════════ 3. HERO — cinematic Arizona desert sunset ══════════ */}
      <section style={{ position: 'relative' as const, width: '100%', overflow: 'hidden', minHeight: 560, display: 'flex', alignItems: 'center' }}>
        {/* ── Sky: layered sunset gradient ── */}
        <div style={{ position: 'absolute' as const, inset: 0, zIndex: 0, background: 'linear-gradient(to bottom, #1a1338 0%, #38245c 22%, #6e3563 42%, #b14d44 60%, #d4722a 76%, #e8a83d 92%, #f0c266 100%)' }} />
        {/* ── Sun glow near the horizon ── */}
        <div style={{ position: 'absolute' as const, left: '62%', top: '46%', width: 520, height: 520, transform: 'translate(-50%,-50%)', zIndex: 0, background: 'radial-gradient(circle, rgba(255,236,180,0.95) 0%, rgba(247,190,90,0.55) 22%, rgba(232,140,40,0.18) 45%, transparent 68%)', pointerEvents: 'none' as const }} />
        {/* ── Distant mountain ridge ── */}
        <svg viewBox="0 0 1440 200" preserveAspectRatio="none" style={{ position: 'absolute' as const, bottom: 96, left: 0, width: '100%', height: 150, zIndex: 0, opacity: 0.55 }} aria-hidden="true">
          <path d="M0 200 L0 120 L180 70 L360 130 L540 60 L760 140 L980 80 L1180 150 L1440 90 L1440 200 Z" fill="#3a2148" />
        </svg>
        <svg viewBox="0 0 1440 160" preserveAspectRatio="none" style={{ position: 'absolute' as const, bottom: 96, left: 0, width: '100%', height: 110, zIndex: 0, opacity: 0.75 }} aria-hidden="true">
          <path d="M0 160 L0 110 L260 60 L520 120 L780 70 L1040 130 L1300 80 L1440 120 L1440 160 Z" fill="#2a1530" />
        </svg>
        {/* ── Foreground desert floor ── */}
        <div style={{ position: 'absolute' as const, bottom: 0, left: 0, width: '100%', height: 110, zIndex: 1, background: 'linear-gradient(to bottom, #1a0e1a 0%, #14090f 100%)' }} />
        {/* ── Saguaro cacti silhouettes (foreground) ── */}
        <Saguaro h={150} color="#160a12" style={{ position: 'absolute', bottom: 74, left: '6%', zIndex: 2, opacity: 0.9 }} />
        <Saguaro h={230} color="#100810" style={{ position: 'absolute', bottom: 70, left: '15%', zIndex: 2 }} />
        <Saguaro h={120} color="#1a0c14" style={{ position: 'absolute', bottom: 78, right: '9%', zIndex: 2, opacity: 0.85 }} />
        <Saguaro h={190} color="#100810" style={{ position: 'absolute', bottom: 72, right: '3%', zIndex: 2 }} />
        {/* ── Readability scrim: darker on the left, fading right ── */}
        <div style={{ position: 'absolute' as const, inset: 0, zIndex: 2, background: 'linear-gradient(to right, rgba(12,8,20,0.62) 0%, rgba(12,8,20,0.32) 45%, rgba(12,8,20,0.05) 75%, transparent 100%)', pointerEvents: 'none' as const }} />

        {/* ── Content ── */}
        <div style={{ position: 'relative' as const, zIndex: 3, maxWidth: 1200, width: '100%', margin: '0 auto', padding: '96px 24px 130px' }}>
          <div style={{ maxWidth: 620 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(255,220,140,0.14)', border: '1px solid rgba(255,220,140,0.35)', color: '#FBE3A8', fontSize: 11, fontWeight: 700, letterSpacing: 1.2, padding: '6px 13px', borderRadius: 999, marginBottom: 22, textTransform: 'uppercase' as const, backdropFilter: 'blur(4px)' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FBE3A8', boxShadow: '0 0 8px rgba(251,227,168,0.8)' }} />AI-Powered Construction CRM</span>
            <h1 style={{ fontSize: 54, fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.03em', margin: '0 0 20px', color: '#FFFFFF', textShadow: '0 2px 24px rgba(0,0,0,0.35)' }}>The smarter CRM built<br />for general contractors</h1>
            <p style={{ color: 'rgba(255,255,255,0.92)', fontSize: 18, lineHeight: 1.6, margin: '0 0 32px', maxWidth: 510, textShadow: '0 1px 12px rgba(0,0,0,0.35)' }}>AI takeoffs that read your blueprints in seconds. Sage, your built-in assistant, handles bids, pay apps, and compliance — so you can focus on building.</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const }}>
              <Link href="/signup" className="cta-glow" style={{ background: `linear-gradient(135deg, #F5C645, #E0991A)`, color: '#1C1917', textDecoration: 'none', fontWeight: 800, fontSize: 15, padding: '14px 32px', borderRadius: 11, display: 'inline-flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 18px rgba(224,153,26,0.45), 0 10px 34px rgba(224,153,26,0.30)' }}>Start Free Trial <span style={{ fontSize: 16 }}>&rarr;</span></Link>
              <Link href="/#demo" style={{ color: '#FFFFFF', textDecoration: 'none', fontWeight: 600, fontSize: 15, padding: '14px 28px', borderRadius: 11, border: '1px solid rgba(255,255,255,0.45)', display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(6px)' }}>
                <svg viewBox="0 0 20 20" width={15} height={15} fill="#FFFFFF"><polygon points="5,3 19,10 5,17" /></svg> Watch Demo
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Floating product mockup, overlapping the hero's base ── */}
      <span id="how-it-works" aria-hidden="true" style={{ position: 'absolute' as const, scrollMarginTop: 72 }} />
      <div style={{ maxWidth: 760, margin: '-86px auto 0', padding: '0 24px', position: 'relative' as const, zIndex: 4 }}>
        <div id="demo" style={{ background: '#FFFFFF', border: '1px solid #EAE8E4', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 60px rgba(28,25,23,0.22), 0 4px 12px rgba(28,25,23,0.08)', scrollMarginTop: 72 }}>
          {/* browser chrome */}
          <div style={{ background: '#F7F6F4', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #EAE8E4' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#EF4444' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: GOLD }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: GREEN }} />
            <span style={{ flex: 1, background: 'rgba(0,0,0,0.05)', borderRadius: 6, padding: '4px 12px', fontSize: 11, color: DIM, marginLeft: 8 }}>app.saguaro.build/takeoff</span>
          </div>
          {/* mockup content */}
          <div style={{ padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>AI Takeoff Results</span>
              <span style={{ fontSize: 11, color: GOLD, fontWeight: 600, background: 'rgba(212,160,23,0.12)', padding: '3px 10px', borderRadius: 12 }}>38s &bull; 47 items</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 1, marginBottom: 2 }}>
              {['Item', 'Qty', 'Unit', 'Cost'].map(h => (
                <div key={h} style={{ fontSize: 10, color: DIM, fontWeight: 600, textTransform: 'uppercase' as const, padding: '6px 8px', background: 'rgba(0,0,0,0.03)' }}>{h}</div>
              ))}
            </div>
            {[
              ['Concrete Footing', '124', 'CY', '$18,600'],
              ['#5 Rebar', '2,400', 'LF', '$4,320'],
              ['CMU 8" Block', '3,650', 'EA', '$10,950'],
              ['Rigid Insulation', '4,800', 'SF', '$7,200'],
              ['Structural Steel', '48', 'TON', '$96,000'],
            ].map((row, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 1, marginBottom: 1 }}>
                {row.map((cell, j) => (
                  <div key={j} style={{ fontSize: 12, color: j === 3 ? GOLD : j === 0 ? TEXT : DIM, padding: '7px 8px', background: i % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent', fontWeight: j === 3 ? 600 : 400, fontVariantNumeric: 'tabular-nums' }}>{cell}</div>
                ))}
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, padding: '10px 8px', borderTop: `1px solid rgba(212,160,23,0.2)` }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>Total Estimate</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: GOLD }}>$137,070</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── capability proof bar — honest product facts, not invented metrics ── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '52px 24px 56px' }} className="reveal">
        <p style={{ textAlign: 'center' as const, fontSize: 13, color: DIM, marginBottom: 20, letterSpacing: '0.01em' }}>Everything a GC needs to bid, build, and bill — in one platform</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }} className="stats-grid reveal-stagger">
          {[
            { val: '< 60s', lbl: 'Per blueprint takeoff' },
            { val: 'G702/703', lbl: 'AIA pay apps built in' },
            { val: '50-state', lbl: 'Lien waivers included' },
            { val: '⅓', lbl: 'The cost of Procore' },
          ].map(s => (
            <div key={s.lbl} className="lift-card" style={{ ...glass, padding: '22px 24px', textAlign: 'center' as const }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#C8881C', letterSpacing: '-0.02em' }}>{s.val}</div>
              <div style={{ fontSize: 12.5, color: DIM, marginTop: 7, fontWeight: 500 }}>{s.lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Integration logos — real vendor marks (react-icons), only for shipped integrations */}
      <IntegrationStrip />

      {/* ══════════ 4. FEATURE GRID ══════════ */}
      <section id="features" style={{ maxWidth: 1100, margin: '0 auto', padding: '72px 24px' }} className="reveal">
        <h2 style={{ textAlign: 'center' as const, fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 10, color: TEXT }}>Everything you need. Nothing you don&apos;t.</h2>
        <p style={{ textAlign: 'center' as const, color: DIM, fontSize: 14, marginBottom: 48, maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>One platform replaces Procore, spreadsheets, and 5 other tools.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }} className="feature-grid reveal-stagger">
          {FEATURES.map(f => (
            <div key={f.title} className="glow-card" style={{ padding: '28px 24px', display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(200,136,28,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: GOLD, flexShrink: 0 }}>
                <Icon d={f.icon} />
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: TEXT }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: DIM, lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════ 6. COMPARISON TABLE ══════════ */}
      <section id="compare" style={{ maxWidth: 900, margin: '0 auto', padding: '64px 24px' }} className="reveal">
        <h2 style={{ textAlign: 'center' as const, fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 10, color: TEXT }}>Why GCs switch from Procore</h2>
        <p style={{ textAlign: 'center' as const, color: DIM, fontSize: 14, marginBottom: 32 }}>Feature-for-feature, here&apos;s how Saguaro compares — at a third of the price.</p>
        <div style={{ ...glass, overflow: 'hidden', boxShadow: '0 1px 2px rgba(28,25,23,0.04), 0 12px 32px rgba(28,25,23,0.07)' }}>
          {/* header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', borderBottom: '1px solid #E5E5EA' }}>
            <div style={{ padding: '14px 20px', fontSize: 12, fontWeight: 600, color: DIM }}>Feature</div>
            <div style={{ padding: '14px 12px', fontSize: 12, fontWeight: 700, color: GOLD, textAlign: 'center' as const }}>Saguaro</div>
            <div style={{ padding: '14px 12px', fontSize: 13, fontWeight: 700, color: DIM, textAlign: 'center' as const }}>Procore</div>
            <div style={{ padding: '14px 12px', fontSize: 12, fontWeight: 600, color: DIM, textAlign: 'center' as const, opacity: 0.6 }}>Buildertrend</div>
          </div>
          {/* rows */}
          {COMPARISON_ROWS.map((r, i) => (
            <div key={r.feature} className="compare-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', borderBottom: i < COMPARISON_ROWS.length - 1 ? '1px solid #E5E5EA' : 'none', background: i % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent', transition: 'background 0.2s ease' }}>
              <div style={{ padding: '11px 20px', fontSize: 13, color: TEXT }}>{r.feature}</div>
              <div style={{ padding: '11px 12px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {r.feature === 'Starting Price' ? <PriceLabel v={r.saguaro} /> : <StatusCell v={r.saguaro} />}
              </div>
              <div style={{ padding: '11px 12px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {r.feature === 'Starting Price' ? <PriceLabel v={r.procore} /> : <StatusCell v={r.procore} />}
              </div>
              <div style={{ padding: '11px 12px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {r.feature === 'Starting Price' ? <PriceLabel v={r.buildertrend} /> : <StatusCell v={r.buildertrend} />}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════ 7. PRICING ══════════ */}
      <section id="pricing" style={{ maxWidth: 1000, margin: '0 auto', padding: '64px 24px' }} className="reveal">
        <h2 style={{ textAlign: 'center' as const, fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 10, color: TEXT }}>Simple, transparent pricing</h2>
        <p style={{ textAlign: 'center' as const, color: DIM, fontSize: 14, marginBottom: 36 }}>No hidden fees. No per-user charges. Cancel anytime.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, alignItems: 'stretch' }} className="pricing-grid reveal-stagger">
          {PLANS.map(plan => (
            <div key={plan.name} className={`lift-card${plan.highlighted ? ' lift-card-gold' : ''}`} style={{
              background: '#FFFFFF',
              border: plan.highlighted ? '1px solid rgba(212,160,23,0.4)' : '1px solid #E5E5EA',
              borderRadius: 16,
              padding: '28px 24px',
              position: 'relative' as const,
              boxShadow: plan.highlighted ? '0 0 0 1px rgba(212,160,23,0.25), 0 2px 4px rgba(28,25,23,0.05), 0 16px 40px rgba(200,136,28,0.14)' : '0 1px 2px rgba(28,25,23,0.04), 0 8px 24px rgba(28,25,23,0.06)',
              display: 'flex',
              flexDirection: 'column' as const,
              transition: 'all 0.3s ease',
            }}>
              {plan.highlighted && (
                <span style={{ position: 'absolute' as const, top: -11, left: '50%', transform: 'translateX(-50%)', background: GOLD, color: '#000', fontSize: 10, fontWeight: 800, padding: '3px 14px', borderRadius: 10, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>Most Popular</span>
              )}
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{plan.name}</h3>
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: plan.highlighted ? GOLD : TEXT }}>{plan.price}</span>
                {plan.period && <span style={{ fontSize: 14, color: DIM }}>{plan.period}</span>}
              </div>
              <p style={{ fontSize: 12, color: DIM, marginBottom: 20 }}>{plan.desc}</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', flex: 1 }}>
                {plan.features.map(f => (
                  <li key={f} style={{ fontSize: 13, color: DIM, padding: '5px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg viewBox="0 0 16 16" width={14} height={14} fill={plan.highlighted ? GOLD : GREEN}><path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm3.4 6.2-4 4a.7.7 0 0 1-1 0l-1.8-1.8a.7.7 0 1 1 1-1l1.3 1.3 3.5-3.5a.7.7 0 0 1 1 1z" /></svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href={plan.name === 'Enterprise' ? '/contact' : '/signup'} style={{
                display: 'block',
                textAlign: 'center' as const,
                padding: '11px 0',
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 14,
                textDecoration: 'none',
                ...(plan.highlighted
                  ? { background: GOLD, color: '#000' }
                  : { border: '1px solid #E5E5EA', color: TEXT }),
              }}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════ 8. PROMISE — honest pull-quote, no fabricated customer ══════════ */}
      <section style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px', textAlign: 'center' as const }} className="reveal">
        <blockquote style={{ fontSize: 26, color: TEXT, lineHeight: 1.4, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 18px' }}>
          The estimating, billing, and field work that used to take five tools and a spreadsheet — done in one place, in a fraction of the time.
        </blockquote>
        <p style={{ color: DIM, fontSize: 14, margin: 0 }}>That&apos;s the whole point of Saguaro.</p>
      </section>

      {/* ══════════ 9. CTA SECTION ══════════ */}
      <section style={{ maxWidth: 700, margin: '0 auto', padding: '72px 24px 80px', textAlign: 'center' as const, background: 'radial-gradient(ellipse at center, rgba(212,160,23,0.08) 0%, transparent 70%)' }} className="reveal">
        <h2 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 12, color: TEXT }}>Ready to build smarter?</h2>
        <p style={{ color: DIM, fontSize: 15, marginBottom: 28 }}>Start your free trial today — no credit card, no sales call, no contract.</p>
        <Link href="/signup" className="cta-glow" style={{ background: `linear-gradient(135deg, ${GOLD}, #B8860B)`, color: '#000', textDecoration: 'none', fontWeight: 800, fontSize: 16, padding: '14px 40px', borderRadius: 12, display: 'inline-block', boxShadow: '0 4px 24px rgba(212,160,23,0.3), 0 12px 40px rgba(212,160,23,0.15)' }}>Start Your Free Trial</Link>
        <p style={{ color: DIM, fontSize: 12, marginTop: 12 }}>No credit card required. 14-day free trial.</p>
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
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .feature-grid { grid-template-columns: 1fr !important; }
          .pricing-grid { grid-template-columns: 1fr !important; }
          .footer-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 480px) {
          .stats-grid { grid-template-columns: 1fr !important; }
          .footer-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
