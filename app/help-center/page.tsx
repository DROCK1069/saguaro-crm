'use client';
import React, { useState } from 'react';

const C = {
  dark: '#0B0B0F',
  gold: '#D4A017',
  goldBright: '#F0C040',
  text: '#F5F5F7',
  dim: '#A1A1AA',
  border: 'rgba(255,255,255,0.10)',
  raised: '#131318',
  raisedAlt: '#1A1A21',
  green: '#22C55E',
  blue: '#6366F1',
  font: "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
};

const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Features', href: '/features' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Field App', href: '/get-the-app' },
  { label: 'Compare', href: '/compare' },
];

type Cat = {
  key: string;
  title: string;
  desc: string;
  articles: string[];
  icon: React.ReactNode;
};

function Icon({ d, size = 22 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      {d.split('|').map((path, i) => <path key={i} d={path} />)}
    </svg>
  );
}

const CATEGORIES: Cat[] = [
  {
    key: 'getting-started',
    title: 'Getting Started',
    desc: 'Set up your company, invite your team, and import your first project from any platform.',
    icon: <Icon d="M12 2l9 4.5v11L12 22l-9-4.5v-11L12 2z|M12 2v20|M3 6.5l9 4.5 9-4.5" />,
    articles: [
      'Create your company account in 5 minutes',
      'Invite your team — PMs, supers, estimators',
      'Free migration from Procore or Buildertrend',
      'Install the field app on iPhone & Android',
      'Set up roles, permissions & approval chains',
    ],
  },
  {
    key: 'projects',
    title: 'Projects',
    desc: 'Run jobs end to end — schedules, RFIs, submittals, change orders, and daily logs.',
    icon: <Icon d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z|M8 13h8|M8 17h5" />,
    articles: [
      'Create a project & set the budget structure',
      'Manage RFIs and route them with Autopilot',
      'Submittals, transmittals & document control',
      'Change orders and CO logs that tie to the budget',
      'Daily logs, photos & weather from the field',
    ],
  },
  {
    key: 'financials',
    title: 'Financials',
    desc: 'Pay applications, AIA documents, budgets, and cost tracking that reconcile automatically.',
    icon: <Icon d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z|M7 8h10|M7 12h6|M7 16h4" />,
    articles: [
      'Generate G702 / G703 pay applications',
      'AIA documents: G702–G706, A310, A312',
      'Lien waivers — all 50 states, all 4 types',
      'Certified Payroll WH-347 + Davis-Bacon lookup',
      'Track budgets, commitments & cost-to-complete',
    ],
  },
  {
    key: 'field-app',
    title: 'Field App',
    desc: 'Saguaro Field for iOS & Android — works offline, syncs when you get signal.',
    icon: <Icon d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z|M11 18h2" />,
    articles: [
      'Download & log in to Saguaro Field',
      'Capture punch-list items with photos',
      'Log time & track crews on site',
      'Work offline — automatic sync on reconnect',
      'Push notifications for RFIs & approvals',
    ],
  },
  {
    key: 'billing',
    title: 'Billing',
    desc: 'Manage your subscription, invoices, add-ons, and seats. No per-seat surprises.',
    icon: <Icon d="M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z|M3 10h18|M7 15h4" />,
    articles: [
      'Switch between monthly & annual billing',
      'Upgrade, downgrade or add a plan add-on',
      'Update your payment method & receipts',
      'Understand flat pricing & unlimited users',
      'Cancel, pause & data retention policy',
    ],
  },
];

const POPULAR = [
  'How do I migrate from Procore?',
  'Generate a G703 continuation sheet',
  'Reset my password',
  'Add a teammate to a project',
  'Lien waiver for California',
  'Install the field app',
];

const FAQS = [
  {
    q: 'How do I move my data over from Procore or Buildertrend?',
    a: 'Free migration is included on every plan. From Settings → Migration, tell us your current platform and our team imports all your projects, contacts, vendors, documents, pay-app history, and team accounts. Most companies are fully live in 1 business day — you do nothing.',
  },
  {
    q: 'What is Sage, the AI assistant?',
    a: 'Sage is the built-in AI assistant inside Saguaro. Ask it to draft an RFI, summarize a long submittal, find which lien-waiver type a state requires, or pull the cost-to-complete on a job. Sage reads your project context so answers are specific to your data — never generic.',
  },
  {
    q: 'How accurate is AI Takeoff and how do I run one?',
    a: 'Upload a PDF plan set under a project, draw a scale reference, and AI Takeoff measures linear feet, square footage, and counts automatically. Every measurement is editable, so you stay in control. Starter includes 100 pages/mo; Professional and Enterprise are unlimited.',
  },
  {
    q: 'Which states are supported for lien waivers?',
    a: 'All 50 states. Arizona, California, Texas, Nevada, Florida, Colorado, Washington, Oregon, Utah, and New Mexico use state-specific statutory language. Every other state uses our attorney-reviewed generic form. All four waiver types (conditional/unconditional, progress/final) are available on Professional and Enterprise.',
  },
  {
    q: 'Does the field app work without cell signal?',
    a: 'Yes. Saguaro Field is offline-first. Log daily reports, punch-list items, photos, and time entries with no connection — everything queues locally and syncs automatically the moment you regain signal. No data is lost on a dead-zone job site.',
  },
  {
    q: 'How do I invite my team and set permissions?',
    a: 'Go to Settings → Team, enter email addresses, and assign a role (Admin, PM, Field, Accounting, or Read-Only). Every plan includes unlimited users at no extra cost, so there is never a per-seat charge for adding your whole crew, your estimators, or the owner.',
  },
  {
    q: 'Can owners and subcontractors get their own login?',
    a: 'Yes. The Owner Portal and Sub Portal (included on Professional and Enterprise) give external parties a scoped, sandboxed view — owners approve pay apps and change orders, subs submit invoices, COIs, and lien waivers. They only see what you share with them.',
  },
  {
    q: 'I forgot my password — how do I reset it?',
    a: 'On the login screen, click "Forgot password" and enter your email. You will get a secure reset link within a minute. If it does not arrive, check spam or contact support and we will verify your identity and reset it manually.',
  },
];

export default function HelpCenterPage() {
  const [query, setQuery] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const q = query.trim().toLowerCase();
  const filteredFaqs = q
    ? FAQS.filter(f => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q))
    : FAQS;

  return (
    <div style={{ minHeight: '100vh', background: C.dark, color: C.text, fontFamily: C.font }}>

      {/* Nav */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
        height: 64, background: 'rgba(13,17,23,0.9)',
        borderBottom: `1px solid ${C.border}`,
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'center', padding: '0 32px', gap: 0,
      }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0, marginRight: 40 }}>
          <img src="/logo-full.jpg" alt="Saguaro CRM" style={{ height: 36, width: 'auto', mixBlendMode: 'screen', objectFit: 'contain' }} />
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
          {NAV_LINKS.map(link => (
            <a key={link.label} href={link.href} style={{ padding: '6px 12px', borderRadius: 6, color: C.dim, fontSize: 14, fontWeight: 500, textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.color = C.text)}
              onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
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

        {/* Hero + Search */}
        <section style={{ textAlign: 'center', padding: '88px 24px 56px', background: `radial-gradient(ellipse 900px 500px at 50% 0%, rgba(212,160,23,0.07) 0%, transparent 70%)` }}>
          <div style={{ display: 'inline-block', padding: '5px 14px', background: 'rgba(212,160,23,0.12)', border: `1px solid rgba(212,160,23,0.25)`, borderRadius: 999, fontSize: 11, fontWeight: 700, color: C.gold, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 20 }}>
            Help Center
          </div>
          <h1 style={{ fontSize: 'clamp(36px, 5.5vw, 60px)', fontWeight: 900, lineHeight: 1.08, margin: '0 0 16px', letterSpacing: -1.2 }}>
            How can we{' '}
            <span style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldBright})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              help you build?
            </span>
          </h1>
          <p style={{ fontSize: 'clamp(15px, 2vw, 19px)', color: C.dim, maxWidth: 560, margin: '0 auto 32px', lineHeight: 1.6 }}>
            Guides, answers, and walkthroughs for everything in Saguaro Control — from AI takeoffs and pay apps to the field app and billing.
          </p>

          {/* Search box */}
          <div style={{ maxWidth: 620, margin: '0 auto', position: 'relative' }}>
            <div style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={C.dim} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
            </div>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search help articles — e.g. pay applications, lien waiver, field app…"
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '17px 20px 17px 52px',
                background: C.raisedAlt, border: `1px solid ${C.border}`, borderRadius: 14,
                color: C.text, fontSize: 15, fontFamily: C.font, outline: 'none',
                boxShadow: '0 4px 14px rgba(0,0,0,.45)',
              }}
              onFocus={e => (e.currentTarget.style.border = `1px solid rgba(212,160,23,0.45)`)}
              onBlur={e => (e.currentTarget.style.border = `1px solid ${C.border}`)}
            />
          </div>

          {/* Popular searches */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 660, margin: '20px auto 0' }}>
            <span style={{ fontSize: 13, color: C.dim, alignSelf: 'center', marginRight: 2 }}>Popular:</span>
            {POPULAR.map(p => (
              <button key={p} onClick={() => setQuery(p)} style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 999, fontSize: 12.5, color: C.dim, fontWeight: 500, cursor: 'pointer', fontFamily: C.font }}
                onMouseEnter={e => { e.currentTarget.style.color = C.gold; e.currentTarget.style.borderColor = 'rgba(212,160,23,0.30)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = C.dim; e.currentTarget.style.borderColor = C.border; }}>
                {p}
              </button>
            ))}
          </div>
        </section>

        {/* Category Grid */}
        <section style={{ padding: '0 24px 88px', maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 style={{ fontSize: 'clamp(24px, 3vw, 32px)', fontWeight: 800, margin: '0 0 8px', letterSpacing: -0.5 }}>Browse by category</h2>
            <p style={{ fontSize: 15, color: C.dim, margin: 0 }}>Pick a topic to dive into step-by-step guides.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
            {CATEGORIES.map(cat => (
              <div key={cat.key} style={{ background: C.raisedAlt, border: `1px solid ${C.border}`, borderRadius: 14, padding: '28px 26px', boxShadow: '0 1px 2px rgba(0,0,0,.4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(212,160,23,0.10)', border: '1px solid rgba(212,160,23,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {cat.icon}
                  </div>
                  <h3 style={{ fontSize: 19, fontWeight: 800, color: C.text, margin: 0 }}>{cat.title}</h3>
                </div>
                <p style={{ fontSize: 13.5, color: C.dim, lineHeight: 1.6, margin: '0 0 18px' }}>{cat.desc}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0, borderTop: `1px solid ${C.border}` }}>
                  {cat.articles.map(a => (
                    <a key={a} href="/signup" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '11px 0', borderBottom: `1px solid ${C.border}`, textDecoration: 'none', color: C.text }}
                      onMouseEnter={e => (e.currentTarget.style.color = C.gold)}
                      onMouseLeave={e => (e.currentTarget.style.color = C.text)}>
                      <span style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.4 }}>{a}</span>
                      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.7 }}>
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section style={{ padding: '0 24px 88px', maxWidth: 800, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <div style={{ display: 'inline-block', padding: '5px 14px', background: 'rgba(212,160,23,0.12)', border: `1px solid rgba(212,160,23,0.25)`, borderRadius: 999, fontSize: 11, fontWeight: 700, color: C.gold, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16 }}>Common Questions</div>
            <h2 style={{ fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>Frequently asked questions</h2>
            {q && (
              <p style={{ fontSize: 14, color: C.dim, margin: '14px 0 0' }}>
                {filteredFaqs.length} result{filteredFaqs.length === 1 ? '' : 's'} for &ldquo;{query.trim()}&rdquo;
              </p>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {filteredFaqs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: C.dim, fontSize: 15 }}>
                No articles match that search. Try a different term, or{' '}
                <a href="/contact" style={{ color: C.gold, textDecoration: 'none', fontWeight: 600 }}>contact our team</a>.
              </div>
            ) : (
              filteredFaqs.map((faq, i) => (
                <div key={faq.q} style={{ borderBottom: i < filteredFaqs.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ width: '100%', textAlign: 'left', padding: '22px 0', background: 'none', border: 'none', color: C.text, fontSize: 16, fontWeight: 600, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, lineHeight: 1.4, fontFamily: C.font }}>
                    <span>{faq.q}</span>
                    <span style={{ flexShrink: 0, width: 28, height: 28, background: openFaq === i ? `rgba(212,160,23,0.15)` : 'rgba(255,255,255,0.05)', border: `1px solid ${openFaq === i ? 'rgba(212,160,23,0.40)' : C.border}`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gold, fontSize: 18, fontWeight: 300 }}>
                      {openFaq === i ? '−' : '+'}
                    </span>
                  </button>
                  {openFaq === i && (
                    <div style={{ padding: '0 0 22px', fontSize: 15, color: C.dim, lineHeight: 1.75, maxWidth: 680 }}>{faq.a}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        {/* Contact Support CTA */}
        <section style={{ padding: '0 24px 96px', maxWidth: 980, margin: '0 auto' }}>
          <div style={{ background: 'linear-gradient(135deg, rgba(212,160,23,0.10) 0%, rgba(11,11,15,0) 100%)', border: `1px solid rgba(212,160,23,0.30)`, borderRadius: 14, padding: '44px 48px', display: 'flex', gap: 40, alignItems: 'center', flexWrap: 'wrap', boxShadow: '0 4px 14px rgba(0,0,0,.45)' }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.gold, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>Still need a hand?</div>
              <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 32px)', fontWeight: 900, margin: '0 0 12px', lineHeight: 1.2 }}>Talk to a real human on our support team</h2>
              <p style={{ fontSize: 15, color: C.dim, margin: '0 0 24px', lineHeight: 1.65 }}>
                Our support team is built from people who have actually run construction jobs. Reach out and we will help you set up your company, run your first pay app, or migrate from your old platform.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  'Email support included on every plan',
                  'Priority chat with 4-hour response on Pro',
                  'Free guided migration from any platform',
                ].map(item => (
                  <div key={item} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                      <circle cx="8" cy="8" r="8" fill={`${C.gold}22`} />
                      <path d="M4.5 8l2.5 2.5 4-5" stroke={C.gold} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span style={{ fontSize: 14, color: C.text }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'stretch', minWidth: 220 }}>
              <a href="/contact" style={{ padding: '15px 28px', background: `linear-gradient(135deg, ${C.gold}, ${C.goldBright})`, borderRadius: 10, color: '#0B0B0F', fontWeight: 800, fontSize: 15, textDecoration: 'none', boxShadow: `0 4px 14px rgba(212,160,23,0.30)`, textAlign: 'center' }}>
                Contact Support
              </a>
              <a href="/signup" style={{ padding: '15px 28px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontWeight: 700, fontSize: 15, textDecoration: 'none', textAlign: 'center' }}>
                Start Free Trial
              </a>
              <a href="mailto:support@saguarocontrol.net" style={{ fontSize: 13, color: C.dim, textDecoration: 'none', textAlign: 'center', marginTop: 2 }}>
                support@saguarocontrol.net
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer style={{ borderTop: `1px solid ${C.border}`, padding: '48px 32px', background: C.raised }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 32 }}>
            <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
              <img src="/logo-full.jpg" alt="Saguaro CRM" style={{ height: 30, width: 'auto', mixBlendMode: 'screen', objectFit: 'contain' }} />
            </a>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
              {[
                { label: 'Home', href: '/' }, { label: 'Features', href: '/features' },
                { label: 'Pricing', href: '/pricing' }, { label: 'Compare', href: '/compare' },
                { label: 'Field App', href: '/get-the-app' }, { label: 'Contact', href: '/contact' },
                { label: 'Security', href: '/security' }, { label: 'Privacy', href: '/privacy' }, { label: 'Terms', href: '/terms' },
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
