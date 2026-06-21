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

type Change = { kind: 'New' | 'Improved' | 'Fixed'; text: string };

type Release = {
  version: string;
  date: string;
  tag: string;
  tagColor: string;
  title: string;
  summary: string;
  changes: Change[];
};

const RELEASES: Release[] = [
  {
    version: 'v4.2',
    date: 'June 6, 2026',
    tag: 'Latest',
    tagColor: C.gold,
    title: 'AI Takeoff — full-set blueprint estimating',
    summary:
      'Drop in an entire plan set and Saguaro reads every sheet. The AI Takeoff engine now detects scale automatically, measures linear feet, square footage, and counts, and maps quantities straight into a bid line by line.',
    changes: [
      { kind: 'New', text: 'AI Takeoff reads multi-page PDF plan sets — walls, slabs, openings, and fixture counts in one pass.' },
      { kind: 'New', text: 'Auto scale detection from the title block, with a one-click calibration override per sheet.' },
      { kind: 'New', text: 'Push measured quantities directly into a bid package — no re-keying into a spreadsheet.' },
      { kind: 'Improved', text: 'Takeoff measurements now snap to detected edges for tighter linear and area accuracy.' },
    ],
  },
  {
    version: 'v4.1',
    date: 'May 19, 2026',
    tag: 'AI Assistant',
    tagColor: C.blue,
    title: 'Meet Sage — your AI construction assistant',
    summary:
      'Sage lives inside every project and answers in plain English. Ask it to draft an RFI, summarize a pay app, find the latest COI for a sub, or flag which lien waivers are still outstanding — and it acts on your live project data.',
    changes: [
      { kind: 'New', text: 'Sage AI assistant available on every project — ask questions about budgets, RFIs, subs, and schedule.' },
      { kind: 'New', text: 'One-line prompts draft RFIs, change orders, and submittal cover letters from project context.' },
      { kind: 'New', text: 'Sage surfaces compliance gaps: expiring insurance, missing lien waivers, and unsigned change orders.' },
      { kind: 'Improved', text: 'Document search now understands intent — "show me the structural revisions" returns the right sheets.' },
    ],
  },
  {
    version: 'v4.0',
    date: 'April 28, 2026',
    tag: 'Field App',
    tagColor: C.green,
    title: 'Saguaro Field — the mobile app for the jobsite',
    summary:
      'The field crew finally has a tool built for gloves and sunlight. Saguaro Field puts daily logs, photos, time, and punch lists in everyone\'s pocket — and it keeps working when the cell signal does not.',
    changes: [
      { kind: 'New', text: 'Saguaro Field app for iOS and Android — daily logs, jobsite photos, and punch lists from the field.' },
      { kind: 'New', text: 'Full offline mode — capture logs and photos with no signal and sync automatically when you reconnect.' },
      { kind: 'New', text: 'Photos geotag and timestamp to the right project and cost code on capture.' },
      { kind: 'Improved', text: 'Field updates flow into the office dashboard in real time — no end-of-day data entry.' },
    ],
  },
  {
    version: 'v3.8',
    date: 'April 7, 2026',
    tag: 'Pay Apps',
    tagColor: C.gold,
    title: 'Pay-app approvals & AIA G702/G703 automation',
    summary:
      'Progress billing without the spreadsheet gymnastics. Build AIA G702/G703 pay applications from your schedule of values, route them for approval, and let owners and subs sign off through their own portal.',
    changes: [
      { kind: 'New', text: 'Multi-step pay-app approval workflow — PM, accounting, and owner sign-off with a full audit trail.' },
      { kind: 'New', text: 'Auto-generated AIA G702/G703 from the schedule of values, with stored materials and retainage calculated.' },
      { kind: 'New', text: 'Owner & Sub Portals let outside parties review and approve pay apps without a Saguaro login.' },
      { kind: 'Fixed', text: 'Retainage release on the final pay app now reconciles correctly against prior billings.' },
    ],
  },
  {
    version: 'v3.5',
    date: 'March 17, 2026',
    tag: 'Compliance',
    tagColor: C.blue,
    title: 'Lien waivers & certified payroll, all 50 states',
    summary:
      'Stay protected and prevailing-wage compliant without leaving the platform. Generate conditional and unconditional lien waivers with state-specific statutory language, and produce WH-347 certified payroll validated against current Davis-Bacon rates.',
    changes: [
      { kind: 'New', text: 'Lien waiver generator covering all 50 states, with statutory language for AZ, CA, TX, NV, FL, and more.' },
      { kind: 'New', text: 'WH-347 certified payroll generator with DOL Davis-Bacon prevailing-wage validation by trade and county.' },
      { kind: 'Improved', text: 'ACORD 25 insurance tracker now parses uploaded COIs and flags coverage that lapses before substantial completion.' },
      { kind: 'Fixed', text: 'Preliminary notice deadlines now account for the date-first-furnished rules in AZ, CA, and TX.' },
    ],
  },
];

function KindBadge({ kind }: { kind: Change['kind'] }) {
  const map = {
    New: { color: C.gold, bg: 'rgba(176,122,18,0.12)', border: 'rgba(176,122,18,0.30)' },
    Improved: { color: C.blue, bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.30)' },
    Fixed: { color: C.green, bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.30)' },
  }[kind];
  return (
    <span
      style={{
        flexShrink: 0,
        marginTop: 1,
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        color: map.color,
        background: map.bg,
        border: `1px solid ${map.border}`,
        borderRadius: 6,
        padding: '2px 8px',
        width: 70,
        textAlign: 'center',
      }}
    >
      {kind}
    </span>
  );
}

export default function ChangelogPage() {
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
          <a href="/login" style={{ padding: '8px 18px', background: 'rgba(176,122,18,0.10)', border: `1px solid rgba(176,122,18,0.25)`, borderRadius: 10, color: C.gold, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>Log In</a>
          <a href="/signup" style={{ padding: '8px 18px', background: 'linear-gradient(135deg,#E8B84B,#C98A1A)', borderRadius: 10, color: '#2A1B06', fontSize: 13, fontWeight: 700, textDecoration: 'none', boxShadow: '0 6px 18px rgba(201,138,26,0.28)' }}>Free Trial</a>
        </div>
      </nav>

      <div style={{ paddingTop: 64 }}>

        {/* Hero */}
        <section style={{ position: 'relative', textAlign: 'center', padding: '88px 24px 56px', background: 'linear-gradient(160deg, #FFFBF2, #FDF3E2, #FBEAD2)' }}>
          <div style={{ background: 'radial-gradient(circle at 80% 0%, rgba(216,154,30,0.12), transparent 60%)', position: 'absolute', inset: 0, pointerEvents: 'none' }} />
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', background: 'rgba(176,122,18,0.10)', border: `1px solid rgba(176,122,18,0.25)`, borderRadius: 20, fontSize: 12, fontWeight: 700, color: C.eyebrow, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 24 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.gold, display: 'inline-block' }} />
            Product Changelog
          </div>
          <h1 style={{ fontSize: 'clamp(40px, 6vw, 64px)', fontWeight: 900, lineHeight: 1.08, margin: '0 0 20px', letterSpacing: -1.5 }}>
            What&apos;s new in{' '}
            <span style={{ background: `linear-gradient(135deg,#D89A1E,#A86A0C)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Saguaro
            </span>
          </h1>
          <p style={{ fontSize: 'clamp(16px, 2vw, 20px)', color: C.dim, maxWidth: 580, margin: '0 auto', lineHeight: 1.65 }}>
            Every release that ships to your account — AI takeoffs, the Sage assistant, the field app, pay-app approvals, and compliance. Built for general contractors, shipped continuously.
          </p>
        </section>

        {/* Timeline */}
        <section style={{ padding: '0 24px 64px', maxWidth: 860, margin: '0 auto' }}>
          <div style={{ position: 'relative' }}>
            {/* Vertical rail */}
            <div style={{ position: 'absolute', left: 7, top: 8, bottom: 8, width: 2, background: `linear-gradient(180deg, ${C.gold} 0%, ${C.border} 60%, transparent 100%)` }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              {RELEASES.map((rel, i) => (
                <div key={rel.version} style={{ position: 'relative', paddingLeft: 40 }}>
                  {/* Node */}
                  <div style={{
                    position: 'absolute', left: 0, top: 6,
                    width: 16, height: 16, borderRadius: '50%',
                    background: i === 0 ? C.gold : '#F3E6CE',
                    border: `2px solid ${i === 0 ? C.goldBright : C.border}`,
                    boxShadow: i === 0 ? '0 0 0 4px rgba(201,138,26,0.18)' : 'none',
                  }} />

                  <div style={{
                    borderBottom: i === 0 ? '1px solid rgba(176,122,18,0.30)' : `1px solid ${C.border}`,
                  }}>
                    <div style={{ padding: '26px 30px 28px' }}>
                      {/* Meta row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{rel.version}</span>
                        <span style={{ width: 3, height: 3, borderRadius: '50%', background: C.dim, display: 'inline-block' }} />
                        <span style={{ fontSize: 13, color: C.dim }}>{rel.date}</span>
                        <span style={{
                          marginLeft: 'auto',
                          fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase',
                          color: rel.tagColor,
                          background: `${rel.tagColor}1F`,
                          border: `1px solid ${rel.tagColor}4D`,
                          borderRadius: 999, padding: '3px 10px',
                        }}>
                          {rel.tag}
                        </span>
                      </div>

                      <h2 style={{ fontSize: 'clamp(20px, 3vw, 26px)', fontWeight: 800, margin: '0 0 10px', lineHeight: 1.2, letterSpacing: -0.4 }}>
                        {rel.title}
                      </h2>
                      <p style={{ fontSize: 15, color: C.dim, lineHeight: 1.65, margin: '0 0 22px' }}>
                        {rel.summary}
                      </p>

                      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {rel.changes.map((ch, j) => (
                          <div key={j} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                            <KindBadge kind={ch.kind} />
                            <span style={{ fontSize: 14, color: C.text, lineHeight: 1.55 }}>{ch.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Older note */}
          <div style={{ textAlign: 'center', marginTop: 36, paddingLeft: 40 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.dim }}>
              <span style={{ width: 24, height: 1, background: C.border, display: 'inline-block' }} />
              You&apos;re all caught up — earlier releases archived
              <span style={{ width: 24, height: 1, background: C.border, display: 'inline-block' }} />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section style={{ padding: '80px 24px 96px', background: 'radial-gradient(ellipse at 50% 0%, #251608, #0E0B08)', textAlign: 'center' }}>
          <div style={{ maxWidth: 620, margin: '0 auto' }}>
            <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 900, margin: '0 0 16px', lineHeight: 1.15, letterSpacing: -0.8, color: '#F5E9D6' }}>
              Get every new feature{' '}
              <span style={{ background: `linear-gradient(135deg,#D89A1E,#A86A0C)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>the day it ships</span>
            </h2>
            <p style={{ fontSize: 17, color: '#C9B79A', margin: '0 0 32px', lineHeight: 1.6 }}>
              AI takeoffs, the Sage assistant, the field app, and pay-app approvals are included on every plan — and updates land automatically. No upgrades to buy, no installs to run.
            </p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 36 }}>
              <a href="/signup" style={{ display: 'inline-block', padding: '15px 36px', background: 'linear-gradient(135deg,#E8B84B,#C98A1A)', borderRadius: 10, color: '#2A1B06', fontWeight: 700, fontSize: 16, textDecoration: 'none', boxShadow: '0 6px 18px rgba(201,138,26,0.28)' }}>
                Start Free Trial — No Credit Card
              </a>
              <a href="/features" style={{ display: 'inline-block', padding: '15px 36px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(245,233,214,0.25)', borderRadius: 10, color: '#F5E9D6', fontWeight: 700, fontSize: 16, textDecoration: 'none' }}>
                Explore Features
              </a>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              {['30 days free', 'Unlimited users', 'Free migration', 'Cancel anytime'].map(pill => (
                <div key={pill} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.30)', borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#5FD08C' }}>
                  {pill}
                </div>
              ))}
            </div>
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
                { label: 'Pricing', href: '/pricing' }, { label: 'Changelog', href: '/changelog' },
                { label: 'Field App', href: '/get-the-app' }, { label: 'Security', href: '/security' },
                { label: 'Privacy', href: '/privacy' }, { label: 'Terms', href: '/terms' },
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
