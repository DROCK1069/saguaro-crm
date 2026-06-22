import type { Metadata } from 'next';
import Image from 'next/image';
import { COMPETITORS } from '@/lib/competitors';
import { IntegrationStrip } from '@/components/Integrations';

export const metadata: Metadata = {
  title: 'Saguaro vs Every Construction Software — Full Comparisons',
  description: 'See how Saguaro CRM compares to Procore, Buildertrend, CoConstruct, Fieldwire, Autodesk Build, Contractor Foreman, Jobber, JobNimbus, and more.',
  openGraph: {
    title: 'Saguaro vs Every Construction Software',
    description: 'Full feature and price comparisons against every major competitor.',
  },
  alternates: { canonical: 'https://saguarocontrol.net/compare' },
};

const GOLD = '#C8881C';
const TEXT = '#2A1B06';
const DIM = '#6B5B43';
const BORDER = '#F0E7D6';
const RAISED = '#FFFBF2';
const GREEN = '#15803D';
const PAGE_BG = 'linear-gradient(180deg, #FCF7EE 0%, #F8EFDF 40%, #FBF2E3 70%, #F7ECDA 100%)';
const HERO_BG = 'linear-gradient(160deg, #FFFBF2, #FDF3E2, #FBEAD2)';
const NAV_BG = 'rgba(255,251,242,0.85)';

export default function ComparePage() {
  const competitors = Object.values(COMPETITORS);

  return (
    <div style={{ minHeight: '100vh', background: PAGE_BG, color: TEXT, fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* NAV */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        height: 64, background: NAV_BG, backdropFilter: 'blur(20px) saturate(150%)', WebkitBackdropFilter: 'blur(20px) saturate(150%)',
        borderBottom: `1px solid ${BORDER}`,
        display: 'flex', alignItems: 'center',
        padding: '0 32px', gap: 32,
      }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0 }}>
          <Image
            src="/logo-horizontal.png"
            alt="Saguaro"
            width={132}
            height={44}
            style={{ height: 44, width: 'auto', objectFit: 'contain' }}
          />
        </a>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {[
            { label: 'Features', href: '/#features' },
            { label: 'Pricing', href: '/pricing' },
            { label: 'Field App', href: '/get-the-app' },
            { label: 'Compare', href: '/compare' },
          ].map((link) => (
            <a
              key={link.label}
              href={link.href}
              style={{ color: DIM, fontSize: 14, fontWeight: 500, textDecoration: 'none' }}
            >
              {link.label}
            </a>
          ))}
          <a
            href="/signup"
            style={{
              background: 'linear-gradient(135deg,#E8B84B,#C98A1A)', color: '#2A1B06', fontSize: 14, fontWeight: 700,
              padding: '8px 20px', borderRadius: 8, textDecoration: 'none',
              letterSpacing: 0.2, boxShadow: '0 6px 18px rgba(201,138,26,0.28)',
            }}
          >
            Start Free Trial
          </a>
        </div>
      </nav>

      {/* HERO */}
      <div style={{ paddingTop: 64 }}>
        <section style={{ position: 'relative', overflow: 'hidden', background: HERO_BG, borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ position: 'absolute', top: -120, right: -80, width: 560, height: 560, background: 'radial-gradient(circle, rgba(232,168,60,0.28) 0%, rgba(212,160,23,0.10) 40%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 900, margin: '0 auto', padding: '80px 32px 56px', textAlign: 'center' }}>
          <div style={{
            display: 'inline-block', background: 'rgba(200,136,28,0.12)',
            border: `1px solid rgba(200,136,28,0.32)`, borderRadius: 20,
            padding: '5px 16px', fontSize: 12, fontWeight: 700,
            color: GOLD, letterSpacing: '0.08em', textTransform: 'uppercase',
            marginBottom: 24,
          }}>
            Head-to-Head Comparisons
          </div>
          <h1 style={{ fontSize: 'clamp(36px, 6vw, 60px)', fontWeight: 800, lineHeight: 1.1, margin: '0 0 24px' }}>
            Saguaro vs. Every Construction
            <br />
            <span style={{ background: `linear-gradient(135deg, ${GOLD} 0%, #FBBF24 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Software Tool — Compared
            </span>
          </h1>
          <p style={{ fontSize: 20, color: DIM, maxWidth: 640, margin: '0 auto 40px', lineHeight: 1.6 }}>
            We don&apos;t hide from comparisons. See exactly how we stack up against every major competitor.
          </p>
        </div>
        </section>

        {/* PROCORE FEATURED — editorial */}
        <div style={{ maxWidth: 900, margin: '64px auto 64px', padding: '0 32px' }}>
          <a
            href="/compare/procore"
            style={{
              display: 'block', textDecoration: 'none',
              borderTop: `3px solid ${GOLD}`,
              paddingTop: 32,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
              <div style={{ flex: 1, minWidth: 280 }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: 'rgba(200,136,28,0.15)', border: `1px solid rgba(200,136,28,0.4)`,
                  borderRadius: 12, padding: '3px 12px', fontSize: 11, fontWeight: 700,
                  color: GOLD, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16,
                }}>
                  Most Popular Comparison
                </div>
                <h2 style={{ fontSize: 28, fontWeight: 800, color: TEXT, margin: '0 0 8px' }}>
                  Saguaro vs. Procore
                </h2>
                <p style={{ fontSize: 16, color: DIM, margin: '0 0 24px', lineHeight: 1.5 }}>
                  Procore starts at $375–600/mo+ per seat with a 3–6 month implementation. Saguaro is $399/mo flat for your whole team, live today.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  {['AI Takeoff Included', 'Lien Waivers All 50 States', 'Certified Payroll WH-347', 'Flat Rate Pricing', 'Go Live Today'].map((feat) => (
                    <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: GREEN }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {feat}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 16, flexShrink: 0,
              }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, color: DIM, marginBottom: 4 }}>Saguaro starting price</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: GOLD }}>$399/mo</div>
                  <div style={{ fontSize: 13, color: DIM }}>vs Procore $375–600+/mo per seat</div>
                </div>
                <div style={{
                  background: 'linear-gradient(135deg,#E8B84B,#C98A1A)', color: '#2A1B06', fontWeight: 700, fontSize: 15,
                  padding: '12px 28px', borderRadius: 10, boxShadow: '0 6px 18px rgba(201,138,26,0.28)',
                }}>
                  See Full Comparison
                </div>
              </div>
            </div>
          </a>
        </div>

        {/* COMPETITOR GRID */}
        <section style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(180deg,#FBF3E4,#F7EAD4)', borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, padding: '80px 0' }}>
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 1000, height: 360, background: 'radial-gradient(circle at 50% 0%, rgba(216,154,30,0.10), transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 1100, margin: '0 auto', padding: '0 32px' }}>
          <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', color: TEXT, margin: '0 0 40px', textAlign: 'center' }}>
            All Competitors
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 36,
          }}>
            {competitors.map((comp) => (
              <a
                key={comp.slug}
                href={`/compare/${comp.slug}`}
                style={{
                  display: 'block', textDecoration: 'none',
                  borderTop: `1px solid rgba(176,122,18,0.16)`,
                  paddingTop: 24,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: TEXT, margin: 0 }}>
                    Saguaro vs. {comp.name}
                  </h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: 13, color: DIM }}>Their price:</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#f87171' }}>{comp.startingPrice}</span>
                  {comp.perSeat && (
                    <span style={{ fontSize: 11, color: DIM, background: 'rgba(248,113,113,0.1)', borderRadius: 6, padding: '1px 8px' }}>per seat</span>
                  )}
                </div>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: DIM, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                    #1 Weakness
                  </div>
                  <p style={{ fontSize: 14, color: DIM, margin: 0, lineHeight: 1.5 }}>
                    {comp.weaknesses[0]}
                  </p>
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  color: GOLD, fontSize: 14, fontWeight: 600,
                }}>
                  See Comparison
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </a>
            ))}
          </div>
        </div>
        </section>

        {/* CTA SECTION */}
        <section style={{
          position: 'relative', overflow: 'hidden',
          background: 'radial-gradient(ellipse at 50% 0%, #251608 0%, #0E0B08 60%)',
          padding: '88px 32px',
          textAlign: 'center',
        }}>
          <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%,-50%)', width: 900, height: 500, background: 'radial-gradient(ellipse, rgba(232,168,60,0.20) 0%, transparent 68%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 1, maxWidth: 600, margin: '0 auto' }}>
            <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', color: '#F5E9D6', margin: '0 0 16px' }}>
              Ready to see why GCs are switching?
            </h2>
            <p style={{ fontSize: 18, color: '#C9B79A', margin: '0 0 36px', lineHeight: 1.6 }}>
              Start free — no credit card required. Go live today, not in 3 months.
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a
                href="/signup"
                style={{
                  background: 'linear-gradient(135deg,#E8B84B,#C98A1A)', color: '#2A1B06', fontWeight: 700, fontSize: 16,
                  padding: '14px 36px', borderRadius: 10, textDecoration: 'none', boxShadow: '0 6px 18px rgba(201,138,26,0.28)',
                }}
              >
                Start Free Trial
              </a>
              <a
                href="/sandbox"
                style={{
                  background: 'rgba(255,255,255,0.06)', color: '#F5E9D6', fontWeight: 600, fontSize: 16,
                  padding: '14px 36px', borderRadius: 10, textDecoration: 'none',
                  border: `1.5px solid rgba(245,233,214,0.35)`,
                }}
              >
                Explore the Sandbox
              </a>
            </div>
          </div>
        </section>

        {/* TRUSTED INTEGRATIONS */}
        <IntegrationStrip />

        {/* FOOTER */}
        <footer style={{ padding: '40px 32px', textAlign: 'center', borderTop: `1px solid ${BORDER}` }}>
          <p style={{ fontSize: 13, color: DIM, margin: 0 }}>
            &copy; {new Date().getFullYear()} Saguaro Control Systems. All rights reserved.
            {' '}&middot;{' '}
            <a href="/privacy" style={{ color: DIM, textDecoration: 'none' }}>Privacy</a>
            {' '}&middot;{' '}
            <a href="/terms" style={{ color: DIM, textDecoration: 'none' }}>Terms</a>
          </p>
        </footer>
      </div>
    </div>
  );
}
