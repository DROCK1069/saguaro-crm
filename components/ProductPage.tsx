import Link from 'next/link';
import type { ReactNode } from 'react';

/* ── palette ── */
const TEXT = '#1C1C1E';
const DIM = '#6E6E73';
const GOLD = '#C8881C';
const GREEN = '#15803D';
const HAIR = '#ECE7DD';

export interface ProductSection { title: string; body: string; bullets?: string[]; }
export interface ProductStat { value: string; label: string; }
export interface ProductStep { title: string; body: string; }
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
    <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(20px) saturate(150%)', WebkitBackdropFilter: 'blur(20px) saturate(150%)', borderBottom: `1px solid ${HAIR}`, height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 max(24px, 4vw)' }}>
      <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }} aria-label="Saguaro Control Systems — home">
        <img src="/logo-horizontal.png" alt="Saguaro Control Systems" height={32} style={{ height: 32, width: 'auto', display: 'block' }} />
      </a>
      <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
        <a href="/#features" style={{ color: TEXT, fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>Platform</a>
        <a href="/pricing" style={{ color: TEXT, fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>Pricing</a>
        <a href="/compare/procore" style={{ color: TEXT, fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>Compare</a>
        <Link href="/signup" style={{ background: 'linear-gradient(135deg, #F5C645, #E8A020)', color: '#1A1400', fontSize: 13, fontWeight: 700, padding: '9px 20px', borderRadius: 10, textDecoration: 'none', boxShadow: '0 4px 14px rgba(232,160,32,0.35)' }}>Start Free</Link>
      </div>
    </nav>
  );
}

const STAT_GRADS = [
  'linear-gradient(150deg, #FFF6E2 0%, #FDEAC4 100%)',
  'linear-gradient(150deg, #FBEFDC 0%, #F6DCB6 100%)',
  'linear-gradient(150deg, #FFF1E0 0%, #FBD9AE 100%)',
];

export default function ProductPage({ data }: { data: ProductPageData }) {
  return (
    <div style={{ background: 'linear-gradient(180deg, #FCF7EE 0%, #F8EFDF 40%, #FBF2E3 70%, #F7ECDA 100%)', color: TEXT, minHeight: '100vh', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", overflowX: 'hidden' }}>
      <Header />

      {/* ── Hero — warm gradient wash + glow ── */}
      <section style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(160deg, #FFFBF2 0%, #FDF3E2 45%, #FBEAD2 100%)', borderBottom: `1px solid ${HAIR}` }}>
        <div style={{ position: 'absolute', top: -160, right: -80, width: 620, height: 620, background: 'radial-gradient(circle, rgba(232,168,60,0.30) 0%, rgba(212,160,23,0.10) 40%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -200, left: -120, width: 520, height: 520, background: 'radial-gradient(circle, rgba(200,136,28,0.14) 0%, transparent 68%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 1100, margin: '0 auto', padding: '76px 24px 84px', display: 'grid', gridTemplateColumns: data.visual ? '1.05fr 0.95fr' : '1fr', gap: 56, alignItems: 'center' }} className="product-hero">
          <div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(200,136,28,0.12)', border: '1px solid rgba(200,136,28,0.32)', color: GOLD, fontSize: 11.5, fontWeight: 800, letterSpacing: 1.2, padding: '6px 15px', borderRadius: 999, marginBottom: 22, textTransform: 'uppercase' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: GOLD, boxShadow: '0 0 8px rgba(200,136,28,0.7)' }} />{data.eyebrow}
            </span>
            <h1 style={{ fontSize: 50, fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.04, margin: '0 0 22px', color: TEXT }}>{data.title}</h1>
            <p style={{ fontSize: 18.5, lineHeight: 1.6, color: DIM, margin: '0 0 32px', maxWidth: 480 }}>{data.subhead}</p>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <Link href="/signup" style={{ background: 'linear-gradient(135deg, #F5C645 0%, #E8A020 100%)', color: '#1A1400', fontWeight: 800, fontSize: 16, padding: '15px 34px', borderRadius: 12, textDecoration: 'none', boxShadow: '0 6px 22px rgba(232,160,32,0.42), 0 2px 6px rgba(232,160,32,0.3)' }}>Start Free Trial →</Link>
              <Link href="/get-the-app" style={{ color: TEXT, fontWeight: 700, fontSize: 15, padding: '15px 28px', borderRadius: 12, border: `1.5px solid rgba(28,25,23,0.18)`, background: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>Get the iOS App</Link>
            </div>
            <p style={{ color: DIM, fontSize: 12, marginTop: 16 }}>No credit card required · 14-day free trial · Cancel anytime</p>
          </div>
          {data.visual && (
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', inset: -22, background: 'radial-gradient(circle, rgba(232,168,60,0.25), transparent 70%)', borderRadius: 28, pointerEvents: 'none' }} />
              <div style={{ position: 'relative', background: '#FFFFFF', borderRadius: 18, padding: '24px 26px', border: '1px solid #F0E7D6', boxShadow: '0 24px 60px rgba(120,80,20,0.18), 0 4px 14px rgba(120,80,20,0.08)' }}>
                {data.visual}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Outcomes — gradient stat tiles ── */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '44px 24px 8px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${data.stats.length}, 1fr)`, gap: 18 }} className="product-stats">
          {data.stats.map((s, i) => (
            <div key={s.label} style={{ background: STAT_GRADS[i % STAT_GRADS.length], borderRadius: 16, padding: '26px 24px', textAlign: 'center', border: '1px solid rgba(200,136,28,0.18)', boxShadow: '0 8px 22px rgba(200,136,28,0.10)' }}>
              <div style={{ fontSize: 38, fontWeight: 900, color: '#B6790F', letterSpacing: '-0.04em', lineHeight: 1, background: 'linear-gradient(135deg, #D89A1E, #A86A0C)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{s.value}</div>
              <div style={{ fontSize: 13.5, color: '#7A5A1E', marginTop: 9, fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Feature sections — alternating, with accent icons ── */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px 16px' }}>
        {data.sections.map((sec, i) => (
          <div key={i} style={{ background: i % 2 === 1 ? 'linear-gradient(145deg, #FFFDF8, #FFF6E6)' : '#FFFFFF', borderRadius: 18, border: '1px solid #F0E7D6', boxShadow: '0 8px 26px rgba(120,80,20,0.09)', padding: '36px 38px', margin: '18px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 44, alignItems: 'center' }} className="product-section">
            <div>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #F5C645, #E8A020)', boxShadow: '0 6px 16px rgba(232,160,32,0.35)', marginBottom: 16 }}>
                <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="#1A1400" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
              </span>
              <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 14px', color: TEXT }}>{sec.title}</h2>
              <p style={{ fontSize: 16, lineHeight: 1.7, color: DIM, margin: 0 }}>{sec.body}</p>
            </div>
            {sec.bullets && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {sec.bullets.map((b) => (
                  <div key={b} style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'linear-gradient(135deg, #FFFBF2, #FDF3E0)', border: '1px solid #F2E6CF', borderRadius: 11, padding: '13px 16px', fontSize: 14.5, color: TEXT, fontWeight: 500 }}>
                    <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: 'rgba(21,128,61,0.12)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg viewBox="0 0 16 16" width={13} height={13} fill={GREEN}><path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm3.4 6.2-4 4a.7.7 0 0 1-1 0l-1.8-1.8a.7.7 0 1 1 1-1l1.3 1.3 3.5-3.5a.7.7 0 0 1 1 1z" /></svg>
                    </span>
                    {b}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </section>

      {/* ── How it works — gradient numbered steps ── */}
      {data.steps && data.steps.length > 0 && (
        <section style={{ background: 'linear-gradient(180deg, #FFFBF2, #FBEAD2)', borderTop: `1px solid ${HAIR}`, borderBottom: `1px solid ${HAIR}` }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '72px 24px' }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 44px', color: TEXT, textAlign: 'center' }}>How it works</h2>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${data.steps.length}, 1fr)`, gap: 20 }} className="product-steps">
              {data.steps.map((st, i) => (
                <div key={i} style={{ background: '#FFFFFF', borderRadius: 16, padding: '26px 24px', border: '1px solid #F0E7D6', boxShadow: '0 8px 22px rgba(120,80,20,0.08)' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, background: 'linear-gradient(135deg, #F5C645, #E8A020)', color: '#1A1400', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, marginBottom: 16, boxShadow: '0 5px 14px rgba(232,160,32,0.35)' }}>{i + 1}</div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 8px', color: TEXT, letterSpacing: '-0.01em' }}>{st.title}</h3>
                  <p style={{ fontSize: 14, color: DIM, lineHeight: 1.6, margin: 0 }}>{st.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Dark CTA — dramatic glow ── */}
      <section style={{ position: 'relative', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 0%, #251608 0%, #0E0B08 60%)', padding: '92px 24px', textAlign: 'center' }}>
        <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%,-50%)', width: 900, height: 500, background: 'radial-gradient(ellipse, rgba(232,168,60,0.20) 0%, transparent 68%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 640, margin: '0 auto' }}>
          <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.025em', color: '#FFFFFF', margin: '0 0 14px', lineHeight: 1.1 }}>{data.closingLine || 'Ready to build smarter?'}</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15.5, margin: '0 0 36px' }}>Start free today — no credit card, no sales call, no contract.</p>
          <Link href="/signup" style={{ background: 'linear-gradient(135deg, #F5C645, #E8A020)', color: '#1A1400', fontWeight: 800, fontSize: 17, padding: '18px 48px', borderRadius: 14, textDecoration: 'none', display: 'inline-block', boxShadow: '0 6px 30px rgba(232,160,32,0.55), 0 2px 8px rgba(232,160,32,0.4)' }}>Start Your Free Trial</Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ background: '#FBF8F2', borderTop: `1px solid ${HAIR}`, maxWidth: 1200, margin: '0 auto', padding: '32px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <img src="/logo-horizontal.png" alt="Saguaro Control Systems" height={28} style={{ height: 28, width: 'auto' }} />
        </a>
        <span style={{ fontSize: 12, color: DIM }}>© {new Date().getFullYear()} Saguaro Technologies Inc. All rights reserved.</span>
      </footer>

      <style>{`
        @media (max-width: 820px) {
          .product-hero { grid-template-columns: 1fr !important; }
          .product-section { grid-template-columns: 1fr !important; gap: 20px !important; padding: 24px 20px !important; }
          .product-steps { grid-template-columns: 1fr !important; }
          .product-stats { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
