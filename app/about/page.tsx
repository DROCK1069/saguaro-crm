import React from 'react';
import Link from 'next/link';

const C = {
  dark: '#0B0B0F',
  gold: '#F59E0B',
  goldBright: '#FBBF24',
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
  { label: 'Field App', href: '/get-the-app' },
  { label: 'Compare', href: '/compare' },
  { label: 'Switch from Procore', href: '/switch-from-procore' },
];

const POSITIONING = 'Construction Management · Project Controls · National Rollout Specialists';
const TAGLINE = 'Control Every Project. Deliver Every Promise.';

const STATS = [
  { value: 'TI + Rollouts', label: 'Our specialty', sub: 'Commercial tenant improvement projects and multi-site franchise rollouts' },
  { value: '1', label: 'Single point of accountability', sub: 'We coordinate architects, engineers, GCs, vendors, landlords, and franchise stakeholders for the owner' },
  { value: 'Real-time', label: 'Reporting & dashboards', sub: 'Schedules, cost reports, and KPIs that drive decisions — not surprises' },
  { value: '5', label: 'Delivery pillars', sub: 'Plan, communicate, control, execute, improve — applied to every project' },
];

const VALUES = [
  { title: 'Accountability', body: 'We take ownership of every project and every commitment.' },
  { title: 'Transparency', body: 'Clients receive clear, timely, and accurate information to support informed decisions.' },
  { title: 'Precision', body: 'Every decision is based on data, planning, and measurable performance.' },
  { title: 'Consistency', body: 'Every project follows the same proven process, regardless of location or contractor.' },
  { title: 'Collaboration', body: 'We build strong partnerships with owners, design teams, contractors, and vendors.' },
  { title: 'Continuous Improvement', body: 'We refine our systems using lessons learned from every completed project.' },
];

const SERVICES = [
  { name: 'Construction Management', desc: 'Comprehensive oversight from lease execution through grand opening.' },
  { name: 'Project Controls', desc: 'The discipline that keeps schedule and budget under control:', bullets: ['Schedule development', 'Critical path analysis', 'Budget forecasting', 'Cost management', 'Risk management', 'Change management'] },
  { name: "Owner's Representation", desc: "We act as an extension of the owner's team, coordinating consultants, contractors, and vendors while protecting the client's interests." },
  { name: 'Multi-Site Program Management', desc: 'Planning and executing simultaneous rollouts with standardized reporting, procurement, and quality assurance.' },
  { name: 'Due Diligence', desc: 'Know what you are buying before you build:', bullets: ['Site evaluations', 'Constructability reviews', 'Budget validation', 'Feasibility assessments'] },
  { name: 'Project Recovery', desc: 'When projects fall behind schedule or over budget, we develop recovery plans, identify root causes, and implement corrective actions.' },
];

const PILLARS = [
  { title: 'Plan with Intent', body: 'Define scope, schedule, budget, and risk before construction begins.' },
  { title: 'Communicate with Discipline', body: 'Maintain structured, documented communication so every stakeholder has the information they need.' },
  { title: 'Control Through Data', body: 'Use dashboards, schedules, cost reports, and KPIs to guide decisions.' },
  { title: 'Execute with Consistency', body: 'Apply standardized procedures across every project to ensure reliable outcomes.' },
  { title: 'Improve Continuously', body: 'Capture lessons learned and incorporate them into future projects.' },
];

const PLATFORM = [
  { name: 'Command Center', desc: 'Every project on one screen, triaged worst-first — so a remote operator knows exactly where to spend attention today.' },
  { name: 'Project Controls', desc: 'Long-lead tracking, a portfolio risk register, milestone-variance against baseline, and live budget/schedule KPIs.' },
  { name: 'Multi-Site Program Management', desc: 'Standardized templates, procurement, and reporting so every location runs the same proven process.' },
  { name: 'Owner & Stakeholder Portals', desc: 'A single, transparent source of truth for owners, design teams, contractors, landlords, and franchise partners.' },
  { name: 'Field Execution', desc: 'The Saguaro Field app keeps the office and the crew in sync — daily logs, RFIs, photos, and inspections from any site.' },
  { name: 'Compliance & Closeout', desc: 'Documented from lease execution through grand opening: pay apps, lien waivers, insurance, and closeout in one system.' },
];

function CheckIcon({ size = 16, color = C.green }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
      <circle cx="8" cy="8" r="8" fill={`${color}22`} />
      <path d="M4.5 8l2.5 2.5 4-5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const Eyebrow = ({ children, color = C.gold, bg = 'rgba(245, 158, 11,0.12)', bd = 'rgba(245, 158, 11,0.25)' }: { children: React.ReactNode; color?: string; bg?: string; bd?: string }) => (
  <div style={{ display: 'inline-block', padding: '5px 14px', background: bg, border: `1px solid ${bd}`, borderRadius: 999, fontSize: 11, fontWeight: 700, color, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16 }}>
    {children}
  </div>
);

export default function AboutPage() {
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
        <Link href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0, marginRight: 40 }}>
          <img src="/logo-full.jpg" alt="Saguaro Control Systems" style={{ height: 36, width: 'auto', mixBlendMode: 'screen', objectFit: 'contain' }} />
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
          {NAV_LINKS.map(link => (
            <a key={link.label} href={link.href} style={{ padding: '6px 12px', borderRadius: 6, color: C.dim, fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>
              {link.label}
            </a>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/login" style={{ padding: '8px 18px', background: 'rgba(245, 158, 11,0.10)', border: `1px solid rgba(245, 158, 11,0.25)`, borderRadius: 10, color: C.gold, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>Log In</Link>
          <Link href="/signup" style={{ padding: '8px 18px', background: `linear-gradient(135deg, ${C.gold}, ${C.goldBright})`, borderRadius: 10, color: '#0B0B0F', fontSize: 13, fontWeight: 800, textDecoration: 'none', boxShadow: `0 0 20px rgba(245, 158, 11,0.25)` }}>Free Trial</Link>
        </div>
      </nav>

      <div style={{ paddingTop: 64 }}>

        {/* Hero */}
        <section style={{ textAlign: 'center', padding: '96px 24px 56px', background: `radial-gradient(ellipse 900px 500px at 50% 0%, rgba(245, 158, 11,0.07) 0%, transparent 70%)` }}>
          <Eyebrow>About Saguaro Control Systems</Eyebrow>
          <h1 style={{ fontSize: 'clamp(40px, 6vw, 68px)', fontWeight: 900, lineHeight: 1.08, margin: '0 0 18px', letterSpacing: -1.5 }}>
            We build the systems that make construction{' '}
            <span style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldBright})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              predictable.
            </span>
          </h1>
          <div style={{ fontSize: 'clamp(12px, 1.6vw, 14px)', fontWeight: 700, color: C.gold, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 22 }}>
            {POSITIONING}
          </div>
          <p style={{ fontSize: 'clamp(16px, 2vw, 20px)', color: C.dim, maxWidth: 720, margin: '0 auto 28px', lineHeight: 1.65 }}>
            A national construction management and project controls firm specializing in commercial tenant improvement (TI) projects and multi-site franchise rollouts — delivering predictable outcomes through disciplined planning, standardized processes, real-time reporting, and proactive risk management.
          </p>
          <div style={{ display: 'inline-block', padding: '12px 28px', background: 'linear-gradient(135deg, rgba(245, 158, 11,0.14), rgba(245, 158, 11,0.04))', border: `1px solid rgba(245, 158, 11,0.35)`, borderRadius: 12, fontSize: 'clamp(16px, 2.2vw, 22px)', fontWeight: 800, color: C.text, letterSpacing: -0.2 }}>
            {TAGLINE}
          </div>
        </section>

        {/* Who We Are */}
        <section style={{ padding: '48px 24px 80px', maxWidth: 820, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <Eyebrow>Who We Are</Eyebrow>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontSize: 17, color: C.dim, lineHeight: 1.8 }}>
            <p style={{ margin: 0 }}>
              Unlike traditional construction firms that react to issues as they arise, we implement systems that identify risks early, improve communication, and keep projects on schedule and within budget. Our role is to provide owners with a <span style={{ color: C.text, fontWeight: 600 }}>single point of accountability</span> while coordinating architects, engineers, general contractors, vendors, landlords, and franchise stakeholders.
            </p>
            <p style={{ margin: 0, fontSize: 20, color: C.text, fontWeight: 600 }}>
              We don&apos;t just manage projects — we build systems that allow organizations to scale confidently across multiple markets.
            </p>
          </div>
        </section>

        {/* Stats */}
        <section style={{ padding: '0 24px 88px', maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 20 }}>
            {STATS.map(stat => (
              <div key={stat.label} style={{ background: C.raisedAlt, border: `1px solid ${C.border}`, borderRadius: 14, padding: '28px 24px', boxShadow: '0 1px 2px rgba(0,0,0,.4)' }}>
                <div style={{ fontSize: 'clamp(22px, 2.4vw, 30px)', fontWeight: 900, color: C.gold, lineHeight: 1.1, marginBottom: 10 }}>{stat.value}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 8 }}>{stat.label}</div>
                <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.6 }}>{stat.sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Mission + Vision */}
        <section style={{ padding: '0 24px 88px', maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
            <div style={{ background: C.raised, border: `1px solid ${C.border}`, borderRadius: 14, padding: '40px 40px', boxShadow: '0 4px 14px rgba(0,0,0,.45)' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.gold, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>Our Mission</div>
              <p style={{ fontSize: 'clamp(18px, 2.4vw, 22px)', fontWeight: 700, lineHeight: 1.5, margin: 0, color: C.text }}>
                To provide owners and franchise organizations with a disciplined, transparent, and scalable construction management platform that delivers consistent project outcomes across every location.
              </p>
            </div>
            <div style={{ background: C.raised, border: `1px solid ${C.border}`, borderRadius: 14, padding: '40px 40px', boxShadow: '0 4px 14px rgba(0,0,0,.45)' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.blue, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>Our Vision</div>
              <p style={{ fontSize: 'clamp(18px, 2.4vw, 22px)', fontWeight: 700, lineHeight: 1.5, margin: 0, color: C.text }}>
                To become the most trusted construction management partner for multi-site commercial rollouts in North America by combining project controls, technology, and exceptional client service into one seamless delivery system.
              </p>
            </div>
          </div>
        </section>

        {/* Core Values */}
        <section style={{ padding: '0 24px 0', maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <Eyebrow color={C.green} bg="rgba(34,197,94,0.08)" bd="rgba(34,197,94,0.2)">Core Values</Eyebrow>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, margin: '0 0 12px', letterSpacing: -0.5 }}>What we stand for</h2>
            <p style={{ fontSize: 16, color: C.dim, maxWidth: 560, margin: '0 auto', lineHeight: 1.6 }}>
              Six principles that govern how we plan, communicate, and deliver on every project.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
            {VALUES.map((v, i) => (
              <div key={v.title} style={{ background: C.raised, border: `1px solid ${C.border}`, borderRadius: 14, padding: '28px 26px', boxShadow: '0 1px 2px rgba(0,0,0,.4)' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.gold, marginBottom: 10 }}>{String(i + 1).padStart(2, '0')}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 10, lineHeight: 1.3 }}>{v.title}</div>
                <div style={{ fontSize: 14, color: C.dim, lineHeight: 1.7 }}>{v.body}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Our Services */}
        <section style={{ padding: '88px 24px 0', maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <Eyebrow>Our Services</Eyebrow>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, margin: '0 0 12px', letterSpacing: -0.5 }}>How we deliver</h2>
            <p style={{ fontSize: 16, color: C.dim, maxWidth: 560, margin: '0 auto', lineHeight: 1.6 }}>
              End-to-end management and controls — from lease execution through grand opening, across every location.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
            {SERVICES.map(svc => (
              <div key={svc.name} style={{ background: C.raised, border: `1px solid ${C.border}`, borderRadius: 14, padding: '26px 26px', boxShadow: '0 1px 2px rgba(0,0,0,.4)' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: svc.bullets ? 12 : 0 }}>
                  <CheckIcon size={18} color={C.gold} />
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 6 }}>{svc.name}</div>
                    <div style={{ fontSize: 14, color: C.dim, lineHeight: 1.65 }}>{svc.desc}</div>
                  </div>
                </div>
                {svc.bullets && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 14px', paddingLeft: 30 }}>
                    {svc.bullets.map(b => (
                      <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: C.text }}>
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: C.gold, flexShrink: 0 }} />{b}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Delivery Philosophy */}
        <section style={{ padding: '88px 24px', marginTop: 88, background: C.raised, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <Eyebrow>Our Delivery Philosophy</Eyebrow>
              <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, margin: '0 0 12px', letterSpacing: -0.5 }}>
                Successful construction is driven by{' '}
                <span style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldBright})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>systems, not personalities.</span>
              </h2>
              <p style={{ fontSize: 16, color: C.dim, maxWidth: 620, margin: '0 auto 44px', lineHeight: 1.6 }}>
                Every project is governed by five pillars — the same five, on every job, in every market.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              {PILLARS.map((p, i) => (
                <div key={p.title} style={{ background: C.raisedAlt, border: `1px solid ${C.border}`, borderRadius: 14, padding: '26px 22px' }}>
                  <div style={{ fontSize: 26, fontWeight: 900, color: C.gold, lineHeight: 1, marginBottom: 12 }}>{String(i + 1).padStart(2, '0')}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 8, lineHeight: 1.3 }}>{p.title}</div>
                  <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.65 }}>{p.body}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* The Platform (firm + platform bridge) */}
        <section style={{ padding: '88px 24px 0', maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <Eyebrow color={C.blue} bg="rgba(99,102,241,0.10)" bd="rgba(99,102,241,0.25)">The Platform</Eyebrow>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, margin: '0 0 12px', letterSpacing: -0.5 }}>Our discipline, built into software</h2>
            <p style={{ fontSize: 16, color: C.dim, maxWidth: 620, margin: '0 auto', lineHeight: 1.6 }}>
              We deliver our services on our own platform — so the plan, the controls, and the reporting live in one seamless system every stakeholder can see.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            {PLATFORM.map(cap => (
              <div key={cap.name} style={{ background: C.raised, border: `1px solid ${C.border}`, borderRadius: 14, padding: '24px 24px', boxShadow: '0 1px 2px rgba(0,0,0,.4)' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <CheckIcon size={18} color={C.blue} />
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>{cap.name}</div>
                    <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.65 }}>{cap.desc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Why "Saguaro" */}
        <section style={{ padding: '88px 24px 0', maxWidth: 760, margin: '0 auto' }}>
          <div style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11,0.10) 0%, rgba(11,11,15,0) 100%)', border: `1px solid rgba(245, 158, 11,0.30)`, borderRadius: 14, padding: '40px 44px', textAlign: 'center', boxShadow: '0 4px 14px rgba(0,0,0,.45)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.gold, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>Why &quot;Saguaro&quot;</div>
            <p style={{ fontSize: 17, color: C.text, lineHeight: 1.7, margin: 0, fontWeight: 500 }}>
              The saguaro grows slow, stands tall, and survives conditions that kill almost everything around it. It is the icon of building in the desert Southwest — patient, resilient, and unmistakable on the skyline. That is the kind of firm, and the kind of control, we set out to build.
            </p>
          </div>
        </section>

        {/* Final CTA */}
        <section style={{ marginTop: 96, padding: '96px 24px', background: `linear-gradient(180deg, transparent 0%, rgba(245, 158, 11,0.05) 50%, transparent 100%)`, borderTop: `1px solid ${C.border}`, textAlign: 'center' }}>
          <div style={{ maxWidth: 660, margin: '0 auto' }}>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900, margin: '0 0 16px', lineHeight: 1.15, letterSpacing: -0.8 }}>
              Control every project.{' '}
              <span style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldBright})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Deliver every promise.</span>
            </h2>
            <p style={{ fontSize: 17, color: C.dim, margin: '0 0 36px', lineHeight: 1.6 }}>
              Whether you are planning a single tenant improvement or a national franchise rollout, we bring the discipline, the controls, and the platform to keep it on schedule and within budget.
            </p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 40 }}>
              <Link href="/contact" style={{ display: 'inline-block', padding: '15px 36px', background: `linear-gradient(135deg, ${C.gold}, ${C.goldBright})`, borderRadius: 10, color: '#0B0B0F', fontWeight: 800, fontSize: 16, textDecoration: 'none', boxShadow: `0 4px 14px rgba(245, 158, 11,0.30)` }}>
                Talk to Our Team
              </Link>
              <Link href="/features" style={{ display: 'inline-block', padding: '15px 36px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontWeight: 700, fontSize: 16, textDecoration: 'none' }}>
                Explore the Platform
              </Link>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              {['Single point of accountability', 'Standardized process', 'Real-time reporting', 'Proactive risk management'].map(pill => (
                <div key={pill} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'rgba(34,197,94,0.07)', border: `1px solid rgba(34,197,94,0.2)`, borderRadius: 20, fontSize: 12, fontWeight: 600, color: C.green }}>
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
            <Link href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
              <img src="/logo-full.jpg" alt="Saguaro Control Systems" style={{ height: 30, width: 'auto', mixBlendMode: 'screen', objectFit: 'contain' }} />
            </Link>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
              {[
                { label: 'Home', href: '/' }, { label: 'Features', href: '/features' },
                { label: 'Compare', href: '/compare' }, { label: 'Switch from Procore', href: '/switch-from-procore' },
                { label: 'Field App', href: '/get-the-app' }, { label: 'Privacy', href: '/privacy' }, { label: 'Terms', href: '/terms' },
              ].map(link => (
                <a key={link.label} href={link.href} style={{ fontSize: 13, color: C.dim, textDecoration: 'none', fontWeight: 500 }}>{link.label}</a>
              ))}
            </div>
            <div style={{ fontSize: 12, color: C.dim, whiteSpace: 'nowrap', textAlign: 'right' }}>
              &copy; {new Date().getFullYear()} Saguaro Control Systems<div style={{ fontSize: 11, marginTop: 2 }}>{TAGLINE}</div>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}
