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
  { label: 'Field App', href: '/get-the-app' },
  { label: 'Compare', href: '/compare' },
  { label: 'Switch from Procore', href: '/switch-from-procore' },
];

const VALUES = [
  {
    title: 'Ship for the field, not the boardroom',
    desc: 'Our users are estimators, project managers, and field supers — people standing in the mud at 6am, not in a procurement committee. Every feature has to earn its place on a phone screen in the sun.',
  },
  {
    title: 'AI that does the work, not the talking',
    desc: 'Sage, our AI assistant, reads blueprints, runs takeoffs, drafts RFIs, and parses COIs. We build AI that removes hours of manual work — not chatbots that summarize what the user already knows.',
  },
  {
    title: 'One flat price, one honest pitch',
    desc: 'We replaced per-seat fees and module upsells with one flat rate and unlimited users. We hold ourselves to the same standard internally: no politics, no hidden agendas, say the real thing.',
  },
  {
    title: 'Small team, real ownership',
    desc: 'You own surfaces end to end — design, code, ship, talk to the GC who uses it. We are deliberately small, so the work you do is visible in the product within days, not quarters.',
  },
];

const PERKS = [
  { title: 'Fully remote', desc: 'Work from anywhere in the US. We are async-first with a few overlap hours for the team.' },
  { title: 'Competitive equity', desc: 'Meaningful early-stage equity for every full-time hire. You build it, you own a piece of it.' },
  { title: 'Health, dental & vision', desc: 'Full medical, dental, and vision coverage for you and your dependents.' },
  { title: 'Real hardware budget', desc: 'A new laptop, the monitors you want, and a stipend for your home office setup.' },
  { title: 'Learning budget', desc: 'Annual budget for courses, books, conferences, and anything that makes you sharper.' },
  { title: 'Flexible PTO', desc: 'Take the time you need. We measure output, not hours in a seat.' },
];

const ROLES = [
  {
    title: 'Senior Full-Stack Engineer',
    team: 'Engineering',
    location: 'Remote (US)',
    type: 'Full-time',
    desc: 'Own product surfaces end to end across our Next.js + Supabase stack — from AI takeoff and the Sage assistant to pay apps, RFIs, and the field PWA. You ship to production daily.',
    tags: ['Next.js', 'TypeScript', 'Supabase', 'Postgres'],
  },
  {
    title: 'AI / ML Engineer — Document Intelligence',
    team: 'Engineering',
    location: 'Remote (US)',
    type: 'Full-time',
    desc: 'Build the models behind AI takeoff, COI/ACORD 25 parsing, and Sage. You will work on blueprint vision, structured extraction from construction PDFs, and LLM pipelines that have to be right the first time.',
    tags: ['Python', 'LLMs', 'Computer Vision', 'PDF parsing'],
  },
  {
    title: 'Product Designer',
    team: 'Design',
    location: 'Remote (US)',
    type: 'Full-time',
    desc: 'Design dense, data-heavy workflows that have to feel simple — pay app schedules of values, lien waiver flows, and a field app used in gloves and sunlight. You will own the design system end to end.',
    tags: ['Figma', 'Design systems', 'Mobile / PWA'],
  },
  {
    title: 'Founding Account Executive',
    team: 'Go-to-Market',
    location: 'Remote (US) · AZ preferred',
    type: 'Full-time',
    desc: 'Sell to GCs switching off Procore, Buildertrend, and spreadsheets. You will own the full cycle — demo, migration story, close — and feed what you learn straight back into the roadmap.',
    tags: ['SaaS sales', 'Construction', 'Full-cycle'],
  },
  {
    title: 'Customer Success Lead',
    team: 'Customer',
    location: 'Remote (US)',
    type: 'Full-time',
    desc: 'Be the human behind our 1-day migration promise. Onboard new GCs, run training sessions, build the playbook, and make sure every customer is live and winning bids within their first week.',
    tags: ['Onboarding', 'Construction', 'Migrations'],
  },
];

const HIRING_STEPS = [
  { step: '1', title: 'Intro call', desc: 'A 30-minute conversation with the founder about your background, what you want, and what we are building.' },
  { step: '2', title: 'Craft conversation', desc: 'A focused working session on a real problem from our domain — no whiteboard trivia, no take-home that eats your weekend.' },
  { step: '3', title: 'Meet the team', desc: 'Talk with the people you would work alongside every day. You interview us as much as we interview you.' },
  { step: '4', title: 'Offer', desc: 'Fast, transparent offer with clear comp and equity. We move in days, not weeks.' },
];

function CheckIcon({ size = 16, color = C.green }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
      <circle cx="8" cy="8" r="8" fill={`${color}22`} />
      <path d="M4.5 8l2.5 2.5 4-5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function CareersPage() {
  // Toggle to false to show the "no open roles" state instead of the roles list.
  const [hasOpenRoles] = useState(true);

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

        {/* Hero */}
        <section style={{ textAlign: 'center', padding: '88px 24px 64px', background: `radial-gradient(ellipse 900px 500px at 50% 0%, rgba(212,160,23,0.07) 0%, transparent 70%)` }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', background: 'rgba(212,160,23,0.10)', border: `1px solid rgba(212,160,23,0.25)`, borderRadius: 20, fontSize: 12, fontWeight: 700, color: C.gold, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 24 }}>
            Careers at Saguaro
          </div>
          <h1 style={{ fontSize: 'clamp(40px, 6vw, 68px)', fontWeight: 900, lineHeight: 1.08, margin: '0 0 20px', letterSpacing: -1.5 }}>
            Build the software{' '}
            <span style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldBright})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              construction runs on.
            </span>
          </h1>
          <p style={{ fontSize: 'clamp(16px, 2vw, 20px)', color: C.dim, maxWidth: 620, margin: '0 auto 36px', lineHeight: 1.65 }}>
            We are a small, remote team building the AI-powered platform that runs takeoffs, bids, pay apps, RFIs, and compliance for general contractors. Real product, real users, real ownership.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="#open-roles" style={{ display: 'inline-block', padding: '14px 32px', background: `linear-gradient(135deg, ${C.gold}, ${C.goldBright})`, borderRadius: 10, color: '#0B0B0F', fontWeight: 800, fontSize: 15, textDecoration: 'none', boxShadow: `0 4px 14px rgba(212,160,23,0.30)` }}>
              See Open Roles
            </a>
            <a href="mailto:careers@saguarocontrol.net" style={{ display: 'inline-block', padding: '14px 32px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
              Email Us Directly
            </a>
          </div>
        </section>

        {/* Culture / Values */}
        <section style={{ padding: '0 24px 96px', maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ display: 'inline-block', padding: '5px 14px', background: 'rgba(212,160,23,0.12)', border: `1px solid rgba(212,160,23,0.25)`, borderRadius: 999, fontSize: 11, fontWeight: 700, color: C.gold, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16 }}>
              How We Work
            </div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, margin: '0 0 12px', letterSpacing: -0.5 }}>What we care about</h2>
            <p style={{ fontSize: 16, color: C.dim, maxWidth: 560, margin: '0 auto', lineHeight: 1.6 }}>
              Saguaro replaces five tools and a stack of paperwork for general contractors. The way we build reflects who we build for.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
            {VALUES.map(v => (
              <div key={v.title} style={{ background: C.raised, border: `1px solid ${C.border}`, borderRadius: 14, padding: '28px 28px', boxShadow: '0 1px 2px rgba(0,0,0,.4)' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 10, lineHeight: 1.3 }}>{v.title}</div>
                <div style={{ fontSize: 14, color: C.dim, lineHeight: 1.7 }}>{v.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Perks */}
        <section style={{ padding: '0 24px 96px', maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ background: C.raised, border: `1px solid ${C.border}`, borderRadius: 16, padding: '44px 40px' }}>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.gold, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Benefits</div>
              <h2 style={{ fontSize: 'clamp(24px, 3vw, 32px)', fontWeight: 900, color: C.text, margin: 0 }}>Taken care of, so you can do your best work</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
              {PERKS.map(p => (
                <div key={p.title} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <CheckIcon size={20} color={C.gold} />
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>{p.title}</div>
                    <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.6 }}>{p.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Open Roles */}
        <section id="open-roles" style={{ padding: '0 24px 96px', maxWidth: 1000, margin: '0 auto', scrollMarginTop: 88 }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ display: 'inline-block', padding: '5px 14px', background: 'rgba(34,197,94,0.08)', border: `1px solid rgba(34,197,94,0.2)`, borderRadius: 20, fontSize: 11, fontWeight: 700, color: C.green, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16 }}>
              Open Roles
            </div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, margin: '0 0 12px', letterSpacing: -0.5 }}>Come build with us</h2>
            <p style={{ fontSize: 16, color: C.dim, maxWidth: 480, margin: '0 auto' }}>
              {hasOpenRoles ? 'All roles are fully remote within the US. Apply by email — a real person reads every one.' : "We're not actively hiring right now, but great people are always worth a conversation."}
            </p>
          </div>

          {hasOpenRoles ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {ROLES.map(role => (
                <div key={role.title} style={{ background: C.raised, border: `1px solid ${C.border}`, borderRadius: 14, padding: '26px 28px', display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap', boxShadow: '0 1px 2px rgba(0,0,0,.4)' }}>
                  <div style={{ flex: 1, minWidth: 280 }}>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.gold, background: 'rgba(212,160,23,0.10)', border: `1px solid rgba(212,160,23,0.25)`, borderRadius: 999, padding: '3px 10px', letterSpacing: 0.5, textTransform: 'uppercase' }}>{role.team}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: C.dim, background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 999, padding: '3px 10px' }}>{role.location}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: C.dim, background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 999, padding: '3px 10px' }}>{role.type}</span>
                    </div>
                    <div style={{ fontSize: 19, fontWeight: 800, color: C.text, marginBottom: 8, lineHeight: 1.3 }}>{role.title}</div>
                    <div style={{ fontSize: 14, color: C.dim, lineHeight: 1.65, marginBottom: 14 }}>{role.desc}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {role.tags.map(tag => (
                        <span key={tag} style={{ fontSize: 11, fontWeight: 600, color: C.dim, background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 9px' }}>{tag}</span>
                      ))}
                    </div>
                  </div>
                  <a
                    href={`mailto:careers@saguarocontrol.net?subject=${encodeURIComponent('Application: ' + role.title)}`}
                    style={{ flexShrink: 0, padding: '11px 24px', background: 'rgba(212,160,23,0.10)', border: `1px solid rgba(212,160,23,0.30)`, borderRadius: 10, color: C.gold, fontWeight: 800, fontSize: 14, textDecoration: 'none', whiteSpace: 'nowrap' }}
                  >
                    Apply →
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ background: C.raised, border: `1px solid ${C.border}`, borderRadius: 16, padding: '56px 40px', textAlign: 'center', maxWidth: 640, margin: '0 auto', boxShadow: '0 4px 14px rgba(0,0,0,.45)' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.text, marginBottom: 12 }}>No open roles right now</div>
              <p style={{ fontSize: 15, color: C.dim, lineHeight: 1.7, margin: '0 0 28px' }}>
                We hire deliberately and we are between openings at the moment. If you are an engineer, designer, or builder who wants to work on AI for construction, send us a note anyway — we keep great people in mind and reach out when a role opens.
              </p>
              <a href="mailto:careers@saguarocontrol.net?subject=Introduction" style={{ display: 'inline-block', padding: '13px 32px', background: `linear-gradient(135deg, ${C.gold}, ${C.goldBright})`, borderRadius: 10, color: '#0B0B0F', fontWeight: 800, fontSize: 15, textDecoration: 'none', boxShadow: `0 4px 14px rgba(212,160,23,0.30)` }}>
                careers@saguarocontrol.net
              </a>
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: 40, fontSize: 14, color: C.dim }}>
            Don't see your role? We're always glad to hear from exceptional people.{' '}
            <a href="mailto:careers@saguarocontrol.net?subject=Introduction" style={{ color: C.gold, textDecoration: 'none', fontWeight: 700 }}>Introduce yourself →</a>
          </div>
        </section>

        {/* Hiring Process */}
        <section style={{ padding: '0 24px 96px', maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ background: C.raised, border: `1px solid ${C.border}`, borderRadius: 16, padding: '44px 40px' }}>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.gold, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>The Process</div>
              <h2 style={{ fontSize: 'clamp(24px, 3vw, 32px)', fontWeight: 900, color: C.text, margin: 0 }}>Hiring, the way it should be</h2>
              <p style={{ fontSize: 14, color: C.dim, margin: '10px auto 0', maxWidth: 520, lineHeight: 1.6 }}>
                No endless loops, no trick questions. Four focused steps, usually wrapped in under two weeks.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 0 }}>
              {HIRING_STEPS.map((s, i, arr) => (
                <div key={s.step} style={{ padding: '0 28px', borderRight: i < arr.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(212,160,23,0.10)', border: '1px solid rgba(212,160,23,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: C.gold, marginBottom: 14 }}>
                    {s.step}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>{s.title}</div>
                  <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.6 }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section style={{ padding: '96px 24px', background: `linear-gradient(180deg, transparent 0%, rgba(212,160,23,0.05) 50%, transparent 100%)`, borderTop: `1px solid ${C.border}`, textAlign: 'center' }}>
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900, margin: '0 0 16px', lineHeight: 1.15, letterSpacing: -0.8 }}>
              Want to see what{' '}
              <span style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldBright})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>you'd be building?</span>
            </h2>
            <p style={{ fontSize: 17, color: C.dim, margin: '0 0 36px', lineHeight: 1.6 }}>
              The best way to understand Saguaro is to use it. Spin up a free account and explore AI takeoff, Sage, pay apps, and the field app firsthand.
            </p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="/signup" style={{ display: 'inline-block', padding: '15px 36px', background: `linear-gradient(135deg, ${C.gold}, ${C.goldBright})`, borderRadius: 10, color: '#0B0B0F', fontWeight: 800, fontSize: 16, textDecoration: 'none', boxShadow: `0 4px 14px rgba(212,160,23,0.30)` }}>
                Try the Product Free
              </a>
              <a href="mailto:careers@saguarocontrol.net" style={{ display: 'inline-block', padding: '15px 36px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontWeight: 700, fontSize: 16, textDecoration: 'none' }}>
                careers@saguarocontrol.net
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
