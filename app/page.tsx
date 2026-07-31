'use client';
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Blueprint, Robot, CurrencyDollar, DeviceMobile, PaintBrush, WifiHigh, Cube, Drone, Buildings, Hammer, HouseSimple, Building, ShieldCheck, ChartLine, User, UsersThree, PenNib, Handshake, BookOpen, Calculator, Scales, Wrench, Trophy, CaretDown, List, X } from '@phosphor-icons/react';
import { IntegrationStrip } from '../components/Integrations';
import PromoTicker from '../components/PromoTicker';

/* ── palette ── */
const BG = '#0a0a0a';
const CARD = '#141416';
const GOLD = '#F59E0B';
const GREEN = '#34C759';
const TEXT = '#FFFFFF';
const DIM = '#CBD5E1';

const glass: React.CSSProperties = {
  background: 'rgba(20,20,22,0.65)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 16,
  boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(0,0,0,0.05)',
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
    desc: 'Upload any PDF blueprint. Sage reads dimensions, calculates materials, and generates a full bid estimate.',
    href: '/takeoff',
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
  v === 'yes' ? <span style={{ color: GREEN, fontWeight: 600, fontSize: 13 }}>$499/mo</span>
    : v === 'partial' ? <span style={{ color: GOLD, fontWeight: 600, fontSize: 13 }}>$399/mo</span>
    : <span style={{ color: '#EF4444', fontWeight: 600, fontSize: 13 }}>$1,000+/mo</span>;

/* ── pricing data ── */
const PLANS = [
  {
    name: 'Starter',
    price: '$499',
    period: '/mo',
    desc: 'Perfect for small GCs getting started',
    features: ['Unlimited users — no per-seat fees', '15 active projects', 'AI Takeoff (150 pages/mo)', 'Pay apps & invoicing', 'Lien waivers', 'Mobile field app', 'Email support'],
    cta: 'Start Free Trial',
    highlighted: false,
  },
  {
    name: 'Professional',
    price: '$750',
    period: '/mo',
    desc: 'For growing contractors who need it all',
    features: ['Unlimited users — no per-seat fees', 'Unlimited projects', 'Unlimited AI Takeoffs', 'Sage AI Assistant', 'Bid package manager', 'Client & sub portals', 'Certified payroll', 'Priority support'],
    cta: 'Start Free Trial',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Call for Quote',
    period: '',
    desc: 'For large firms with custom needs',
    features: ['Everything in Professional', 'Dedicated account manager', 'Custom integrations', 'SSO & advanced security', 'On-site training', 'SLA guarantee', 'API access'],
    cta: 'Contact Sales',
    highlighted: false,
  },
];

/* ===========================
   MAIN PAGE COMPONENT
   =========================== */
export default function LandingPage() {
  /* menuOpen state removed — dropdowns handle their own state via IIFE */

  return (
    <div data-landing style={{ background: BG, color: TEXT, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", minHeight: '100vh', overflowX: 'hidden' as const }}>

      {/* ══════════ 1. TOP TICKER ══════════ */}
      <PromoTicker />

      {/* ══════════ 2. NAV WITH DROPDOWNS ══════════ */}
      {(() => {
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
              { icon: <Blueprint size={22} weight="duotone" color="#F59E0B" />, title: 'AI Blueprint Takeoff', desc: 'Plans in, measured quantities out', href: '/takeoff' },
              { icon: <ChartLine size={22} weight="duotone" color="#F59E0B" />, title: 'Executive Intelligence', desc: 'Multi-project command center', href: '/intelligence' },
            ],
          },
          solutions: {
            label: 'Solutions',
            items: [
              { icon: <Buildings size={22} weight="duotone" color="#F59E0B" />, title: 'General Contractors', desc: 'Full project management suite', href: '/industry/general-contractors' },
              { icon: <Hammer size={22} weight="duotone" color="#F59E0B" />, title: 'Specialty Subcontractors', desc: 'Subs, trades, and field crews', href: '/industry/specialty-subcontractors' },
              { icon: <HouseSimple size={22} weight="duotone" color="#F59E0B" />, title: 'Residential Remodelers', desc: 'Homes and renovations', href: '/industry/residential-remodelers' },
              { icon: <Building size={22} weight="duotone" color="#F59E0B" />, title: 'Commercial Contractors', desc: 'Multi-project portfolios', href: '/industry/commercial-contractors' },
              { icon: <Wrench size={22} weight="duotone" color="#F59E0B" />, title: 'Roofing Contractors', desc: 'Roofing-specific workflows', href: '/industry/roofing-contractors' },
            ],
          },
          resources: {
            label: 'Resources',
            items: [
              { icon: <Calculator size={22} weight="duotone" color="#F59E0B" />, title: 'ROI Calculator', desc: 'See your savings vs Procore', href: '/roi-calculator' },
              { icon: <Scales size={22} weight="duotone" color="#F59E0B" />, title: 'Compare to Procore', desc: 'Feature-by-feature breakdown', href: '/compare/procore' },
              { icon: <BookOpen size={22} weight="duotone" color="#F59E0B" />, title: 'Trade Knowledge Base', desc: 'Step-by-step guides for every trade', href: '/field/trade-guide' },
              { icon: <User size={22} weight="duotone" color="#F59E0B" />, title: 'Owner & Sub Portals', desc: 'Client and subcontractor access', href: '/portals/client' },
            ],
          },
        };

        return (
          <nav ref={navRef} style={{
            position: 'sticky', top: 0, zIndex: 100,
            background: 'rgba(20,20,22,0.85)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
            borderBottom: '1px solid rgba(245, 158, 11,0.12)',
            padding: '0 max(24px, 4vw)', height: 56,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            {/* Logo lockup — full horizontal badge + wordmark artwork */}
            <Link href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }} aria-label="Saguaro Control Systems — home">
              <img src="/logo-horizontal.png" alt="Saguaro Control Systems" height={34} style={{ height: 34, width: 'auto', display: 'block' }} />
            </Link>

            {/* Desktop menu */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} className="desktop-nav">
              {Object.entries(menus).map(([key, menu]) => (
                <div key={key} style={{ position: 'relative' }}>
                  <button
                    onClick={() => setOpenMenu(openMenu === key ? null : key)}
                    onMouseEnter={() => setOpenMenu(key)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: openMenu === key ? '#F59E0B' : '#FFFFFF',
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
                        background: 'rgba(20,20,22,0.92)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
                        border: '1px solid rgba(245, 158, 11,0.15)',
                        borderRadius: 16, padding: '8px',
                        boxShadow: '0 24px 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(0,0,0,0.04)',
                        animation: 'navDropFadeIn 0.15s ease',
                      }}
                    >
                      {menu.items.map((item, i) => (
                        <Link key={i} href={item.href} style={{
                          display: 'flex', alignItems: 'center', gap: 14,
                          padding: '12px 16px', borderRadius: 10,
                          textDecoration: 'none', transition: 'all 0.15s ease',
                          borderLeft: '3px solid transparent',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(245, 158, 11,0.06)'; e.currentTarget.style.borderLeftColor = '#F59E0B'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderLeftColor = 'transparent'; }}
                        >
                          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(245, 158, 11,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {item.icon}
                          </div>
                          <div>
                            <div style={{ color: '#FFFFFF', fontSize: 13, fontWeight: 600 }}>{item.title}</div>
                            <div style={{ color: '#CBD5E1', fontSize: 11, marginTop: 2 }}>{item.desc}</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Pricing link */}
              <Link href="/#pricing" style={{ color: '#FFFFFF', fontSize: 13, fontWeight: 500, padding: '8px 14px', textDecoration: 'none' }}>Pricing</Link>
            </div>

            {/* Right side CTAs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Link href="/login" style={{ color: '#CBD5E1', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>Log In</Link>
              <Link href="/signup" style={{
                background: GOLD,
                color: '#0a0a0a', fontSize: 13, fontWeight: 600,
                padding: '8px 18px', borderRadius: 8, textDecoration: 'none',
              }}>Start free</Link>

              {/* Mobile hamburger */}
              <button onClick={() => setMobileOpen(!mobileOpen)} style={{ display: 'none', background: 'none', border: 'none', color: '#FFFFFF', cursor: 'pointer', padding: 4 }} className="mobile-menu-btn">
                {mobileOpen ? <X size={24} /> : <List size={24} />}
              </button>
            </div>
          </nav>
        );
      })()}

      {/* ══════════ 3. HERO ══════════ */}
      <section style={{ maxWidth: 1160, margin: '0 auto', padding: '68px 24px 56px', display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: 64, alignItems: 'center', position: 'relative' as const }} className="hero-grid">
        {/* very subtle ambient warmth — minimal, no stock photo */}
        <div style={{ position: 'absolute' as const, top: -120, right: -40, width: 460, height: 460, background: 'radial-gradient(circle, rgba(245,158,11,0.05) 0%, transparent 68%)', zIndex: 0, pointerEvents: 'none' as const }} />
        {/* left */}
        <div style={{ position: 'relative', zIndex: 1, minWidth: 0 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'transparent', border: '1px solid rgba(255,255,255,0.14)', color: DIM, fontSize: 10.5, fontWeight: 500, letterSpacing: 0.8, padding: '5px 12px', borderRadius: 999, marginBottom: 24, textTransform: 'uppercase' as const }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: GOLD }} />AI-Powered Construction CRM</span>
          <h1 style={{ fontSize: 32, fontWeight: 600, lineHeight: 1.15, letterSpacing: '-0.03em', margin: '0 0 20px', color: TEXT }}>The smarter CRM built<br />for general contractors</h1>
          <p style={{ color: DIM, fontSize: 15, fontWeight: 400, lineHeight: 1.7, margin: '0 0 32px', maxWidth: 452 }}>AI-powered takeoffs that read your blueprints in seconds. Sage, your built-in assistant, handles bids, pay apps, and compliance so you can focus on building.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const, alignItems: 'center' }}>
            <Link href="/signup" style={{ background: GOLD, color: '#0a0a0a', textDecoration: 'none', fontWeight: 600, fontSize: 13.5, padding: '10px 22px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}>Start free trial <span style={{ fontSize: 15 }}>&rarr;</span></Link>
            <Link href="/#demo" style={{ color: DIM, textDecoration: 'none', fontWeight: 500, fontSize: 13.5, padding: '10px 18px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <svg viewBox="0 0 20 20" width={13} height={13} fill="currentColor"><polygon points="5,3 19,10 5,17" /></svg> Watch demo
            </Link>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 24, fontWeight: 400 }}>Construction management &middot; Project controls &middot; National rollout specialists</div>
        </div>

        {/* "How It Works" anchor target — points to the demo mockup region */}
        <span id="how-it-works" aria-hidden="true" style={{ position: 'absolute' as const, top: 0, scrollMarginTop: 72 }} />
        {/* right — takeoff mockup */}
        <div id="demo" style={{ ...glass, padding: 0, overflow: 'hidden', position: 'relative', zIndex: 1, scrollMarginTop: 72, minWidth: 0, maxWidth: '100%' }} className="hero-mockup">
          {/* browser chrome */}
          <div style={{ background: 'rgba(20,20,22,0.8)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#EF4444' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: GOLD }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: GREEN }} />
            <span style={{ flex: 1, background: 'rgba(0,0,0,0.06)', borderRadius: 6, padding: '4px 12px', fontSize: 11, color: DIM, marginLeft: 8 }}>app.saguaro.build/takeoff</span>
          </div>
          {/* mockup content */}
          <div style={{ padding: 20, background: `linear-gradient(135deg, ${BG} 0%, rgba(20,20,22,0.95) 50%, rgba(20,20,22,0.98) 100%)` }}>
            {/* toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>AI Takeoff Results</span>
              <span style={{ fontSize: 11, color: GOLD, fontWeight: 600, background: 'rgba(245, 158, 11,0.12)', padding: '3px 10px', borderRadius: 12 }}>38s &bull; 47 items</span>
            </div>
            {/* table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 1, marginBottom: 2 }}>
              {['Item', 'Qty', 'Unit', 'Cost'].map(h => (
                <div key={h} style={{ fontSize: 10, color: DIM, fontWeight: 600, textTransform: 'uppercase' as const, padding: '6px 8px', background: 'rgba(0,0,0,0.03)' }}>{h}</div>
              ))}
            </div>
            {/* table rows */}
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
            {/* total bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, padding: '10px 8px', borderTop: `1px solid rgba(245, 158, 11,0.2)` }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>Total Estimate</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: GOLD }}>$137,070</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── social proof bar ── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '8px 24px 56px' }}>
        <p style={{ textAlign: 'center' as const, fontSize: 13, color: DIM, marginBottom: 20 }}>Trusted by <span style={{ color: TEXT, fontWeight: 600 }}>200+ general contractors</span> in Arizona</p>
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap' as const, gap: 0 }} className="stats-grid">
          {[
            { val: '12,400+', lbl: 'AI takeoffs run' },
            { val: '580K+', lbl: 'Line items generated' },
            { val: '4.2 hrs', lbl: 'Avg. time saved' },
            { val: '8,900+', lbl: 'Blueprints analyzed' },
          ].map((s, i) => (
            <div key={s.lbl} style={{ display: 'flex', alignItems: 'center' }}>
              {i > 0 && <div style={{ width: 1, height: 30, background: 'rgba(255,255,255,0.08)', margin: '0 44px' }} />}
              <div style={{ textAlign: 'center' as const }}>
                <div style={{ fontSize: 19, fontWeight: 600, color: TEXT, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{s.val}</div>
                <div style={{ fontSize: 12, color: DIM, marginTop: 5, fontWeight: 400 }}>{s.lbl}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Integration logos — real vendor marks (react-icons), only for shipped integrations */}
      <IntegrationStrip />

      {/* ══════════ 4. FEATURE GRID ══════════ */}
      <section id="features" style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 24px' }}>
        <h2 style={{ textAlign: 'center' as const, fontSize: 26, fontWeight: 800, letterSpacing: '-0.01em', marginBottom: 8 }}>Everything You Need. Nothing You Don&apos;t.</h2>
        <p style={{ textAlign: 'center' as const, color: DIM, fontSize: 14, marginBottom: 40, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>One platform replaces Procore, spreadsheets, and 5 other tools.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '44px 48px', maxWidth: 1000, margin: '0 auto' }} className="feature-grid">
          {FEATURES.map(f => (
            <div key={f.title}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(245, 158, 11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: GOLD, marginBottom: 14 }}>
                <Icon d={f.icon} />
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 7, color: TEXT }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: DIM, lineHeight: 1.6, margin: '0 0 10px' }}>{f.desc}</p>
              <Link href={f.href} style={{ fontSize: 12.5, color: GOLD, fontWeight: 500, textDecoration: 'none' }}>Learn more &rarr;</Link>
            </div>
          ))}
        </div>
      </section>


      {/* ══════════ 6. COMPARISON TABLE ══════════ */}
      <section id="compare" style={{ maxWidth: 900, margin: '0 auto', padding: '64px 24px' }}>
        <h2 style={{ textAlign: 'center' as const, fontSize: 24, fontWeight: 800, letterSpacing: '-0.01em', marginBottom: 8 }}>Why GCs Switch from Procore</h2>
        <p style={{ textAlign: 'center' as const, color: DIM, fontSize: 14, marginBottom: 32 }}>Feature-for-feature comparison — see why 200+ contractors made the switch.</p>
        <div style={{ ...glass, overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(0,0,0,0.06)' }}>
          {/* header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
            <div style={{ padding: '14px 20px', fontSize: 12, fontWeight: 600, color: DIM }}>Feature</div>
            <div style={{ padding: '14px 12px', fontSize: 12, fontWeight: 700, color: GOLD, textAlign: 'center' as const }}>Saguaro</div>
            <div style={{ padding: '14px 12px', fontSize: 13, fontWeight: 700, color: DIM, textAlign: 'center' as const }}>Procore</div>
            <div style={{ padding: '14px 12px', fontSize: 12, fontWeight: 600, color: DIM, textAlign: 'center' as const, opacity: 0.6 }}>Buildertrend</div>
          </div>
          {/* rows */}
          {COMPARISON_ROWS.map((r, i) => (
            <div key={r.feature} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', borderBottom: i < COMPARISON_ROWS.length - 1 ? '1px solid rgba(255,255,255,0.12)' : 'none', background: i % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent' }}>
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
      <section id="pricing" style={{ maxWidth: 1000, margin: '0 auto', padding: '64px 24px' }}>
        <h2 style={{ textAlign: 'center' as const, fontSize: 24, fontWeight: 800, letterSpacing: '-0.01em', marginBottom: 8 }}>Simple, Transparent Pricing</h2>
        <p style={{ textAlign: 'center' as const, color: DIM, fontSize: 14, marginBottom: 36 }}>No hidden fees. No per-user charges. Cancel anytime.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, alignItems: 'stretch' }} className="pricing-grid">
          {PLANS.map(plan => (
            <div key={plan.name} style={{
              background: 'rgba(255,255,255,0.02)',
              border: plan.highlighted ? '1px solid rgba(245, 158, 11,0.35)' : '1px solid rgba(255,255,255,0.09)',
              borderRadius: 14,
              padding: '28px 24px',
              position: 'relative' as const,
              boxShadow: 'none',
              display: 'flex',
              flexDirection: 'column' as const,
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
                  : { border: '1px solid rgba(255,255,255,0.12)', color: TEXT }),
              }}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════ 8. TESTIMONIAL ══════════ */}
      <section style={{ maxWidth: 680, margin: '0 auto', padding: '56px 24px', textAlign: 'center' as const }}>
        <blockquote style={{ fontSize: 17, fontWeight: 400, color: TEXT, lineHeight: 1.55, letterSpacing: '-0.01em', margin: '0 0 20px', maxWidth: 580, marginLeft: 'auto', marginRight: 'auto' }}>&ldquo;We switched from Procore six months ago and haven&apos;t looked back. The AI takeoff alone saves our estimator 20 hours a week. At a third of the price, it was a no-brainer.&rdquo;</blockquote>
        <p style={{ fontWeight: 600, fontSize: 13.5, margin: '0 0 2px', color: TEXT }}>Marcus Torres</p>
        <p style={{ color: DIM, fontSize: 12.5, margin: 0 }}>VP of Operations &mdash; Sonoran Builders, Phoenix AZ</p>
      </section>

      {/* ══════════ 9. CTA SECTION ══════════ */}
      <section style={{ maxWidth: 640, margin: '0 auto', padding: '88px 24px 96px', textAlign: 'center' as const }}>
        <h2 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 12 }}>Ready to build smarter?</h2>
        <p style={{ color: DIM, fontSize: 14, marginBottom: 28 }}>Join 200+ general contractors who switched to Saguaro and never looked back.</p>
        <Link href="/signup" style={{ background: GOLD, color: '#0a0a0a', textDecoration: 'none', fontWeight: 600, fontSize: 14, padding: '12px 30px', borderRadius: 8, display: 'inline-block' }}>Start your free trial</Link>
        <p style={{ color: DIM, fontSize: 12, marginTop: 14 }}>No credit card required. 14-day free trial.</p>
      </section>

      {/* ══════════ 10. FOOTER ══════════ */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.12)', maxWidth: 1200, margin: '0 auto', padding: '40px 24px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32, marginBottom: 32 }} className="footer-grid">
          {/* product */}
          <div>
            <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1, color: TEXT, marginBottom: 14 }}>Product</h4>
            {[
              { l: 'AI Takeoff', h: '/takeoff' },
              { l: 'Pay Applications', h: '/features' },
              { l: 'Invoicing', h: '/features' },
              { l: 'Lien Waivers', h: '/features' },
              { l: 'Field App', h: '/get-the-app' },
              { l: 'Bid Packages', h: '/features' },
            ].map(({ l, h }) => (
              <div key={l}><Link href={h} style={{ color: DIM, textDecoration: 'none', fontSize: 13, lineHeight: 2 }}>{l}</Link></div>
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
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: 12 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }} aria-label="Saguaro Control Systems — home">
            <img src="/logo-horizontal.png" alt="Saguaro Control Systems" height={30} style={{ height: 30, width: 'auto', display: 'block' }} />
          </Link>
          <span style={{ fontSize: 12, color: DIM }}>&copy; {new Date().getFullYear()} Saguaro Control Systems. All rights reserved. &middot; <span style={{ color: GOLD, fontWeight: 600 }}>Control Every Project. Deliver Every Promise.</span></span>
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
          .hero-grid { grid-template-columns: 1fr !important; }
          .hero-mockup { display: none !important; }
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .feature-grid { grid-template-columns: 1fr !important; }
          .design-grid { grid-template-columns: 1fr !important; }
          .pricing-grid { grid-template-columns: 1fr !important; }
          .footer-grid { grid-template-columns: repeat(2, 1fr) !important; }
          h1 { font-size: 26px !important; }
        }
        @media (max-width: 480px) {
          .stats-grid { grid-template-columns: 1fr !important; }
          .footer-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
