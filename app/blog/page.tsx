import React from 'react';

const C = {
  dark: 'transparent',
  pageBg: 'linear-gradient(180deg, #FCF7EE 0%, #F8EFDF 40%, #FBF2E3 70%, #F7ECDA 100%)',
  gold: '#C8881C',
  goldBright: '#E8B84B',
  text: '#2A1B06',
  dim: '#6B5B43',
  border: 'rgba(176,122,18,0.16)',
  raised: 'transparent',
  raisedAlt: 'transparent',
  green: '#1a8a4a',
  blue: '#6366F1',
  eyebrow: '#B07A12',
  font: "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
};

const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Features', href: '/features' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Field App', href: '/get-the-app' },
  { label: 'Compare', href: '/compare' },
];

const FEATURED = {
  category: 'AI in Construction',
  title: 'How AI Takeoffs Cut Estimating Time From Days to Minutes',
  excerpt:
    'Manual quantity takeoffs are the single biggest bottleneck in preconstruction. We break down how Saguaro reads a PDF plan set, counts fixtures, measures linear footage, and calculates square footage automatically — and what that means for win rates when you can turn around three bids in the time it used to take to do one.',
  date: 'June 9, 2026',
  read: '8 min read',
  href: '/signup',
  tag: 'AI Takeoff',
};

const POSTS = [
  {
    category: 'Field Operations',
    title: 'Meet Sage: The AI Assistant That Lives Inside Your Project',
    excerpt:
      'Sage answers questions about your schedule, drafts RFIs from a photo, summarizes the day\'s field reports, and flags budget overruns before they become change orders. Here is how an AI copilot trained on construction workflows actually changes a PM\'s day.',
    date: 'June 2, 2026',
    read: '6 min read',
    href: '/signup',
    tag: 'Sage AI',
    accent: C.gold,
  },
  {
    category: 'Compliance',
    title: 'Lien Waivers, WH-347, and ACORD 25 — Without the Paper Chase',
    excerpt:
      'Conditional vs. unconditional, progress vs. final — lien waiver rules differ in all 50 states. We walk through how Saguaro generates statutory-correct waivers, validates certified payroll against Davis-Bacon rates, and tracks insurance expirations so you never release a payment against a lapsed COI.',
    date: 'May 26, 2026',
    read: '7 min read',
    href: '/signup',
    tag: 'Compliance',
    accent: C.green,
  },
  {
    category: 'Estimating',
    title: 'Bid Smarter: Turning Historical Data Into Sharper Numbers',
    excerpt:
      'Every bid you submit teaches the system something. We explain how Saguaro\'s bid intelligence surfaces your real unit costs, builds a polished bid jacket in minutes, and helps you spot the scope gaps that quietly erode margin on fixed-price work.',
    date: 'May 19, 2026',
    read: '5 min read',
    href: '/signup',
    tag: 'Bid Intelligence',
    accent: C.blue,
  },
  {
    category: 'Cash Flow',
    title: 'Faster Pay Apps: G702/G703 That Owners Actually Approve',
    excerpt:
      'Slow draws kill subcontractors. We look at how generating AIA G702/G703 pay applications straight from your schedule of values — with built-in retainage math and an owner portal for one-click approval — shortens the gap between work performed and cash in the door.',
    date: 'May 12, 2026',
    read: '6 min read',
    href: '/signup',
    tag: 'Pay Apps',
    accent: C.gold,
  },
];

function ArrowIcon({ color = C.gold, size = 16 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 8h9M8.5 4l4 4-4 4" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function BlogPage() {
  return (
    <div style={{ minHeight: '100vh', background: C.pageBg, color: C.text, fontFamily: C.font }}>

      {/* Nav */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
        height: 64, background: 'rgba(255,251,242,0.85)',
        borderBottom: '1px solid #F0E7D6',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'center', padding: '0 32px', gap: 0,
      }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0, marginRight: 40 }}>
          <img src="/logo-full.jpg" alt="Saguaro CRM" style={{ height: 36, width: 'auto', objectFit: 'contain' }} />
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
          {NAV_LINKS.map(link => (
            <a key={link.label} href={link.href} style={{ padding: '6px 12px', borderRadius: 6, color: C.dim, fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>
              {link.label}
            </a>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <a href="/login" style={{ padding: '8px 18px', background: 'rgba(212,160,23,0.10)', border: `1px solid rgba(212,160,23,0.25)`, borderRadius: 10, color: C.gold, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>Log In</a>
          <a href="/signup" style={{ padding: '8px 18px', background: `linear-gradient(135deg, ${C.gold}, ${C.goldBright})`, borderRadius: 10, color: '#0B0B0F', fontSize: 13, fontWeight: 800, textDecoration: 'none', boxShadow: `0 0 20px rgba(212,160,23,0.25)` }}>Free Trial</a>
        </div>
      </nav>

      <div style={{ paddingTop: 64 }}>

        {/* Hero */}
        <section style={{ position: 'relative', textAlign: 'center', padding: '88px 24px 56px', background: 'linear-gradient(160deg, #FFFBF2, #FDF3E2, #FBEAD2)' }}>
          <div style={{ background: 'radial-gradient(circle at 80% 0%, rgba(216,154,30,0.12), transparent 60%)', position: 'absolute', inset: 0, pointerEvents: 'none' }} />
          <div style={{ display: 'inline-block', padding: '5px 14px', background: 'rgba(176,122,18,0.10)', border: `1px solid rgba(176,122,18,0.25)`, borderRadius: 999, fontSize: 11, fontWeight: 700, color: C.eyebrow, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 20 }}>
            The Saguaro Blog
          </div>
          <h1 style={{ fontSize: 'clamp(40px, 6vw, 64px)', fontWeight: 900, lineHeight: 1.08, margin: '0 0 18px', letterSpacing: -1.5 }}>
            Building the future of{' '}
            <span style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldBright})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              construction tech
            </span>
          </h1>
          <p style={{ fontSize: 'clamp(16px, 2vw, 20px)', color: C.dim, maxWidth: 600, margin: '0 auto', lineHeight: 1.65 }}>
            Field notes on AI takeoffs, the Sage assistant, bids, pay apps, RFIs, and the compliance grind — written for the people who actually run the job.
          </p>
        </section>

        {/* Featured Post */}
        <section style={{ padding: '0 24px 64px', maxWidth: 1100, margin: '0 auto' }}>
          <a href={FEATURED.href} style={{ textDecoration: 'none', display: 'block' }}>
            <div style={{
              padding: '8px 0 40px', borderBottom: `1px solid ${C.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: C.gold, letterSpacing: 1.5, textTransform: 'uppercase' }}>Featured</span>
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: C.dim, display: 'inline-block' }} />
                <span style={{ fontSize: 12, color: C.dim }}>{FEATURED.category}</span>
                <span style={{ fontSize: 11, color: C.eyebrow, background: 'rgba(176,122,18,0.10)', border: '1px solid rgba(176,122,18,0.25)', borderRadius: 999, padding: '2px 10px', fontWeight: 600 }}>{FEATURED.tag}</span>
              </div>
              <h2 style={{ fontSize: 'clamp(26px, 3.4vw, 38px)', fontWeight: 900, lineHeight: 1.15, margin: '0 0 16px', letterSpacing: -0.6, color: C.text, maxWidth: 760 }}>
                {FEATURED.title}
              </h2>
              <p style={{ fontSize: 16, color: C.dim, lineHeight: 1.7, margin: '0 0 24px', maxWidth: 760 }}>
                {FEATURED.excerpt}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 13, color: C.dim }}>{FEATURED.date}</span>
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: C.dim, display: 'inline-block' }} />
                  <span style={{ fontSize: 13, color: C.dim }}>{FEATURED.read}</span>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 700, color: C.gold }}>
                  Read article <ArrowIcon />
                </span>
              </div>
            </div>
          </a>
        </section>

        {/* Post Grid */}
        <section style={{ padding: '0 24px 80px', maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 8 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: C.text }}>Latest articles</h2>
            <span style={{ fontSize: 13, color: C.dim }}>Insights from the Saguaro Control team</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
            {POSTS.map(post => (
              <a key={post.title} href={post.href} style={{ textDecoration: 'none', display: 'block' }}>
                <article style={{
                  borderTop: `1px solid ${C.border}`,
                  padding: '24px 0 0', height: '100%', boxSizing: 'border-box',
                  display: 'flex', flexDirection: 'column',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: post.accent, display: 'inline-block' }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: post.accent, letterSpacing: 1, textTransform: 'uppercase' }}>{post.category}</span>
                  </div>
                  <h3 style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.3, margin: '0 0 12px', color: C.text, letterSpacing: -0.3 }}>
                    {post.title}
                  </h3>
                  <p style={{ fontSize: 14, color: C.dim, lineHeight: 1.65, margin: '0 0 22px', flex: 1 }}>
                    {post.excerpt}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 18, borderTop: `1px solid ${C.border}`, gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, color: C.dim }}>{post.date}</span>
                      <span style={{ width: 3, height: 3, borderRadius: '50%', background: C.dim, display: 'inline-block' }} />
                      <span style={{ fontSize: 12, color: C.dim }}>{post.read}</span>
                    </div>
                    <ArrowIcon color={post.accent} size={15} />
                  </div>
                </article>
              </a>
            ))}
          </div>

          {/* More coming soon */}
          <div style={{ marginTop: 40, textAlign: 'center', padding: '32px 24px', borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>More stories on the way</div>
            <p style={{ fontSize: 14, color: C.dim, margin: 0, lineHeight: 1.6 }}>
              We publish new construction-tech deep dives every couple of weeks. Start a free trial and we will email you when the next one drops.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section style={{ padding: '88px 24px', background: 'radial-gradient(ellipse at 50% 0%, #251608, #0E0B08)', textAlign: 'center' }}>
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900, margin: '0 0 16px', lineHeight: 1.15, letterSpacing: -0.8, color: '#F5E9D6' }}>
              Stop reading about it.{' '}
              <span style={{ background: `linear-gradient(135deg, #D89A1E, #A86A0C)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Run a real bid.</span>
            </h2>
            <p style={{ fontSize: 17, color: '#C9B79A', margin: '0 0 32px', lineHeight: 1.6 }}>
              AI takeoffs, the Sage assistant, pay apps, RFIs, and 50-state compliance — all in one platform. 30-day free trial, free migration, no credit card.
            </p>
            <a href="/signup" style={{ display: 'inline-block', padding: '15px 36px', background: 'linear-gradient(135deg,#E8B84B,#C98A1A)', borderRadius: 10, color: '#2A1B06', fontWeight: 700, fontSize: 16, textDecoration: 'none', boxShadow: '0 6px 18px rgba(201,138,26,0.28)' }}>
              Start Free Trial — No Credit Card
            </a>
          </div>
        </section>

        {/* Footer */}
        <footer style={{ borderTop: `1px solid ${C.border}`, padding: '48px 32px', background: 'linear-gradient(180deg,#FBF3E4,#F7EAD4)' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 32 }}>
            <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
              <img src="/logo-full.jpg" alt="Saguaro CRM" style={{ height: 30, width: 'auto', objectFit: 'contain' }} />
            </a>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
              {[
                { label: 'Home', href: '/' }, { label: 'Features', href: '/features' },
                { label: 'Pricing', href: '/pricing' }, { label: 'Blog', href: '/blog' },
                { label: 'Field App', href: '/get-the-app' }, { label: 'Privacy', href: '/privacy' }, { label: 'Terms', href: '/terms' },
              ].map(link => (
                <a key={link.label} href={link.href} style={{ fontSize: 13, color: C.dim, textDecoration: 'none', fontWeight: 500 }}>{link.label}</a>
              ))}
            </div>
            <div style={{ fontSize: 12, color: C.dim, whiteSpace: 'nowrap' }}>&copy; {new Date().getFullYear()} Saguaro CRM</div>
          </div>
        </footer>

      </div>
    </div>
  );
}
