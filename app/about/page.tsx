import React from 'react';

const C = {
  dark: '#F2F2F7',
  gold: '#C8881C',
  goldBright: '#E8A020',
  text: '#1C1C1E',
  dim: '#6E6E73',
  border: '#E7E5E1',
  raised: '#FAFAF8',
  raisedAlt: '#FAFAF8',
  green: '#34C759',
  blue: '#6366F1',
  font: "'Inter',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
};

const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Features', href: '/features' },
  { label: 'Field App', href: '/get-the-app' },
  { label: 'Compare', href: '/compare' },
  { label: 'Switch from Procore', href: '/switch-from-procore' },
];

const STATS = [
  { value: '1', label: 'Platform replaces 6+ tools', sub: 'Procore, takeoff software, payroll, spreadsheets, COI trackers, and email threads' },
  { value: '$3,150+', label: 'Saved per month vs Procore', sub: 'Flat pricing, unlimited users, no per-seat or per-module upcharges' },
  { value: '50', label: 'States covered for compliance', sub: 'Lien waivers, preliminary notices, and prevailing-wage payroll' },
  { value: '1 day', label: 'To migrate and go live', sub: 'We move your projects, contacts, and documents over — free' },
];

const VALUES = [
  {
    title: 'Built for the field, not the boardroom',
    body: 'Construction software has spent a decade getting heavier and more expensive. We went the other way. Saguaro is fast enough for a super to use on a tailgate in 4G, and deep enough for an estimator to run a full takeoff. The job site comes first.',
  },
  {
    title: 'One flat price, your whole team',
    body: 'We will never charge you per seat. PMs, field supers, estimators, accounting, and your owners are all included on one license. Pricing you can predict means software your whole company actually adopts.',
  },
  {
    title: 'AI that does the busywork',
    body: 'Sage, our built-in AI assistant, reads your plans, measures your takeoffs, drafts your RFIs and change orders, and parses certificates of insurance. The goal is not to replace your judgment — it is to delete the hours of manual entry between you and the next bid.',
  },
  {
    title: 'Your data belongs to you',
    body: 'We never sell your data, ever. Export everything in JSON or CSV at any time. Row-level security at the database layer means each company only ever sees its own projects. Trust is the product.',
  },
  {
    title: 'Honest about the market',
    body: 'We publish real competitor pricing on our own site. We tell you what each plan does and does not include. No "call for a quote" games, no surprise renewal hikes. If a tool is not worth the money, you should know.',
  },
  {
    title: 'Ship for contractors, by listening to contractors',
    body: 'Every feature in Saguaro started as a frustration a real general contractor told us about — a lien deadline missed, a pay app rejected over formatting, a takeoff that took all weekend. We build for that person.',
  },
];

const CAPABILITIES = [
  { name: 'AI Takeoff', desc: 'Upload a plan set and Sage measures linear feet, square footage, and counts — pages turned into quantities in minutes, not weekends.' },
  { name: 'Sage AI Assistant', desc: 'A construction-trained assistant that drafts RFIs, change orders, scopes, and emails, and answers questions about your own projects.' },
  { name: 'Bid Intelligence', desc: 'Build bid packages, generate bid jackets, invite subs, and level proposals side by side — all inside one workspace.' },
  { name: 'Pay Applications', desc: 'AIA-style G702/G703 pay apps with schedule of values, retainage, and continuation sheets that owners actually approve.' },
  { name: 'RFIs & Change Orders', desc: 'Autopilot RFI and change-order workflows that route, track, and log every response so nothing slips through the cracks.' },
  { name: 'Compliance Suite', desc: 'Lien waivers for all 50 states, preliminary notices, WH-347 certified payroll, ACORD 25 insurance tracking, and the OSHA 300 log.' },
  { name: 'Owner & Sub Portals', desc: 'Give owners a clean view of progress and approvals, and give subs a portal to submit pay apps, waivers, and documents.' },
  { name: 'Saguaro Field App', desc: 'A native iOS field app that works offline and keeps the office and the crew in sync — free from the App Store for your whole team.' },
];

function CheckIcon({ size = 16, color = C.green }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
      <circle cx="8" cy="8" r="8" fill={`${color}22`} />
      <path d="M4.5 8l2.5 2.5 4-5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function AboutPage() {
  return (
    <div style={{ minHeight: '100vh', background: C.dark, color: C.text, fontFamily: C.font }}>

      {/* Nav */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
        height: 64, background: 'rgba(255,255,255,0.85)',
        borderBottom: `1px solid ${C.border}`,
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'center', padding: '0 32px', gap: 0,
      }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0, marginRight: 40 }}>
          <img src="/logo-horizontal.png" alt="Saguaro CRM" style={{ height: 34, width: 'auto', objectFit: 'contain' }} />
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
          {NAV_LINKS.map(link => (
            <a key={link.label} href={link.href} style={{ padding: '6px 12px', borderRadius: 6, color: C.dim, fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>
              {link.label}
            </a>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <a href="/login" style={{ padding: '8px 18px', background: 'rgba(200,136,28,0.10)', border: `1px solid rgba(200,136,28,0.25)`, borderRadius: 10, color: C.gold, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>Log In</a>
          <a href="/signup" style={{ padding: '8px 18px', background: 'linear-gradient(135deg,#F5C645,#E8A020)', borderRadius: 10, color: '#1A1400', fontSize: 13, fontWeight: 800, textDecoration: 'none' }}>Free Trial</a>
        </div>
      </nav>

      <div style={{ paddingTop: 64 }}>

        {/* Hero */}
        <section style={{ textAlign: 'center', padding: '96px 24px 64px', background: 'linear-gradient(180deg,#FAFAF8,#F2F2F7)' }}>
          <div style={{ display: 'inline-block', padding: '6px 16px', background: 'rgba(200,136,28,0.10)', border: `1px solid rgba(200,136,28,0.25)`, borderRadius: 999, fontSize: 12, fontWeight: 700, color: C.gold, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 24 }}>
            About Saguaro Control
          </div>
          <h1 style={{ fontSize: 'clamp(40px, 6vw, 68px)', fontWeight: 900, lineHeight: 1.08, margin: '0 0 20px', letterSpacing: -1.5 }}>
            We are rebuilding construction software{' '}
            <span style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldBright})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              for the people in the dirt.
            </span>
          </h1>
          <p style={{ fontSize: 'clamp(16px, 2vw, 20px)', color: C.dim, maxWidth: 660, margin: '0 auto', lineHeight: 1.65 }}>
            Saguaro Control is the AI-powered construction CRM that replaces Procore and your pile of spreadsheets with one platform — takeoffs, bids, pay apps, RFIs, compliance, and a field app, all built for general contractors.
          </p>
        </section>

        {/* Mission */}
        <section style={{ padding: '0 24px 80px', maxWidth: 900, margin: '0 auto' }}>
          <div style={{ padding: '8px 0' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.gold, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>Our Mission</div>
            <p style={{ fontSize: 'clamp(20px, 3vw, 26px)', fontWeight: 700, lineHeight: 1.45, margin: 0, color: C.text }}>
              Give every general contractor — not just the ENR 400 — the same software firepower the giants have, at a price a regional builder can actually afford, with AI doing the busywork in between.
            </p>
          </div>
        </section>

        {/* Stats */}
        <section style={{ padding: '0 24px 88px', maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 20 }}>
            {STATS.map(stat => (
              <div key={stat.label} style={{ borderTop: '1px solid #E7E5E1', padding: '28px 24px 28px 0' }}>
                <div style={{ fontSize: 38, fontWeight: 900, color: C.gold, lineHeight: 1, marginBottom: 10 }}>{stat.value}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 8 }}>{stat.label}</div>
                <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.6 }}>{stat.sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Our Story */}
        <section style={{ padding: '72px 24px', background: C.raised, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.gold, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16, textAlign: 'center' }}>Our Story</div>
            <h2 style={{ fontSize: 34, fontWeight: 800, margin: '0 0 32px', letterSpacing: '-0.03em', color: '#1C1C1E', textAlign: 'center' }}>
              It started with a missed lien deadline.
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontSize: 16, color: C.dim, lineHeight: 1.8 }}>
              <p style={{ margin: 0 }}>
                Saguaro Control was born out of the daily reality of running general-contracting work in the American Southwest — where the saguaro stands tall through brutal conditions, and where a single missed preliminary-notice or lien deadline can wipe out the margin on an entire project.
              </p>
              <p style={{ margin: 0 }}>
                The contractors we knew were paying Procore prices that ran into thousands of dollars a month, then still exporting everything into spreadsheets to do takeoffs, track certified payroll, and chase down certificates of insurance. The expensive platform did not talk to the cheap tools, and neither one understood the plans. Bids took entire weekends. Pay apps got rejected over formatting. Compliance lived in someone&apos;s head.
              </p>
              <p style={{ margin: 0 }}>
                So we built the platform we wished existed: one place where a plan set becomes a takeoff, a takeoff becomes a bid, a bid becomes a job, and a job runs through pay apps, RFIs, change orders, and 50-state compliance — with an AI assistant named Sage doing the measuring, drafting, and parsing along the way. Flat price. Unlimited users. Live in a day.
              </p>
              <p style={{ margin: 0 }}>
                Today Saguaro Control is that platform, paired with the Saguaro Field app so the office and the crew finally share one source of truth. We are still small, still building, and still listening to the contractors who tell us what is broken on their job sites.
              </p>
            </div>
          </div>
        </section>

        {/* Who it's for */}
        <section style={{ padding: '88px 24px 0', maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ display: 'inline-block', padding: '5px 14px', background: 'rgba(200,136,28,0.10)', border: `1px solid rgba(200,136,28,0.25)`, borderRadius: 999, fontSize: 11, fontWeight: 700, color: C.gold, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16 }}>
              Who It&apos;s For
            </div>
            <h2 style={{ fontSize: 34, fontWeight: 800, margin: '0 0 12px', letterSpacing: '-0.03em', color: '#1C1C1E' }}>Built for general contractors</h2>
            <p style={{ fontSize: 16, color: C.dim, maxWidth: 560, margin: '0 auto', lineHeight: 1.6 }}>
              From a one-truck builder getting off spreadsheets to a regional GC running dozens of jobs — if you bid work, run subs, and bill owners, Saguaro is built for you.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
            {[
              { title: 'Small & growing GCs', body: 'Replace the spreadsheet sprawl with one affordable platform — and look as buttoned-up as firms ten times your size.' },
              { title: 'Established regional builders', body: 'Run estimating, project management, and accounting from a single source of truth instead of five disconnected tools.' },
              { title: 'Teams switching from Procore', body: 'Get the capability without the per-seat, per-module pricing. We migrate you over for free, in about a day.' },
            ].map(item => (
              <div key={item.title} style={{ borderTop: '1px solid #E7E5E1', padding: '28px 24px 28px 0' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 10 }}>{item.title}</div>
                <div style={{ fontSize: 14, color: C.dim, lineHeight: 1.7 }}>{item.body}</div>
              </div>
            ))}
          </div>
        </section>

        {/* What we built */}
        <section style={{ padding: '88px 24px 0', maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ display: 'inline-block', padding: '5px 14px', background: 'rgba(200,136,28,0.10)', border: `1px solid rgba(200,136,28,0.25)`, borderRadius: 999, fontSize: 11, fontWeight: 700, color: C.gold, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16 }}>
              What We Built
            </div>
            <h2 style={{ fontSize: 34, fontWeight: 800, margin: '0 0 12px', letterSpacing: '-0.03em', color: '#1C1C1E' }}>One platform, end to end</h2>
            <p style={{ fontSize: 16, color: C.dim, maxWidth: 560, margin: '0 auto', lineHeight: 1.6 }}>
              The whole construction lifecycle — from a plan set to a paid invoice — in a single, AI-powered system.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            {CAPABILITIES.map(cap => (
              <div key={cap.name} style={{ borderTop: '1px solid #E7E5E1', padding: '28px 24px 28px 0' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <CheckIcon size={18} color={C.gold} />
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>{cap.name}</div>
                    <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.65 }}>{cap.desc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Values */}
        <section style={{ padding: '88px 24px 0', maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ display: 'inline-block', padding: '5px 14px', background: 'rgba(52,199,89,0.10)', border: `1px solid rgba(52,199,89,0.25)`, borderRadius: 999, fontSize: 11, fontWeight: 700, color: C.green, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16 }}>
              Why We Build This Way
            </div>
            <h2 style={{ fontSize: 34, fontWeight: 800, margin: '0 0 12px', letterSpacing: '-0.03em', color: '#1C1C1E' }}>What we stand for</h2>
            <p style={{ fontSize: 16, color: C.dim, maxWidth: 560, margin: '0 auto', lineHeight: 1.6 }}>
              Six principles that decide what we build, how we price it, and who we answer to.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
            {VALUES.map((v, i) => (
              <div key={v.title} style={{ borderTop: '1px solid #E7E5E1', padding: '28px 26px 28px 0' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.gold, marginBottom: 10 }}>{String(i + 1).padStart(2, '0')}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 10, lineHeight: 1.3 }}>{v.title}</div>
                <div style={{ fontSize: 14, color: C.dim, lineHeight: 1.7 }}>{v.body}</div>
              </div>
            ))}
          </div>
        </section>

        {/* The name */}
        <section style={{ padding: '88px 24px 0', maxWidth: 760, margin: '0 auto' }}>
          <div style={{ borderTop: '1px solid #E7E5E1', padding: '40px 0 0', textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.gold, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>Why &quot;Saguaro&quot;</div>
            <p style={{ fontSize: 17, color: C.text, lineHeight: 1.7, margin: 0, fontWeight: 500 }}>
              The saguaro grows slow, stands tall, and survives conditions that kill almost everything around it. It is the icon of building in the desert Southwest — patient, resilient, and unmistakable on the skyline. That is the kind of company, and the kind of software, we set out to build.
            </p>
          </div>
        </section>

        {/* Final CTA */}
        <section style={{ marginTop: 96, padding: '96px 24px', borderTop: '1px solid #E7E5E1', textAlign: 'center' }}>
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900, margin: '0 0 16px', lineHeight: 1.15, letterSpacing: -0.8 }}>
              Come build with us{' '}
              <span style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldBright})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>on Saguaro.</span>
            </h2>
            <p style={{ fontSize: 17, color: C.dim, margin: '0 0 36px', lineHeight: 1.6 }}>
              30-day free trial. Free migration from Procore, Buildertrend, or spreadsheets. No credit card, no per-seat fees, your whole team on one flat rate.
            </p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 40 }}>
              <a href="/signup" style={{ display: 'inline-block', padding: '15px 36px', background: 'linear-gradient(135deg,#F5C645,#E8A020)', borderRadius: 10, color: '#1A1400', fontWeight: 800, fontSize: 16, textDecoration: 'none' }}>
                Start Free Trial — No CC Required
              </a>
              <a href="/features" style={{ display: 'inline-block', padding: '15px 36px', background: 'transparent', border: '1.5px solid #1C1C1E', borderRadius: 10, color: '#1C1C1E', fontWeight: 700, fontSize: 16, textDecoration: 'none' }}>
                Explore Features
              </a>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              {['30 days free', 'Free migration', 'Cancel anytime', 'No per-seat fees', 'Unlimited users'].map(pill => (
                <div key={pill} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'rgba(52,199,89,0.10)', border: `1px solid rgba(52,199,89,0.25)`, borderRadius: 20, fontSize: 12, fontWeight: 600, color: C.green }}>
                  <CheckIcon size={12} color={C.green} />
                  {pill}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer style={{ borderTop: `1px solid ${C.border}`, padding: '48px 32px', background: C.raised }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 32 }}>
            <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
              <img src="/logo-horizontal.png" alt="Saguaro CRM" style={{ height: 30, width: 'auto', objectFit: 'contain' }} />
            </a>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
              {[
                { label: 'Home', href: '/' }, { label: 'Features', href: '/features' },
                { label: 'Compare', href: '/compare' }, { label: 'Switch from Procore', href: '/switch-from-procore' },
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
