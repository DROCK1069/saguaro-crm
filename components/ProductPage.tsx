import Link from 'next/link';
import type { ReactNode } from 'react';

/* ── palette (matches the editorial homepage) ── */
const BG = '#F2F2F7';
const TEXT = '#1C1C1E';
const DIM = '#6E6E73';
const GOLD = '#C8881C';
const GREEN = '#15803D';
const HAIR = '#E7E5E1';

export interface ProductSection {
  title: string;
  body: string;
  bullets?: string[];
}
export interface ProductStat {
  value: string;
  label: string;
}
export interface ProductStep {
  title: string;
  body: string;
}
export interface ProductPageData {
  eyebrow: string;
  title: ReactNode;
  subhead: string;
  stats: ProductStat[];
  sections: ProductSection[];
  steps?: ProductStep[];
  closingLine?: string;
  visual?: ReactNode;
}

function Header() {
  return (
    <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: `1px solid ${HAIR}`, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 max(24px, 4vw)' }}>
      <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }} aria-label="Saguaro Control Systems — home">
        <img src="/logo-horizontal.png" alt="Saguaro Control Systems" height={32} style={{ height: 32, width: 'auto', display: 'block' }} />
      </a>
      <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
        <a href="/#features" style={{ color: TEXT, fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>Platform</a>
        <a href="/pricing" style={{ color: TEXT, fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>Pricing</a>
        <a href="/compare/procore" style={{ color: TEXT, fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>Compare</a>
        <Link href="/signup" style={{ background: 'linear-gradient(135deg, #F5C645, #E8A020)', color: '#1A1400', fontSize: 13, fontWeight: 700, padding: '8px 18px', borderRadius: 9, textDecoration: 'none' }}>Start Free</Link>
      </div>
    </nav>
  );
}

export default function ProductPage({ data }: { data: ProductPageData }) {
  return (
    <div style={{ background: `linear-gradient(180deg, #FAFAF8 0%, ${BG} 30%, #F5F5F0 100%)`, color: TEXT, minHeight: '100vh', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", overflowX: 'hidden' }}>
      <Header />

      {/* ── Hero ── */}
      <section style={{ maxWidth: 1080, margin: '0 auto', padding: '72px 24px 40px', display: 'grid', gridTemplateColumns: data.visual ? '1.05fr 0.95fr' : '1fr', gap: 56, alignItems: 'center' }} className="product-hero">
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.6, textTransform: 'uppercase', color: GOLD, marginBottom: 18 }}>{data.eyebrow}</div>
          <h1 style={{ fontSize: 46, fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.06, margin: '0 0 20px', color: TEXT }}>{data.title}</h1>
          <p style={{ fontSize: 18, lineHeight: 1.6, color: DIM, margin: '0 0 30px', maxWidth: 460 }}>{data.subhead}</p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <Link href="/signup" style={{ background: 'linear-gradient(135deg, #F5C645, #E8A020)', color: '#1A1400', fontWeight: 800, fontSize: 15, padding: '14px 32px', borderRadius: 11, textDecoration: 'none', boxShadow: '0 4px 18px rgba(232,160,32,0.30)' }}>Start Free Trial →</Link>
            <Link href="/get-the-app" style={{ color: TEXT, fontWeight: 600, fontSize: 15, padding: '14px 26px', borderRadius: 11, border: `1.5px solid ${TEXT}`, textDecoration: 'none' }}>Get the iOS App</Link>
          </div>
          <p style={{ color: DIM, fontSize: 12, marginTop: 16 }}>No credit card required · 14-day free trial · Cancel anytime</p>
        </div>
        {data.visual && <div>{data.visual}</div>}
      </section>

      {/* ── Outcomes ── */}
      <section style={{ borderTop: `1px solid ${HAIR}`, borderBottom: `1px solid ${HAIR}` }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 24px', display: 'grid', gridTemplateColumns: `repeat(${data.stats.length}, 1fr)` }} className="product-stats">
          {data.stats.map((s, i) => (
            <div key={s.label} style={{ padding: '36px 28px', textAlign: 'center', borderLeft: i === 0 ? 'none' : `1px solid ${HAIR}` }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: GOLD, letterSpacing: '-0.03em' }}>{s.value}</div>
              <div style={{ fontSize: 13, color: DIM, marginTop: 8, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Feature sections ── */}
      <section style={{ maxWidth: 1080, margin: '0 auto', padding: '24px 24px 8px' }}>
        {data.sections.map((sec, i) => (
          <div key={i} style={{ padding: '48px 0', borderTop: i === 0 ? 'none' : `1px solid ${HAIR}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'start' }} className="product-section">
            <div>
              <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 14px', color: TEXT }}>{sec.title}</h2>
              <p style={{ fontSize: 16, lineHeight: 1.7, color: DIM, margin: 0 }}>{sec.body}</p>
            </div>
            {sec.bullets && (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {sec.bullets.map((b) => (
                  <li key={b} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: '10px 0', borderTop: `1px solid ${HAIR}`, fontSize: 14.5, color: TEXT, lineHeight: 1.5 }}>
                    <svg viewBox="0 0 16 16" width={16} height={16} fill={GREEN} style={{ flexShrink: 0, marginTop: 2 }}><path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm3.4 6.2-4 4a.7.7 0 0 1-1 0l-1.8-1.8a.7.7 0 1 1 1-1l1.3 1.3 3.5-3.5a.7.7 0 0 1 1 1z" /></svg>
                    {b}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </section>

      {/* ── How it works ── */}
      {data.steps && data.steps.length > 0 && (
        <section style={{ background: '#FAFAF8', borderTop: `1px solid ${HAIR}`, borderBottom: `1px solid ${HAIR}` }}>
          <div style={{ maxWidth: 1080, margin: '0 auto', padding: '72px 24px' }}>
            <h2 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 44px', color: TEXT }}>How it works</h2>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${data.steps.length}, 1fr)`, gap: 0, borderTop: `2px solid ${TEXT}` }} className="product-steps">
              {data.steps.map((st, i) => (
                <div key={i} style={{ padding: '28px 28px 0 0', borderLeft: i === 0 ? 'none' : `1px solid ${HAIR}`, paddingLeft: i === 0 ? 0 : 28 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: GOLD, fontFamily: 'monospace', marginBottom: 14 }}>0{i + 1}</div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 8px', color: TEXT, letterSpacing: '-0.01em' }}>{st.title}</h3>
                  <p style={{ fontSize: 14, color: DIM, lineHeight: 1.6, margin: 0 }}>{st.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Dark CTA ── */}
      <section style={{ position: 'relative', overflow: 'hidden', background: '#0E0B08', padding: '88px 24px', textAlign: 'center' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 800, height: 460, background: 'radial-gradient(ellipse, rgba(200,136,28,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 620, margin: '0 auto' }}>
          <h2 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', color: '#FFFFFF', margin: '0 0 14px' }}>{data.closingLine || 'Ready to build smarter?'}</h2>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15, margin: '0 0 34px' }}>Start free today — no credit card, no sales call, no contract.</p>
          <Link href="/signup" style={{ background: 'linear-gradient(135deg, #F5C645, #E8A020)', color: '#1A1400', fontWeight: 800, fontSize: 17, padding: '17px 46px', borderRadius: 13, textDecoration: 'none', display: 'inline-block', boxShadow: '0 4px 24px rgba(232,160,32,0.45)' }}>Start Your Free Trial</Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: `1px solid ${HAIR}`, maxWidth: 1200, margin: '0 auto', padding: '32px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <img src="/logo-horizontal.png" alt="Saguaro Control Systems" height={28} style={{ height: 28, width: 'auto' }} />
        </a>
        <span style={{ fontSize: 12, color: DIM }}>© {new Date().getFullYear()} Saguaro Technologies Inc. All rights reserved.</span>
      </footer>

      <style>{`
        @media (max-width: 820px) {
          .product-hero { grid-template-columns: 1fr !important; }
          .product-section { grid-template-columns: 1fr !important; gap: 20px !important; }
          .product-steps { grid-template-columns: 1fr !important; }
          .product-steps > div { border-left: none !important; border-top: 1px solid ${HAIR}; padding-left: 0 !important; padding-top: 24px !important; }
          .product-stats { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
