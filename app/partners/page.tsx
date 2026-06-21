'use client';
import React, { useState } from 'react';

const C = {
  dark: 'linear-gradient(180deg, #FCF7EE 0%, #F8EFDF 40%, #FBF2E3 70%, #F7ECDA 100%)',
  hero: 'linear-gradient(160deg, #FFFBF2, #FDF3E2, #FBEAD2)',
  gold: '#C8881C',
  goldBright: '#E8A020',
  text: '#2A1B06',
  dim: '#6B5B43',
  border: '#F0E7D6',
  raised: '#FFFBF2',
  raisedAlt: '#FFFBF2',
  green: '#34C759',
  blue: '#6366F1',
  cardShadow: '0 8px 26px rgba(120,80,20,0.09)',
  font: "'Inter',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
};

const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Features', href: '/features' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Field App', href: '/get-the-app' },
  { label: 'Compare', href: '/compare' },
];

// ── Integrations ──────────────────────────────────────────────────────────
const INTEGRATIONS = [
  {
    name: 'QuickBooks',
    category: 'Accounting',
    status: 'Live',
    accent: '#2CA01C',
    abbr: 'QB',
    desc: 'Bidirectional sync of budgets, pay applications, and change orders with QuickBooks Online and Desktop. Cost codes map to your chart of accounts so AIA G702/G703 draws post straight to your books.',
    bullets: [
      'Two-way sync of pay apps & change orders',
      'Cost-code to chart-of-accounts mapping',
      'Vendor & customer record matching',
      'Retention and lien-release tracking',
    ],
  },
  {
    name: 'Stripe',
    category: 'Payments',
    status: 'Live',
    accent: '#635BFF',
    abbr: 'S',
    desc: 'Collect owner payments and subcontractor disbursements directly from approved pay applications. ACH and card payments settle against the draw schedule, with receipts attached to the project ledger automatically.',
    bullets: [
      'Owner billing from approved G702 draws',
      'ACH & card payouts to subcontractors',
      'Automated receipts on the project ledger',
      'PCI-compliant — no card data touches Saguaro',
    ],
  },
  {
    name: 'DocuSign',
    category: 'E-Signature',
    status: 'Live',
    accent: '#FFCC22',
    abbr: 'DS',
    desc: 'Send contracts, change orders, and lien waivers for legally binding signature without leaving the project. Executed documents flow back into compliance tracking and the audit trail the moment they are signed.',
    bullets: [
      'Subcontracts & change orders out for signature',
      'Conditional & unconditional lien waivers',
      'Signature status synced to compliance log',
      'Tamper-evident audit trail on every envelope',
    ],
  },
  {
    name: 'Autodesk',
    category: 'Design & BIM',
    status: 'Live',
    accent: '#0696D7',
    abbr: 'AD',
    desc: 'Pull drawing sets and sheet revisions from Autodesk Construction Cloud and Build directly into Saguaro AI Takeoff. When the architect issues a new revision, the takeoff flags affected scopes for re-measure.',
    bullets: [
      'Sheet & revision sync from ACC / Build',
      'Drawings feed Saguaro AI Takeoff',
      'Revision-aware re-measure alerts',
      'RFI references link back to the model',
    ],
  },
  {
    name: 'Procore',
    category: 'Migration',
    status: 'Live',
    accent: '#F47E42',
    abbr: 'PC',
    desc: 'Import every project, contact, document, RFI, and submittal from Procore in a single guided migration. Our team maps your modules to Saguaro and you go live in one business day — at no cost.',
    bullets: [
      'Full project & directory import',
      'RFIs, submittals & daily logs preserved',
      'Document history kept intact',
      'White-glove migration in one business day',
    ],
  },
  {
    name: 'Sage 300 CRE',
    category: 'Accounting',
    status: 'Beta',
    accent: '#00DC8C',
    abbr: 'SG',
    desc: 'Connect Saguaro pay applications and job-cost data to Sage 300 Construction and Real Estate. Job cost, AP, and AR records reconcile against the same draw schedule your field and accounting teams already use.',
    bullets: [
      'Job-cost & commitment sync',
      'AP / AR reconciliation by project',
      'Draw schedule shared across teams',
      'Now in private beta — request access',
    ],
  },
  {
    name: 'Google Drive',
    category: 'Documents',
    status: 'Live',
    accent: '#1FA463',
    abbr: 'GD',
    desc: 'Back project documents, generated AIA forms, and photo logs to a connected Google Drive folder. Files stay organized by project and sync automatically so your records live in two places at once.',
    bullets: [
      'Auto-backup of generated documents',
      'Project-foldered photo & daily logs',
      'Shared-drive support for your org',
      'Two-way file sync',
    ],
  },
  {
    name: 'Open REST API',
    category: 'Developer',
    status: 'Live',
    accent: '#D4A017',
    abbr: 'API',
    desc: 'A full REST API and webhook system for building custom workflows on top of Saguaro. Read and write projects, pay apps, RFIs, and takeoffs, and subscribe to real-time events from your own stack.',
    bullets: [
      'REST endpoints for every core object',
      'Outbound webhooks on key events',
      'Scoped API keys per integration',
      'OpenAPI spec & sandbox environment',
    ],
  },
];

const STATUS_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  Live: { color: '#34C759', bg: 'rgba(52,199,89,0.10)', border: 'rgba(52,199,89,0.25)' },
  Beta: { color: '#C8881C', bg: 'rgba(200,136,28,0.12)', border: 'rgba(200,136,28,0.25)' },
};

const CATEGORIES = ['All', 'Accounting', 'Payments', 'E-Signature', 'Design & BIM', 'Documents', 'Migration', 'Developer'];

// ── Partner program tiers ─────────────────────────────────────────────────
const PARTNER_TIERS = [
  {
    name: 'Referral Partner',
    tagline: 'Send us business, earn recurring revenue',
    icon: 'handshake',
    features: [
      '20% recurring commission for 12 months',
      'Co-branded referral links & tracking',
      'No technical work required',
      'Quarterly payouts via Stripe',
    ],
    cta: 'Become a Referral Partner',
    popular: false,
  },
  {
    name: 'Solution Partner',
    tagline: 'Implement & resell under your brand',
    icon: 'layers',
    features: [
      'White-label your brand & domain',
      'Wholesale pricing on every plan',
      'Dedicated partner success manager',
      'Co-marketing & lead sharing',
      'Priority roadmap input',
    ],
    cta: 'Apply as a Solution Partner',
    popular: true,
  },
  {
    name: 'Technology Partner',
    tagline: 'Build an integration on our API',
    icon: 'plug',
    features: [
      'Full REST API & webhook access',
      'Sandbox tenant for development',
      'Listing in the Saguaro directory',
      'Engineering co-build support',
    ],
    cta: 'Build on Saguaro',
    popular: false,
  },
];

// ── How it works ──────────────────────────────────────────────────────────
const STEPS = [
  { step: '1', title: 'Apply', desc: 'Tell us about your firm, your clients, and the construction workflows you serve. Most applications are reviewed within two business days.' },
  { step: '2', title: 'Onboard', desc: 'Get a sandbox tenant, partner pricing, and a dedicated contact. We co-build your integration or set up your white-label workspace.' },
  { step: '3', title: 'Launch', desc: 'Go live with co-marketing support, a directory listing, and tracking links. Your customers migrate from any platform free of charge.' },
  { step: '4', title: 'Grow', desc: 'Earn recurring revenue, share leads, and shape the roadmap. Quarterly business reviews keep the partnership compounding.' },
];

const FAQS = [
  { q: 'How much does it cost to become a partner?', a: 'Nothing. The Saguaro Partner Program is free to join across all three tiers. Referral Partners earn commission, Solution Partners buy at wholesale and set their own retail price, and Technology Partners get free API and sandbox access.' },
  { q: 'Do you really migrate my clients for free?', a: 'Yes. Every customer you bring over gets free white-glove migration from Procore, Buildertrend, CoConstruct, Sage, or spreadsheets. Our team handles projects, contacts, documents, RFIs, and history — usually live in one business day.' },
  { q: 'Can I white-label Saguaro under my own brand?', a: 'Solution Partners can fully white-label the platform with your brand, logo, and custom domain. Each of your clients gets a sandboxed tenant with row-level data isolation, and your team manages them from a single partner console.' },
  { q: 'What does the API support?', a: 'The Open REST API exposes projects, pay applications, RFIs, change orders, takeoffs, contacts, and documents, plus outbound webhooks for real-time events. Technology Partners get scoped API keys, an OpenAPI spec, and a sandbox tenant to build against.' },
  { q: 'How and when are commissions paid?', a: 'Referral Partners earn 20% of subscription revenue for the first 12 months of each referred account, paid quarterly via Stripe. Tracking is fully transparent in your partner dashboard so you always see attributed signups and pending payouts.' },
  { q: 'Is there support for building an integration?', a: 'Yes. Technology Partners get engineering co-build support, a dedicated Slack channel, and a private beta path. Once your integration is live it is listed in the Saguaro integrations directory in front of every customer.' },
];

function CheckIcon({ size = 16, color = C.green }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
      <circle cx="8" cy="8" r="8" fill={`${color}22`} />
      <path d="M4.5 8l2.5 2.5 4-5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TierIcon({ name, color }: { name: string; color: string }) {
  const common = { width: 26, height: 26, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (name === 'handshake') {
    return (
      <svg {...common}>
        <path d="M11 17l2 2a1 1 0 0 0 3-3" />
        <path d="M14 14l2.5 2.5a1 1 0 0 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 0 1-1.42 0l-1.06-1.06a1 1 0 0 0-1.41 0L4 12.5" />
        <path d="M21 3l-5 5" />
        <path d="M3 3l5 5" />
      </svg>
    );
  }
  if (name === 'layers') {
    return (
      <svg {...common}>
        <path d="M12 2l9 5-9 5-9-5 9-5z" />
        <path d="M3 12l9 5 9-5" />
        <path d="M3 17l9 5 9-5" />
      </svg>
    );
  }
  // plug
  return (
    <svg {...common}>
      <path d="M9 2v6" />
      <path d="M15 2v6" />
      <path d="M6 8h12v3a6 6 0 0 1-12 0V8z" />
      <path d="M12 17v5" />
    </svg>
  );
}

export default function PartnersPage() {
  const [filter, setFilter] = useState('All');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const shown = filter === 'All' ? INTEGRATIONS : INTEGRATIONS.filter(i => i.category === filter);

  return (
    <div style={{ minHeight: '100vh', background: C.dark, color: C.text, fontFamily: C.font }}>

      {/* Nav */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
        height: 64, background: 'rgba(255,251,242,0.88)',
        borderBottom: `1px solid ${C.border}`,
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'center', padding: '0 32px', gap: 0,
      }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0, marginRight: 40 }}>
          <img src="/logo-horizontal.png" alt="Saguaro CRM" style={{ height: 34, width: 'auto', objectFit: 'contain' }} />
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
          <a href="/login" style={{ padding: '8px 18px', background: 'rgba(200,136,28,0.10)', border: `1px solid rgba(200,136,28,0.25)`, borderRadius: 10, color: C.gold, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>Log In</a>
          <a href="/signup" style={{ padding: '8px 18px', background: `linear-gradient(135deg, #E8B84B, #C98A1A)`, borderRadius: 10, color: '#2A1B06', fontSize: 13, fontWeight: 800, textDecoration: 'none', boxShadow: '0 6px 18px rgba(201,138,26,0.28)' }}>Free Trial</a>
        </div>
      </nav>

      <div style={{ paddingTop: 64 }}>

        {/* Hero */}
        <section style={{ position: 'relative', overflow: 'hidden', textAlign: 'center', padding: '88px 24px 56px', background: C.hero, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ position: 'absolute', top: -160, right: -80, width: 620, height: 620, background: 'radial-gradient(circle at 80% 0%, rgba(216,154,30,0.12), transparent 60%)', pointerEvents: 'none' }} />
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', background: 'rgba(200,136,28,0.10)', border: `1px solid rgba(200,136,28,0.25)`, borderRadius: 20, fontSize: 12, fontWeight: 700, color: C.gold, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 24 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.gold, display: 'inline-block' }} />
            Saguaro Partner Program
          </div>

          <h1 style={{ fontSize: 'clamp(40px, 6vw, 68px)', fontWeight: 900, lineHeight: 1.08, margin: '0 0 20px', letterSpacing: -1.5, color: C.text }}>
            Connect the tools{' '}
            <span style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldBright})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              your crews already run on.
            </span>
          </h1>
          <p style={{ fontSize: 'clamp(16px, 2vw, 20px)', color: C.dim, maxWidth: 620, margin: '0 auto 36px', lineHeight: 1.65 }}>
            Saguaro Control connects to QuickBooks, Stripe, DocuSign, and Autodesk — and the Open API lets anyone build more. Integrate, resell, or refer, and grow alongside the AI-powered construction platform.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/signup" style={{ display: 'inline-block', padding: '14px 32px', background: `linear-gradient(135deg, #E8B84B, #C98A1A)`, borderRadius: 10, color: '#2A1B06', fontWeight: 800, fontSize: 15, textDecoration: 'none', boxShadow: '0 6px 18px rgba(201,138,26,0.28)' }}>
              Start Free — Connect Your Stack
            </a>
            <a href="#become-a-partner" style={{ display: 'inline-block', padding: '14px 32px', background: '#FFFBF2', border: `1.5px solid #2A1B06`, borderRadius: 10, color: '#2A1B06', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
              Become a Partner
            </a>
          </div>
        </section>

        {/* Integrations */}
        <section style={{ padding: '0 24px 96px', maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ display: 'inline-block', padding: '5px 14px', background: 'rgba(200,136,28,0.10)', border: `1px solid rgba(200,136,28,0.25)`, borderRadius: 999, fontSize: 11, fontWeight: 700, color: C.gold, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16 }}>
              Integrations
            </div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, margin: '0 0 12px', letterSpacing: '-0.03em', color: '#2A1B06' }}>Works with the tools you already use</h2>
            <p style={{ fontSize: 16, color: C.dim, maxWidth: 560, margin: '0 auto', lineHeight: 1.6 }}>Push pay apps to your books, collect payments, sign documents, and pull drawings — without leaving the project.</p>
          </div>

          {/* Category filter */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 36 }}>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setFilter(cat)} style={{
                padding: '7px 16px', borderRadius: 999, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: C.font,
                background: filter === cat ? 'rgba(200,136,28,0.12)' : '#FFFBF2',
                border: `1px solid ${filter === cat ? 'rgba(200,136,28,0.35)' : '#F0E7D6'}`,
                color: filter === cat ? '#C8881C' : '#6B5B43',
                transition: 'background 0.15s, color 0.15s',
              }}>
                {cat}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 40 }}>
            {shown.map(intg => {
              const s = STATUS_STYLES[intg.status];
              return (
                <div key={intg.name} style={{ borderTop: '1px solid rgba(176,122,18,0.16)', paddingTop: 28, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0, background: `${intg.accent}1A`, border: `1px solid ${intg.accent}59`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: intg.abbr.length > 2 ? 13 : 16, color: intg.accent, letterSpacing: 0.5 }}>
                      {intg.abbr}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 17, fontWeight: 800, color: C.text }}>{intg.name}</span>
                        <span style={{ fontSize: 10, fontWeight: 800, color: s.color, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 999, padding: '2px 8px', letterSpacing: 0.5, textTransform: 'uppercase' }}>{intg.status}</span>
                      </div>
                      <div style={{ fontSize: 12, color: C.dim, marginTop: 3 }}>{intg.category}</div>
                    </div>
                  </div>
                  <p style={{ fontSize: 13.5, color: C.dim, lineHeight: 1.6, margin: '0 0 18px' }}>{intg.desc}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 'auto' }}>
                    {intg.bullets.map(b => (
                      <div key={b} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <CheckIcon size={15} color={C.green} />
                        <span style={{ fontSize: 13, color: C.text, lineHeight: 1.45 }}>{b}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Partner program tiers */}
        <section id="become-a-partner" style={{ padding: '0 24px 96px', maxWidth: 1160, margin: '0 auto', scrollMarginTop: 80 }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ display: 'inline-block', padding: '5px 14px', background: 'rgba(200,136,28,0.10)', border: `1px solid rgba(200,136,28,0.25)`, borderRadius: 999, fontSize: 11, fontWeight: 700, color: C.gold, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16 }}>
              Partner Program
            </div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, margin: '0 0 12px', letterSpacing: '-0.03em', color: '#2A1B06' }}>Three ways to partner with Saguaro</h2>
            <p style={{ fontSize: 16, color: C.dim, maxWidth: 540, margin: '0 auto', lineHeight: 1.6 }}>Refer business, resell under your own brand, or build on our API. Free to join — every tier.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 40, alignItems: 'start' }}>
            {PARTNER_TIERS.map((tier, ti) => (
              <div key={tier.name} style={{
                position: 'relative',
                borderTop: `2px solid ${tier.popular ? 'rgba(201,138,26,0.55)' : 'rgba(176,122,18,0.16)'}`,
              }}>
                {tier.popular && (
                  <div style={{ textAlign: 'center', padding: '12px 0 0', fontSize: 11, fontWeight: 800, color: '#B07A12', letterSpacing: 2, textTransform: 'uppercase' }}>
                    Most Popular
                  </div>
                )}
                <div style={{ padding: tier.popular ? '14px 4px 28px' : '30px 4px 28px' }}>
                  <div style={{ width: 52, height: 52, borderRadius: 13, background: 'linear-gradient(135deg,#E8B84B,#C98A1A)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, boxShadow: '0 6px 16px rgba(232,160,32,0.35)' }}>
                    <TierIcon name={tier.icon} color="#FFFFFF" />
                  </div>
                  <div style={{ fontSize: 19, fontWeight: 800, color: C.text, marginBottom: 4 }}>{tier.name}</div>
                  <div style={{ fontSize: 13, color: C.dim, marginBottom: 22 }}>{tier.tagline}</div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 26 }}>
                    {tier.features.map(f => (
                      <div key={f} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <CheckIcon size={16} color={tier.popular ? C.gold : C.green} />
                        <span style={{ fontSize: 14, color: C.text, lineHeight: 1.45 }}>{f}</span>
                      </div>
                    ))}
                  </div>

                  <a href="mailto:partners@saguarocontrol.net" style={{
                    display: 'block', textAlign: 'center', padding: '13px 0',
                    background: tier.popular ? 'linear-gradient(135deg,#E8B84B,#C98A1A)' : 'transparent',
                    border: tier.popular ? '1px solid transparent' : '1.5px solid #2A1B06',
                    borderRadius: 10, color: tier.popular ? '#2A1B06' : '#2A1B06',
                    fontWeight: 800, fontSize: 14, textDecoration: 'none', letterSpacing: 0.3,
                    boxShadow: tier.popular ? '0 6px 18px rgba(201,138,26,0.28)' : 'none',
                  }}>
                    {tier.cta}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section style={{ padding: '80px 24px', margin: '0 0 96px', background: 'linear-gradient(180deg,#FBF3E4,#F7EAD4)' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#B07A12', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>How it works</div>
              <h2 style={{ fontSize: 24, fontWeight: 900, color: '#2A1B06', margin: 0 }}>From application to recurring revenue</h2>
              <p style={{ fontSize: 14, color: C.dim, margin: '8px 0 0' }}>A straightforward path. Most partners are live within a week.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 36 }}>
              {STEPS.map((s) => (
                <div key={s.step} style={{ borderTop: '1px solid rgba(176,122,18,0.16)', paddingTop: 24 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#E8B84B,#C98A1A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: '#FFFFFF', marginBottom: 14, boxShadow: '0 6px 16px rgba(232,160,32,0.35)' }}>
                    {s.step}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>{s.title}</div>
                  <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.6 }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Become a partner CTA banner */}
        <section style={{ padding: '0 24px 96px', maxWidth: 900, margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: 48, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#B07A12', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>Become a Partner</div>
              <h2 style={{ fontSize: 28, fontWeight: 900, margin: '0 0 12px', lineHeight: 1.2, color: '#2A1B06', letterSpacing: '-0.03em' }}>Build a business on the construction platform GCs love</h2>
              <p style={{ fontSize: 15, color: C.dim, margin: '0 0 24px', lineHeight: 1.65 }}>
                Whether you serve general contractors as a consultant, run a software company, or want to refer the firms in your network, there is a tier for you. Free migration for every customer you bring. Recurring revenue for you.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['Free to join — no setup fees', 'Wholesale & white-label options', 'Dedicated partner success manager', 'Co-marketing & lead sharing'].map(item => (
                  <div key={item} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <CheckIcon size={15} color={C.gold} />
                    <span style={{ fontSize: 14, color: C.text }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', minWidth: 220 }}>
              <div style={{ fontSize: 64, fontWeight: 900, lineHeight: 1, background: 'linear-gradient(135deg,#D89A1E,#A86A0C)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>20%</div>
              <div style={{ fontSize: 14, color: C.dim, textAlign: 'center' }}>Recurring commission<br />for 12 months</div>
              <a href="mailto:partners@saguarocontrol.net" style={{ padding: '14px 28px', background: `linear-gradient(135deg, #E8B84B, #C98A1A)`, borderRadius: 10, color: '#2A1B06', fontWeight: 800, fontSize: 14, textDecoration: 'none', textAlign: 'center', boxShadow: '0 6px 18px rgba(201,138,26,0.28)' }}>
                Apply to Partner
              </a>
              <a href="/signup" style={{ fontSize: 13, color: C.gold, textDecoration: 'none', fontWeight: 600 }}>Or start a free trial first →</a>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section style={{ padding: '0 24px 96px', maxWidth: 760, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ display: 'inline-block', padding: '5px 14px', background: 'rgba(200,136,28,0.10)', border: `1px solid rgba(200,136,28,0.25)`, borderRadius: 999, fontSize: 11, fontWeight: 700, color: C.gold, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16 }}>FAQ</div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, margin: 0, letterSpacing: '-0.03em', color: '#2A1B06' }}>Partner program questions</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {FAQS.map((faq, i) => (
              <div key={i} style={{ borderTop: '1px solid rgba(176,122,18,0.16)' }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ width: '100%', textAlign: 'left', padding: '22px 0', background: 'none', border: 'none', color: '#2A1B06', fontSize: 16, fontWeight: 600, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, lineHeight: 1.4, fontFamily: C.font }}>
                  <span>{faq.q}</span>
                  <span style={{ flexShrink: 0, width: 28, height: 28, background: 'linear-gradient(135deg,#E8B84B,#C98A1A)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontSize: 18, fontWeight: 300 }}>
                    {openFaq === i ? '−' : '+'}
                  </span>
                </button>
                {openFaq === i && (
                  <div style={{ padding: '0 0 22px', fontSize: 15, color: '#6B5B43', lineHeight: 1.75, maxWidth: 660 }}>{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section style={{ position: 'relative', overflow: 'hidden', padding: '96px 24px', background: 'radial-gradient(ellipse at 50% 0%, #251608, #0E0B08)', textAlign: 'center' }}>
          <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%,-50%)', width: 900, height: 500, background: 'radial-gradient(ellipse, rgba(232,168,60,0.20) 0%, transparent 68%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 1, maxWidth: 640, margin: '0 auto' }}>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900, margin: '0 0 16px', lineHeight: 1.15, letterSpacing: '-0.03em', color: '#F5E9D6' }}>
              Let&apos;s build{' '}
              <span style={{ background: `linear-gradient(135deg, #E8B84B, #C98A1A)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>something together.</span>
            </h2>
            <p style={{ fontSize: 17, color: '#C9B79A', margin: '0 0 36px', lineHeight: 1.6 }}>
              Connect your stack on a free trial, or apply to the partner program and grow with the AI-powered construction platform.
            </p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 40 }}>
              <a href="/signup" style={{ display: 'inline-block', padding: '15px 36px', background: `linear-gradient(135deg, #E8B84B, #C98A1A)`, borderRadius: 14, color: '#2A1B06', fontWeight: 800, fontSize: 16, textDecoration: 'none', boxShadow: '0 6px 30px rgba(232,160,32,0.55)' }}>
                Start Free Trial — No CC Required
              </a>
              <a href="mailto:partners@saguarocontrol.net" style={{ display: 'inline-block', padding: '15px 36px', background: 'rgba(255,255,255,0.06)', border: `1.5px solid rgba(245,233,214,0.35)`, borderRadius: 14, color: '#F5E9D6', fontWeight: 700, fontSize: 16, textDecoration: 'none' }}>
                Contact the Partner Team
              </a>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              {['Free to join', 'Recurring commission', 'White-label ready', 'Open REST API', 'Free customer migration'].map(pill => (
                <div key={pill} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'rgba(52,199,89,0.10)', border: `1px solid rgba(52,199,89,0.25)`, borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#34C759' }}>
                  <CheckIcon size={12} color={C.green} />
                  {pill}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer style={{ borderTop: '1px solid #F0E7D6', padding: '48px 32px', background: '#FBF8F2' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 32 }}>
            <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
              <img src="/logo-horizontal.png" alt="Saguaro CRM" style={{ height: 30, width: 'auto', objectFit: 'contain' }} />
            </a>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
              {[
                { label: 'Home', href: '/' }, { label: 'Features', href: '/features' },
                { label: 'Pricing', href: '/pricing' }, { label: 'Partners', href: '/partners' },
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
