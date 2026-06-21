'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import type { Competitor } from '@/lib/competitors';

const DARK = 'linear-gradient(180deg,#FBF3E4,#F7EAD4)';
const GOLD = '#C8881C';
const EYEBROW = '#B07A12';
const TEXT = '#2A1B06';
const DIM = '#6B5B43';
const BORDER = 'rgba(176,122,18,0.16)';
const GREEN = '#15803D';
const RED = '#EF4444';

// ─── Nav ────────────────────────────────────────────────────────────────────

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
        background: 'rgba(255,251,242,0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: scrolled ? `1px solid rgba(176,122,18,0.4)` : `1px solid #F0E7D6`,
        transition: 'all 0.3s ease', height: '58px',
        display: 'flex', alignItems: 'center',
      }}>
        <div style={{
          maxWidth: '1200px', margin: '0 auto', padding: '0 32px',
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <img
              src="/logo-horizontal.png"
              alt="Saguaro Control Systems"
              style={{ height: '36px', width: 'auto', objectFit: 'contain', borderRadius: '4px', flexShrink: 0 }}
            />
            <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
              <span style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '0.1em', background: 'linear-gradient(90deg,#C8881C,#E0A030)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>SAGUARO</span>
              <span style={{ fontSize: '7px', color: '#6B5B43', letterSpacing: '0.25em', fontWeight: 600, textTransform: 'uppercase' }}>Control Systems</span>
            </span>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} className="ccp-desktop">
            <Link href="/login" style={{ padding: '7px 18px', background: 'transparent', border: '1px solid #E6D7BC', borderRadius: '6px', color: TEXT, fontSize: '13px', fontWeight: 500, textDecoration: 'none' }}>Log In</Link>
            <Link href="/signup" style={{ padding: '7px 18px', background: 'linear-gradient(135deg,#E8B84B,#C98A1A)', border: 'none', borderRadius: '6px', color: '#2A1B06', fontSize: '13px', fontWeight: 700, letterSpacing: '0.03em', textDecoration: 'none', boxShadow: '0 6px 18px rgba(201,138,26,0.28)' }}>Free Trial</Link>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="ccp-mobile"
            style={{ display: 'none', background: 'none', border: 'none', color: TEXT, fontSize: '22px', cursor: 'pointer', padding: '8px', minWidth: '44px', minHeight: '44px', alignItems: 'center', justifyContent: 'center' }}
            aria-label="Menu"
          >
            {mobileOpen ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div style={{ position: 'fixed', top: '58px', left: 0, right: 0, zIndex: 9998, background: '#FBF3E4', borderBottom: `1px solid ${BORDER}`, padding: '8px 0 16px' }}>
          <div style={{ padding: '16px' }}>
            <Link href="/login" onClick={() => setMobileOpen(false)}
              style={{ display: 'block', textAlign: 'center', padding: '13px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '9px', color: TEXT, fontWeight: 600, textDecoration: 'none', fontSize: '15px', marginBottom: '10px' }}>
              Log In
            </Link>
            <Link href="/signup" onClick={() => setMobileOpen(false)}
              style={{ display: 'block', textAlign: 'center', padding: '13px', background: 'linear-gradient(135deg,#E8B84B,#C98A1A)', borderRadius: '9px', color: '#2A1B06', fontWeight: 700, textDecoration: 'none', fontSize: '15px', boxShadow: '0 6px 18px rgba(201,138,26,0.28)' }}>
              Start Free Trial
            </Link>
          </div>
        </div>
      )}

      <div style={{ height: '58px' }} />
    </>
  );
}

// ─── Check / X icons ────────────────────────────────────────────────────────

function Check() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="9" cy="9" r="9" fill={GREEN} fillOpacity="0.15" />
      <path d="M5 9.5l3 3 5-6" stroke={GREEN} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Cross() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="9" cy="9" r="9" fill={RED} fillOpacity="0.12" />
      <path d="M6 6l6 6M12 6l-6 6" stroke={RED} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function Warning() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <path d="M10 2L18.66 17H1.34L10 2z" fill={RED} fillOpacity="0.15" stroke={RED} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M10 8v4" stroke={RED} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="10" cy="14.5" r="0.75" fill={RED} />
    </svg>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function countAIFeatures(c: Competitor): number {
  let n = 0;
  if (!c.hasAITakeoff) n++;
  if (!c.hasBidIntelligence) n++;
  return n;
}

function formatSavings(c: Competitor): string {
  if (c.perSeat) return 'Up to 80% lower cost';
  const price = parseFloat(c.startingPrice.replace(/[^0-9.]/g, ''));
  if (!isNaN(price) && price > 199) {
    const diff = Math.round((price - 199) * 12);
    return `Save $${diff.toLocaleString()}/yr vs ${c.name}`;
  }
  return `More features, lower cost than ${c.name}`;
}

// ─── Comparison table rows ───────────────────────────────────────────────────

interface TableRow {
  feature: string;
  saguaroValue: string;
  competitorValue: string;
  saguaroWins: boolean;
  tie: boolean;
}

function buildRows(c: Competitor): TableRow[] {
  const row = (
    feature: string,
    saguaroValue: string,
    competitorValue: string,
    saguaroWins: boolean,
    tie = false,
  ): TableRow => ({ feature, saguaroValue, competitorValue, saguaroWins, tie });

  return [
    row('Starting Price', '$199/mo flat', c.startingPrice, false, true),
    row('Contract Required', 'Month-to-month', c.annualRequired ? 'Annual required' : 'Month-to-month', c.annualRequired, !c.annualRequired),
    row('Setup Time', '< 1 day', c.setupTime, true),
    row('Per-Seat Pricing', 'No — flat rate', c.perSeat ? 'Yes — costs grow with team' : 'No', c.perSeat, !c.perSeat),
    row('AI Blueprint Takeoff', 'Included', c.hasAITakeoff ? 'Included' : 'Not available', !c.hasAITakeoff, c.hasAITakeoff),
    row('Lien Waivers (50 states)', 'Included', c.hasLienWaivers ? 'Included' : 'Not available', !c.hasLienWaivers, c.hasLienWaivers),
    row('Certified Payroll WH-347', 'Included', c.hasCertifiedPayroll ? 'Included' : 'Not available', !c.hasCertifiedPayroll, c.hasCertifiedPayroll),
    row(
      'Mobile Field App (offline)',
      'Full offline mode',
      c.hasOfflineMode ? 'Limited offline' : 'Requires signal',
      !c.hasOfflineMode,
      false,
    ),
    row(
      'Free Field App for Every User',
      'Free native iOS app',
      c.appStoreRequired ? 'Per-seat add-on' : 'Limited',
      true,
      false,
    ),
    row('Bid Intelligence AI', 'Included', c.hasBidIntelligence ? 'Included' : 'Not available', !c.hasBidIntelligence, c.hasBidIntelligence),
    row('Client Portal', 'Included', c.hasClientPortal ? 'Included' : 'Not available', !c.hasClientPortal, c.hasClientPortal),
    row('Sub Portal', 'Included', c.hasSubPortal ? 'Included' : 'Not available', !c.hasSubPortal, c.hasSubPortal),
  ];
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function CompetitorComparePage({ competitor }: { competitor: Competitor }) {
  const [headlineLines] = useState(() => competitor.heroHeadline.split('\n'));
  const rows = buildRows(competitor);
  const aiCount = countAIFeatures(competitor);
  const savings = formatSavings(competitor);

  const migrationLink = competitor.slug === 'procore' ? '/switch-from-procore' : '/signup';

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #FCF7EE 0%, #F8EFDF 40%, #FBF2E3 70%, #F7ECDA 100%)', color: TEXT, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <Nav />

      {/* ── Hero — warm gradient wash + glow ─────────────────────────────── */}
      <div style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(160deg, #FFFBF2 0%, #FDF3E2 45%, #FBEAD2 100%)', borderBottom: `1px solid #ECE7DD` }}>
      <div style={{ position: 'absolute', top: -160, right: '8%', width: 560, height: 560, background: 'radial-gradient(circle, rgba(232,168,60,0.30) 0%, rgba(212,160,23,0.10) 40%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -220, left: '6%', width: 480, height: 480, background: 'radial-gradient(circle, rgba(200,136,28,0.14) 0%, transparent 68%)', pointerEvents: 'none' }} />
      <section style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '76px 24px 70px', maxWidth: '860px', margin: '0 auto' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: '22px',
          padding: '6px 16px', borderRadius: '99px',
          background: 'rgba(200,136,28,0.12)', border: '1px solid rgba(200,136,28,0.32)',
          fontSize: '11.5px', fontWeight: 800, color: EYEBROW, letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: GOLD, boxShadow: '0 0 8px rgba(200,136,28,0.7)' }} />SAGUARO VS {competitor.name.toUpperCase()}
        </div>

        <h1 style={{ fontSize: 'clamp(36px,5.5vw,60px)', fontWeight: 900, lineHeight: 1.05, margin: '0 0 20px', letterSpacing: '-0.03em' }}>
          {headlineLines[0]}
          {headlineLines[1] && (
            <>
              <br />
              <span style={{ background: `linear-gradient(135deg, #D89A1E, #A86A0C)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {headlineLines[1]}
              </span>
            </>
          )}
        </h1>

        <p style={{ fontSize: '18px', color: DIM, lineHeight: 1.65, maxWidth: '660px', margin: '0 auto 36px' }}>
          {competitor.heroSubheadline}
        </p>

        <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/signup" style={{
            padding: '14px 34px', background: 'linear-gradient(135deg,#E8B84B,#C98A1A)',
            borderRadius: '9px', color: '#2A1B06', fontWeight: 700, fontSize: '15px',
            textDecoration: 'none', letterSpacing: '0.02em', boxShadow: '0 6px 18px rgba(201,138,26,0.28)',
          }}>
            Start Free Trial
          </Link>
          <a href="#comparison" style={{
            padding: '14px 28px', background: 'transparent',
            border: `1.5px solid #C8881C`, borderRadius: '9px',
            color: '#A86A0C', fontWeight: 700, fontSize: '14px', textDecoration: 'none',
          }}>
            See Full Comparison
          </a>
        </div>

        <div style={{ marginTop: '14px', fontSize: '12px', color: DIM }}>
          No credit card required. 30-day free trial. Cancel anytime.
        </div>
      </section>
      </div>

      {/* ── Win stats bar — gradient tiles ────────────────────────────────── */}
      <div style={{ padding: '40px 24px 8px' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '18px', textAlign: 'center' }} className="ccp-stats-grid">
          {[
            { value: savings, label: 'vs. per-seat or high-priced plans', g: 'linear-gradient(150deg, #FFF6E2, #FDEAC4)' },
            { value: '1 day setup', label: `vs. ${competitor.setupTime} for ${competitor.name}`, g: 'linear-gradient(150deg, #FBEFDC, #F6DCB6)' },
            { value: `${aiCount} AI feature${aiCount !== 1 ? 's' : ''}`, label: `${competitor.name} doesn't have`, g: 'linear-gradient(150deg, #FFF1E0, #FBD9AE)' },
          ].map((stat, i) => (
            <div key={i} style={{ padding: '26px 22px', borderRadius: 16, background: stat.g, border: '1px solid rgba(200,136,28,0.18)', boxShadow: '0 8px 22px rgba(200,136,28,0.10)' }} className="ccp-stat">
              <div style={{ fontSize: '30px', fontWeight: 900, marginBottom: '8px', letterSpacing: '-0.03em', background: 'linear-gradient(135deg, #D89A1E, #A86A0C)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{stat.value}</div>
              <div style={{ fontSize: '13px', color: '#7A5A1E', lineHeight: 1.4, fontWeight: 600 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Feature comparison table ───────────────────────────────────────── */}
      <section id="comparison" style={{ maxWidth: '1040px', margin: '0 auto', padding: '72px 24px' }}>
        <h2 style={{ fontSize: 'clamp(26px,3.5vw,34px)', fontWeight: 900, textAlign: 'center', marginBottom: '10px', letterSpacing: '-0.03em', color: TEXT }}>
          Saguaro vs {competitor.name}: Feature by Feature
        </h2>
        <p style={{ color: DIM, textAlign: 'center', marginBottom: '40px', fontSize: '15px' }}>
          {competitor.saguaroAdvantage}
        </p>

        <div>
          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1.8fr 1fr 1fr',
            background: 'linear-gradient(180deg, rgba(216,154,30,0.12), rgba(216,154,30,0.05))',
            borderBottom: `2px solid rgba(176,122,18,0.4)`,
          }}>
            <div style={{ padding: '14px 24px', fontSize: '12px', fontWeight: 700, color: EYEBROW, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Feature
            </div>
            <div style={{
              padding: '14px 24px', textAlign: 'center', background: 'rgba(216,154,30,0.10)',
            }}>
              <div style={{ fontWeight: 800, fontSize: '15px', color: '#A86A0C', letterSpacing: '0.04em' }}>SAGUARO</div>
            </div>
            <div style={{ padding: '14px 24px', textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '15px', color: DIM }}>{competitor.name}</div>
            </div>
          </div>

          {rows.map((row, i) => (
            <div
              key={row.feature}
              style={{
                display: 'grid', gridTemplateColumns: '1.8fr 1fr 1fr',
                borderBottom: `1px solid rgba(176,122,18,0.16)`,
                background: i % 2 === 1 ? 'rgba(216,154,30,0.035)' : 'transparent',
              }}
            >
              <div style={{ padding: '15px 24px', fontSize: '13px', fontWeight: 600, color: TEXT, display: 'flex', alignItems: 'center' }}>
                {row.feature}
              </div>

              {/* Saguaro cell */}
              <div style={{
                padding: '15px 20px', background: 'rgba(216,154,30,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}>
                {row.saguaroWins && <Check />}
                <span style={{
                  fontSize: '13px', fontWeight: row.saguaroWins ? 600 : 400,
                  color: row.saguaroWins ? GREEN : '#A86A0C',
                  textAlign: 'center',
                }}>
                  {row.saguaroValue}
                </span>
              </div>

              {/* Competitor cell */}
              <div style={{
                padding: '15px 20px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}>
                {row.saguaroWins && <Cross />}
                <span style={{
                  fontSize: '13px',
                  color: row.tie ? DIM : row.saguaroWins ? RED : DIM,
                  textAlign: 'center',
                }}>
                  {row.competitorValue}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Competitor weaknesses ─────────────────────────────────────────── */}
      <section style={{ background: 'linear-gradient(180deg,#FBF3E4,#F7EAD4)', borderTop: `1px solid rgba(176,122,18,0.16)`, borderBottom: `1px solid rgba(176,122,18,0.16)`, padding: '72px 24px' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(24px,3vw,34px)', fontWeight: 900, textAlign: 'center', marginBottom: '10px', letterSpacing: '-0.03em', color: TEXT }}>
            Where {competitor.name} Falls Short
          </h2>
          <p style={{ color: DIM, textAlign: 'center', marginBottom: '40px', fontSize: '15px' }}>
            {competitor.name} is best for: {competitor.bestFor}
          </p>

          <div>
            {competitor.weaknesses.map((weakness, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '14px',
                  borderTop: `1px solid ${BORDER}`, padding: '18px 0',
                }}
              >
                <div style={{ marginTop: '1px' }}>
                  <Warning />
                </div>
                <span style={{ fontSize: '14px', color: TEXT, lineHeight: 1.6 }}>{weakness}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Migration CTA ─────────────────────────────────────────────────── */}
      <section style={{ maxWidth: '800px', margin: '0 auto', padding: '72px 24px' }}>
        <div style={{
          borderTop: `2px solid rgba(176,122,18,0.4)`, padding: '48px 0 0', textAlign: 'center',
        }}>
          <h2 style={{ fontSize: 'clamp(24px,3vw,34px)', fontWeight: 900, marginBottom: '12px', letterSpacing: '-0.03em', color: TEXT }}>
            Ready to Switch from {competitor.name}?
          </h2>
          <p style={{ color: DIM, fontSize: '15px', lineHeight: 1.65, marginBottom: '12px', maxWidth: '560px', margin: '0 auto 12px' }}>
            We offer free data migration from {competitor.name}. Our onboarding team will move your projects, contacts, and documents — no data left behind.
          </p>
          <p style={{ color: DIM, fontSize: '13px', marginBottom: '32px' }}>
            Average migration time: under 24 hours.
          </p>
          <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href={migrationLink} style={{
              padding: '14px 32px', background: 'linear-gradient(135deg,#E8B84B,#C98A1A)',
              borderRadius: '9px', color: '#2A1B06', fontWeight: 700, fontSize: '15px',
              textDecoration: 'none', boxShadow: '0 6px 18px rgba(201,138,26,0.28)',
            }}>
              Start Free Migration
            </Link>
            <Link href="/signup" style={{
              padding: '14px 26px', background: 'transparent',
              border: `1.5px solid #C8881C`, borderRadius: '9px',
              color: '#A86A0C', fontWeight: 700, fontSize: '14px', textDecoration: 'none',
            }}>
              Try Free First
            </Link>
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────────── */}
      <section style={{
        background: 'radial-gradient(ellipse at 50% 0%, #251608, #0E0B08)',
        padding: '80px 24px', textAlign: 'center',
      }}>
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 900, marginBottom: '14px', letterSpacing: '-0.03em', color: '#F5E9D6' }}>
            The smarter platform for serious GCs.
          </h2>
          <p style={{ color: '#C9B79A', fontSize: '16px', marginBottom: '8px', lineHeight: 1.6 }}>
            AI takeoff. Lien waivers. Certified payroll. Field app. All in one platform, flat price.
          </p>
          <p style={{ color: '#C9B79A', fontSize: '13px', marginBottom: '36px' }}>
            30-day free trial. No credit card required.
          </p>
          <Link href="/signup" style={{
            display: 'inline-block', padding: '16px 44px',
            background: 'linear-gradient(135deg,#E8B84B,#C98A1A)',
            borderRadius: '10px', color: '#2A1B06', fontWeight: 800, fontSize: '16px',
            textDecoration: 'none', letterSpacing: '0.02em', boxShadow: '0 6px 18px rgba(201,138,26,0.4)',
          }}>
            Start Free Trial — No CC Required
          </Link>
          <div style={{ marginTop: '20px', fontSize: '13px', color: '#C9B79A' }}>
            Also compare:{' '}
            <Link href="/compare/procore" style={{ color: '#E8B84B', textDecoration: 'none' }}>Saguaro vs Procore</Link>
            {competitor.slug !== 'buildertrend' && (
              <>{' · '}<Link href="/compare/buildertrend" style={{ color: '#E8B84B', textDecoration: 'none' }}>vs Buildertrend</Link></>
            )}
            {competitor.slug !== 'fieldwire' && (
              <>{' · '}<Link href="/compare/fieldwire" style={{ color: '#E8B84B', textDecoration: 'none' }}>vs Fieldwire</Link></>
            )}
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer style={{ background: DARK, borderTop: `1px solid ${BORDER}`, padding: '32px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <span style={{ fontWeight: 800, fontSize: '14px', color: GOLD, letterSpacing: '0.08em' }}>SAGUARO</span>
            <span style={{ fontSize: '11px', color: DIM }}>Control Systems</span>
          </Link>
          <div style={{ fontSize: '12px', color: DIM }}>
            &copy; {new Date().getFullYear()} Saguaro Control Systems. All rights reserved.
          </div>
          <div style={{ display: 'flex', gap: '20px' }}>
            {[
              { label: 'Privacy', href: '/privacy' },
              { label: 'Terms', href: '/terms' },
              { label: 'Pricing', href: '/pricing' },
              { label: 'Sign Up', href: '/signup' },
            ].map(link => (
              <Link key={link.href} href={link.href} style={{ fontSize: '12px', color: DIM, textDecoration: 'none' }}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>

      <style>{`
        @media (max-width: 768px) {
          .ccp-desktop { display: none !important; }
          .ccp-mobile { display: flex !important; }
          .ccp-stats-grid { grid-template-columns: 1fr !important; }
          .ccp-stats-grid .ccp-stat { border-left: none !important; }
        }
        @media (max-width: 600px) {
          #comparison > div:last-child > div {
            grid-template-columns: 1fr !important;
          }
          #comparison > div:last-child > div > div:nth-child(2),
          #comparison > div:last-child > div > div:nth-child(3) {
            border-left: none !important;
            border-top: 1px solid ${BORDER};
          }
        }
      `}</style>
    </div>
  );
}
