'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import type { Industry } from '@/lib/industries';

const PAGE_BG = 'linear-gradient(180deg, #FCF7EE 0%, #F8EFDF 40%, #FBF2E3 70%, #F7ECDA 100%)';
const HERO_BG = 'linear-gradient(160deg, #FFFBF2, #FDF3E2, #FBEAD2)';
const NAV_BG = 'rgba(255,251,242,0.85)';
const GOLD = '#C8881C';
const GOLD_DARK = '#C8881C';
const TEXT = '#2A1B06';
const DIM = '#6B5B43';
const BORDER = '#F0E7D6';
const GREEN = '#15803D';
const RED = '#EF4444';

const OLD_WAY_VS_SAGUARO = [
  ['Manual blueprint takeoff — 4 to 8 hours per bid', 'AI blueprint takeoff — complete estimate in under 60 seconds'],
  ['Paper lien waivers chased at project closeout', 'Digital lien waivers sent, signed, and tracked automatically'],
  ['G702 pay apps filled by hand every month', 'AIA pay apps generated and submitted in 60 seconds'],
  ['Certified payroll done in spreadsheets', 'WH-347 forms auto-generated with live Davis-Bacon rates'],
  ['4 separate tools that don\'t talk to each other', 'One platform: estimating, billing, compliance, field'],
];

const TRUST_PILLS = [
  'Native iOS Field App',
  'Works Offline',
  'All 50 States',
  'Free for Your Whole Crew',
  'No Credit Card to Start',
];

interface Props {
  industry: Industry;
}

export default function IndustryLandingPage({ industry }: Props) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Split headline: last line gets gold gradient, previous lines are white
  const headlineLines = industry.headline.split('\n');
  const headlineBody = headlineLines.slice(0, -1);
  const headlineLast = headlineLines[headlineLines.length - 1];

  return (
    <div style={{ background: PAGE_BG, color: TEXT, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ── NAV ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
        background: NAV_BG,
        backdropFilter: 'blur(20px) saturate(150%)', WebkitBackdropFilter: 'blur(20px) saturate(150%)',
        borderBottom: `1px solid ${BORDER}`,
        transition: 'all 0.3s ease', height: '58px',
        display: 'flex', alignItems: 'center',
      }}>
        <div style={{
          maxWidth: '1200px', margin: '0 auto', padding: '0 24px',
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <img
              src="/logo-horizontal.png"
              alt="Saguaro Control Systems"
              style={{ height: '36px', width: 'auto', objectFit: 'contain', borderRadius: '4px', flexShrink: 0 }}
            />
            <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
              <span style={{
                fontWeight: 700, fontSize: '14px', letterSpacing: '0.1em',
                background: 'linear-gradient(90deg,#C8881C,#E0A030)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>SAGUARO</span>
              <span style={{ fontSize: '7px', color: DIM, letterSpacing: '0.25em', fontWeight: 600, textTransform: 'uppercase' }}>Control Systems</span>
            </span>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} className="ind-desktop">
            <Link href="/login" style={{
              padding: '7px 18px', background: 'rgba(255,255,255,0.6)',
              border: `1px solid ${BORDER}`, borderRadius: '6px',
              color: TEXT, fontSize: '13px', fontWeight: 500, textDecoration: 'none',
            }}>Log In</Link>
            <Link href="/signup" style={{
              padding: '7px 18px', background: 'linear-gradient(135deg,#E8B84B,#C98A1A)', border: 'none', borderRadius: '6px',
              color: '#2A1B06', fontSize: '13px', fontWeight: 700, letterSpacing: '0.03em', textDecoration: 'none',
              boxShadow: '0 6px 18px rgba(201,138,26,0.28)',
            }}>Free Trial</Link>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="ind-mobile"
            style={{ display: 'none', background: 'none', border: 'none', color: TEXT, fontSize: '22px', cursor: 'pointer', padding: '8px', minWidth: '44px', minHeight: '44px', alignItems: 'center', justifyContent: 'center' }}
            aria-label="Menu"
          >{mobileOpen ? '✕' : '☰'}</button>
        </div>
      </nav>

      {mobileOpen && (
        <div style={{ position: 'fixed', top: '58px', left: 0, right: 0, zIndex: 9998, background: '#FFFBF2', borderBottom: `1px solid ${BORDER}`, padding: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Link href="/login" onClick={() => setMobileOpen(false)} style={{ padding: '13px', textAlign: 'center', border: `1px solid ${BORDER}`, borderRadius: '8px', color: TEXT, textDecoration: 'none', fontWeight: 500 }}>Log In</Link>
            <Link href="/signup" onClick={() => setMobileOpen(false)} style={{ padding: '13px', textAlign: 'center', background: 'linear-gradient(135deg,#E8B84B,#C98A1A)', borderRadius: '8px', color: '#2A1B06', textDecoration: 'none', fontWeight: 700, boxShadow: '0 6px 18px rgba(201,138,26,0.28)' }}>Start Free Trial</Link>
          </div>
        </div>
      )}

      <div style={{ height: '58px' }} />

      {/* ── HERO ── */}
      <section style={{
        position: 'relative', overflow: 'hidden',
        padding: '80px 24px 72px',
        background: HERO_BG,
        textAlign: 'center',
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <div style={{ position: 'absolute', top: -160, right: -80, width: 620, height: 620, background: 'radial-gradient(circle at 80% 0%, rgba(216,154,30,0.12), transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '820px', margin: '0 auto' }}>
          {/* Industry badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '28px' }}>
            <div style={{
              padding: '5px 14px', background: 'rgba(200,136,28,0.12)',
              border: '1px solid rgba(200,136,28,0.32)', borderRadius: '100px',
              fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', color: '#B07A12',
              textTransform: 'uppercase',
            }}>
              {industry.name}
            </div>
          </div>

          <h1 style={{ fontSize: 'clamp(36px, 5.5vw, 60px)', fontWeight: 800, lineHeight: 1.05, margin: '0 0 24px', letterSpacing: '-0.03em' }}>
            {headlineBody.map((line, i) => (
              <span key={i} style={{ display: 'block', color: TEXT }}>{line}</span>
            ))}
            <span style={{
              display: 'block',
              background: 'linear-gradient(135deg, #D89A1E, #A86A0C)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>{headlineLast}</span>
          </h1>

          <p style={{ fontSize: 'clamp(16px, 2vw, 19px)', color: DIM, lineHeight: 1.7, margin: '0 auto 40px', maxWidth: '680px' }}>
            {industry.subheadline}
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '36px' }}>
            <Link href="/signup" style={{
              padding: '14px 32px',
              background: 'linear-gradient(135deg,#E8B84B,#C98A1A)',
              borderRadius: '8px', color: '#2A1B06', fontWeight: 700, fontSize: '16px',
              textDecoration: 'none', letterSpacing: '0.01em',
              boxShadow: '0 6px 18px rgba(201,138,26,0.28)',
            }}>
              Start Free Trial
            </Link>
            <Link href="/sandbox" style={{
              padding: '14px 32px',
              background: 'rgba(255,255,255,0.6)',
              border: `1.5px solid rgba(42,27,6,0.18)`,
              borderRadius: '8px', color: TEXT, fontWeight: 700, fontSize: '16px',
              textDecoration: 'none',
            }}>
              Try AI Takeoff →
            </Link>
          </div>

          {/* Trust pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
            {TRUST_PILLS.map(pill => (
              <span key={pill} style={{
                padding: '5px 12px',
                background: 'linear-gradient(135deg,#FFFBF2,#FDF3E0)',
                border: `1px solid ${BORDER}`,
                borderRadius: '100px',
                fontSize: '12px', color: DIM, fontWeight: 500,
              }}>
                {pill}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── PAIN POINTS ── */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 34px)', fontWeight: 800, margin: '0 0 12px', color: TEXT, letterSpacing: '-0.03em' }}>
              Sound Familiar?
            </h2>
            <p style={{ color: DIM, fontSize: '16px', margin: 0 }}>
              These are the problems {industry.name.toLowerCase()} deal with every week.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '28px' }}>
            {industry.painPoints.map((point, i) => (
              <div key={i} style={{
                padding: '4px 0 4px 18px',
                borderLeft: `3px solid ${RED}`,
                display: 'flex', alignItems: 'flex-start', gap: '14px',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '1px' }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p style={{ margin: 0, color: DIM, fontSize: '15px', lineHeight: 1.5 }}>{point}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES GRID ── */}
      <section style={{ padding: '84px 24px', background: 'linear-gradient(180deg,#FBF3E4,#F7EAD4)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '52px' }}>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 34px)', fontWeight: 800, margin: '0 0 12px', color: TEXT, letterSpacing: '-0.03em' }}>
              Everything You Need. Nothing You Don&apos;t.
            </h2>
            <p style={{ color: DIM, fontSize: '16px', margin: 0 }}>
              Built specifically for {industry.name.toLowerCase()}.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '44px' }}>
            {industry.keyFeatures.map((feature, i) => (
              <div key={i} className="il-feat-item">
                <span className="il-feat-num">{String(i + 1).padStart(2, '0')}</span>
                {/* Icon */}
                <div className="il-feat-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#231A05" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d={industry.iconPath} />
                  </svg>
                </div>
                <h3 className="il-feat-title">{feature.title}</h3>
                <p style={{ fontSize: '14px', color: DIM, lineHeight: 1.6, margin: 0 }}>{feature.desc}</p>
              </div>
            ))}
          </div>

          <style>{`
            .il-feat-item { position: relative; display: flex; flex-direction: column; gap: 13px; padding-top: 26px; text-decoration: none; transition: transform .28s cubic-bezier(.16,1,.3,1); }
            .il-feat-item::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; border-radius: 2px; background: linear-gradient(90deg, rgba(216,154,30,0.5), rgba(216,154,30,0.12) 55%, transparent); transition: background .3s ease, box-shadow .3s ease; }
            .il-feat-item:hover { transform: translateY(-5px); }
            .il-feat-item:hover::before { background: linear-gradient(90deg, #E8A020, rgba(232,160,32,0.4) 70%, transparent); box-shadow: 0 1px 10px rgba(232,160,32,0.5); }
            .il-feat-num { position: absolute; top: 22px; right: 2px; font-size: 13px; font-weight: 800; letter-spacing: .1em; color: rgba(176,122,18,0.3); font-variant-numeric: tabular-nums; }
            .il-feat-icon { width: 54px; height: 54px; border-radius: 16px; background: linear-gradient(145deg,#F8CE5A,#E89A18); display: flex; align-items: center; justify-content: center; color: #231A05; box-shadow: 0 8px 22px rgba(232,160,32,0.38), inset 0 1px 1px rgba(255,255,255,0.55); transition: transform .28s cubic-bezier(.16,1,.3,1), box-shadow .28s ease; }
            .il-feat-item:hover .il-feat-icon { transform: translateY(-2px) scale(1.07) rotate(-3deg); box-shadow: 0 16px 32px rgba(232,160,32,0.5), inset 0 1px 1px rgba(255,255,255,0.65); }
            .il-feat-title { font-size: 17px; font-weight: 700; margin: 0; color: #2A1B06; letter-spacing: -0.01em; transition: color .2s ease; }
            .il-feat-item:hover .il-feat-title { color: #A8700C; }
            .il-feat-more { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: #B07A12; opacity: .62; transition: opacity .25s ease; }
            .il-feat-item:hover .il-feat-more { opacity: 1; }
            .il-feat-more .arr { transition: transform .25s ease; }
            .il-feat-item:hover .il-feat-more .arr { transform: translateX(5px); }
          `}</style>
        </div>
      </section>

      {/* ── TESTIMONIAL ── */}
      <section style={{ padding: '84px 24px' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', textAlign: 'center' }}>
          {/* 5 stars */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginBottom: '28px' }}>
            {[...Array(5)].map((_, i) => (
              <svg key={i} width="20" height="20" viewBox="0 0 24 24" fill={GOLD} stroke="none">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            ))}
          </div>

          <blockquote style={{
            margin: '0 0 32px',
            padding: '4px 0 4px 28px',
            borderLeft: `4px solid ${GOLD}`,
            textAlign: 'left',
          }}>
            <p style={{ fontSize: 'clamp(16px, 2vw, 19px)', color: TEXT, lineHeight: 1.7, margin: 0, fontStyle: 'italic' }}>
              &ldquo;{industry.testimonialQuote}&rdquo;
            </p>
          </blockquote>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
            {/* Avatar initials */}
            <div style={{
              width: '44px', height: '44px',
              background: `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})`,
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: '16px', color: '#2A1B06', flexShrink: 0,
            }}>
              {industry.testimonialName.charAt(0)}
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 700, color: TEXT, fontSize: '15px' }}>{industry.testimonialName}</div>
              <div style={{ color: DIM, fontSize: '13px' }}>{industry.testimonialTitle}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── COMPARISON BAR ── */}
      <section style={{ padding: '84px 24px', background: 'linear-gradient(180deg,#FBF3E4,#F7EAD4)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 34px)', fontWeight: 800, margin: '0 0 12px', color: TEXT, letterSpacing: '-0.03em' }}>
              The Old Way vs. With Saguaro
            </h2>
            <p style={{ color: DIM, fontSize: '16px', margin: 0 }}>
              See what changes when you run your business on one platform.
            </p>
          </div>

          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', paddingBottom: '12px', borderBottom: `2px solid ${TEXT}` }}>
            <div style={{
              fontWeight: 700, fontSize: '14px', color: RED, letterSpacing: '0.04em',
            }}>
              THE OLD WAY
            </div>
            <div style={{
              fontWeight: 700, fontSize: '14px', color: GREEN, letterSpacing: '0.04em',
            }}>
              WITH SAGUARO
            </div>
          </div>

          <div>
            {OLD_WAY_VS_SAGUARO.map(([bad, good], i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', padding: '18px 0', borderBottom: `1px solid ${BORDER}` }}>
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: '10px',
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={RED} strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: '1px' }}>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  <span style={{ fontSize: '14px', color: DIM, lineHeight: 1.5 }}>{bad}</span>
                </div>
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: '10px',
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: '1px' }}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span style={{ fontSize: '14px', color: TEXT, lineHeight: 1.5 }}>{good}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{
        position: 'relative', overflow: 'hidden',
        padding: '80px 24px',
        background: 'radial-gradient(ellipse at 50% 0%, #251608, #0E0B08)',
        borderTop: `1px solid ${BORDER}`,
        textAlign: 'center',
      }}>
        <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%,-50%)', width: 900, height: 500, background: 'radial-gradient(ellipse, rgba(232,168,60,0.18) 0%, transparent 68%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '680px', margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, margin: '0 0 16px', lineHeight: 1.05, color: '#F5E9D6', letterSpacing: '-0.03em' }}>
            Ready to Run Your {industry.name} Business Smarter?
          </h2>
          <p style={{ fontSize: '17px', color: '#C9B79A', lineHeight: 1.7, margin: '0 0 40px' }}>
            Join {industry.name.toLowerCase()} who have eliminated manual takeoffs, paper lien waivers, and disconnected tools.
            One platform. One price. Start today — no credit card required.
          </p>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '24px' }}>
            <Link href="/signup" style={{
              padding: '16px 36px',
              background: 'linear-gradient(135deg,#E8B84B,#C98A1A)',
              borderRadius: '8px', color: '#2A1B06', fontWeight: 700, fontSize: '17px',
              textDecoration: 'none', letterSpacing: '0.01em',
              boxShadow: '0 6px 30px rgba(232,160,32,0.45)',
            }}>
              Start Free Trial
            </Link>
            <Link href="/sandbox" style={{
              padding: '16px 36px',
              background: 'transparent',
              border: `1.5px solid rgba(245,233,214,0.35)`,
              borderRadius: '8px', color: '#F5E9D6', fontWeight: 600, fontSize: '17px',
              textDecoration: 'none',
            }}>
              Try AI Takeoff First →
            </Link>
          </div>

          <p style={{ fontSize: '13px', color: '#C9B79A', margin: 0 }}>
            Free for your whole field crew. Download from the App Store.
          </p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: `1px solid ${BORDER}`, background: '#FBF8F2', padding: '32px 24px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <Link href="/pricing" style={{ color: DIM, fontSize: '13px', textDecoration: 'none' }}>Pricing</Link>
          <Link href="/compare/procore" style={{ color: DIM, fontSize: '13px', textDecoration: 'none' }}>vs Procore</Link>
          <Link href="/sandbox" style={{ color: DIM, fontSize: '13px', textDecoration: 'none' }}>AI Takeoff Demo</Link>
          <Link href="/get-the-app" style={{ color: DIM, fontSize: '13px', textDecoration: 'none' }}>Field App</Link>
          <Link href="/privacy" style={{ color: DIM, fontSize: '13px', textDecoration: 'none' }}>Privacy</Link>
          <Link href="/terms" style={{ color: DIM, fontSize: '13px', textDecoration: 'none' }}>Terms</Link>
        </div>
        <p style={{ color: DIM, fontSize: '12px', margin: 0 }}>
          &copy; {new Date().getFullYear()} Saguaro Control Systems. All rights reserved.
        </p>
      </footer>

      <style>{`
        @media (max-width: 768px) {
          .ind-desktop { display: none !important; }
          .ind-mobile { display: flex !important; }
        }
        @media (max-width: 600px) {
          .comp-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
