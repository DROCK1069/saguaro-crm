'use client';
import React, { useState } from 'react';

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
  { label: 'Pricing', href: '/pricing' },
  { label: 'Field App', href: '/get-the-app' },
  { label: 'Compare', href: '/compare' },
];

const SUPPORT_EMAIL = 'support@saguarocontrol.net';
const SALES_EMAIL = 'sales@saguarocontrol.net';
const SECURITY_EMAIL = 'security@saguarocontrol.net';

const CHANNELS = [
  {
    icon: '💬',
    title: 'Sales & Demos',
    desc: 'Want a walkthrough of AI takeoffs, Sage AI, or the field app? Talk to a real estimator who uses Saguaro every day.',
    line: SALES_EMAIL,
    href: `mailto:${SALES_EMAIL}`,
    accent: C.gold,
  },
  {
    icon: '🛟',
    title: 'Customer Support',
    desc: 'Already on Saguaro? Reach our support team for help with pay apps, lien waivers, RFIs, or anything in your account.',
    line: SUPPORT_EMAIL,
    href: `mailto:${SUPPORT_EMAIL}`,
    accent: C.green,
  },
  {
    icon: '🔐',
    title: 'Security & Compliance',
    desc: 'Vendor security reviews, SOC 2 questionnaires, DPAs, or responsible disclosure of a vulnerability.',
    line: SECURITY_EMAIL,
    href: `mailto:${SECURITY_EMAIL}`,
    accent: C.blue,
  },
];

const REASONS = [
  { label: 'I want a product demo', value: 'Demo request' },
  { label: 'Pricing & plans', value: 'Pricing question' },
  { label: 'Migrating from Procore / Buildertrend', value: 'Migration help' },
  { label: 'Technical support', value: 'Support request' },
  { label: 'Partnership / reseller / white label', value: 'Partnership' },
  { label: 'Something else', value: 'General inquiry' },
];

const FAQS = [
  {
    q: 'How fast will I hear back?',
    a: 'Sales and demo requests get a reply within one business hour during US working hours. Support tickets are answered within 4 hours on Professional and Enterprise plans, 48 hours on Starter.',
  },
  {
    q: 'Do you offer live demos?',
    a: 'Yes. Pick "I want a product demo" below and we will schedule a 30-minute screen share where we run an AI takeoff on your real plans, generate a G702/G703 pay app, and answer every question.',
  },
  {
    q: 'I am switching from another platform. Can you help?',
    a: 'Absolutely — free migration is included on every plan. We move your projects, contacts, documents, bids, and history from Procore, Buildertrend, CoConstruct, or spreadsheets in about one business day.',
  },
];

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  background: '#FFFFFF',
  border: '1px solid #E7E5E1',
  borderRadius: 10,
  color: '#1C1C1E',
  fontSize: 14,
  fontFamily: C.font,
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 700,
  color: C.dim,
  letterSpacing: 0.5,
  textTransform: 'uppercase',
  marginBottom: 7,
};

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', company: '', reason: REASONS[0].value, message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [focused, setFocused] = useState<string | null>(null);

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  function buildMailto() {
    const subject = `[${form.reason}] from ${form.name || 'Saguaro website'}`;
    const body = [
      `Name: ${form.name}`,
      `Email: ${form.email}`,
      `Company: ${form.company}`,
      `Reason: ${form.reason}`,
      '',
      form.message,
    ].join('\n');
    return `mailto:${SALES_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'sending') return;
    setStatus('sending');

    // Attempt a sensible API endpoint first; gracefully fall back to a mailto draft.
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setStatus('sent');
        return;
      }
      throw new Error(`Bad status ${res.status}`);
    } catch {
      // No contact API deployed (or it errored) — open the user's mail client as a fallback.
      if (typeof window !== 'undefined') {
        window.location.href = buildMailto();
      }
      setStatus('sent');
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.dark, color: C.text, fontFamily: C.font }}>

      {/* Nav */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
        height: 64, background: 'rgba(255,255,255,0.85)',
        borderBottom: '1px solid #E7E5E1',
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
          <a href="/signup" style={{ padding: '8px 18px', background: `linear-gradient(135deg, ${C.gold}, ${C.goldBright})`, borderRadius: 10, color: '#1A1400', fontSize: 13, fontWeight: 800, textDecoration: 'none' }}>Free Trial</a>
        </div>
      </nav>

      <div style={{ paddingTop: 64 }}>

        {/* Hero */}
        <section style={{ textAlign: 'center', padding: '88px 24px 56px', background: C.dark }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', background: 'rgba(52,199,89,0.10)', border: `1px solid rgba(52,199,89,0.25)`, borderRadius: 20, fontSize: 12, fontWeight: 700, color: C.green, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 24 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.green, display: 'inline-block' }} />
            Real humans · 1-hour sales response
          </div>
          <h1 style={{ fontSize: 'clamp(40px, 6vw, 64px)', fontWeight: 900, lineHeight: 1.08, margin: '0 0 20px', letterSpacing: -1.5 }}>
            Talk to the{' '}
            <span style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldBright})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Saguaro team.
            </span>
          </h1>
          <p style={{ fontSize: 'clamp(16px, 2vw, 20px)', color: C.dim, maxWidth: 600, margin: '0 auto', lineHeight: 1.65 }}>
            Questions about AI takeoffs, the Sage AI assistant, pay apps, or migrating off Procore? Send a note and a real person who knows construction will get back to you.
          </p>
        </section>

        {/* Channels */}
        <section style={{ padding: '0 24px 64px', maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            {CHANNELS.map(ch => (
              <a key={ch.title} href={ch.href} style={{ textDecoration: 'none', borderTop: '1px solid #E7E5E1', padding: '28px 24px 28px 0', display: 'block', transition: 'border-color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.borderTopColor = 'rgba(200,136,28,0.35)')}
                onMouseLeave={e => (e.currentTarget.style.borderTopColor = '#E7E5E1')}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(200,136,28,0.08)', border: '1px solid #E7E5E1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 16 }}>
                  {ch.icon}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', marginBottom: 8 }}>{ch.title}</div>
                <div style={{ fontSize: 13, color: '#6E6E73', lineHeight: 1.6, marginBottom: 16 }}>{ch.desc}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: ch.accent }}>{ch.line} &rarr;</div>
              </a>
            ))}
          </div>
        </section>

        {/* Form + side info */}
        <section style={{ padding: '0 24px 96px', maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 32, alignItems: 'start' }}>

            {/* Form */}
            <div>
              {status === 'sent' ? (
                <div style={{ textAlign: 'center', padding: '32px 8px' }}>
                  <div style={{ width: 64, height: 64, margin: '0 auto 20px', borderRadius: '50%', background: 'rgba(52,199,89,0.12)', border: `1px solid rgba(52,199,89,0.30)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                      <path d="M5 12.5l4.5 4.5L19 7" stroke={C.green} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <h2 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 10px', color: '#1C1C1E' }}>Message on its way</h2>
                  <p style={{ fontSize: 15, color: '#6E6E73', lineHeight: 1.65, maxWidth: 380, margin: '0 auto 24px' }}>
                    Thanks{form.name ? `, ${form.name.split(' ')[0]}` : ''}. We received your note and a real person from our team will reply shortly. If your mail client opened, just hit send to confirm.
                  </p>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <a href="/signup" style={{ display: 'inline-block', padding: '12px 26px', background: 'linear-gradient(135deg,#F5C645,#E8A020)', borderRadius: 10, color: '#1A1400', fontWeight: 800, fontSize: 14, textDecoration: 'none' }}>
                      Start Free Trial &rarr;
                    </a>
                    <button onClick={() => { setForm({ name: '', email: '', company: '', reason: REASONS[0].value, message: '' }); setStatus('idle'); }} style={{ padding: '12px 26px', background: 'transparent', border: '1.5px solid #1C1C1E', borderRadius: 10, color: '#1C1C1E', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: C.font }}>
                      Send another
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <h2 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 6px', color: '#1C1C1E' }}>Send us a message</h2>
                  <p style={{ fontSize: 14, color: '#6E6E73', margin: '0 0 28px', lineHeight: 1.6 }}>
                    Fill this out and we will route it to the right person. No bots, no phone tree.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
                    <div>
                      <label style={labelStyle} htmlFor="name">Full name</label>
                      <input id="name" required value={form.name} onChange={update('name')}
                        onFocus={() => setFocused('name')} onBlur={() => setFocused(null)}
                        placeholder="Jordan Vega" autoComplete="name"
                        style={{ ...fieldStyle, borderColor: focused === 'name' ? C.gold : C.border }} />
                    </div>
                    <div>
                      <label style={labelStyle} htmlFor="email">Work email</label>
                      <input id="email" type="email" required value={form.email} onChange={update('email')}
                        onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
                        placeholder="you@yourcompany.com" autoComplete="email"
                        style={{ ...fieldStyle, borderColor: focused === 'email' ? C.gold : C.border }} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
                    <div>
                      <label style={labelStyle} htmlFor="company">Company</label>
                      <input id="company" value={form.company} onChange={update('company')}
                        onFocus={() => setFocused('company')} onBlur={() => setFocused(null)}
                        placeholder="Vega Construction LLC" autoComplete="organization"
                        style={{ ...fieldStyle, borderColor: focused === 'company' ? C.gold : C.border }} />
                    </div>
                    <div>
                      <label style={labelStyle} htmlFor="reason">How can we help?</label>
                      <select id="reason" value={form.reason} onChange={update('reason')}
                        onFocus={() => setFocused('reason')} onBlur={() => setFocused(null)}
                        style={{ ...fieldStyle, borderColor: focused === 'reason' ? C.gold : C.border, appearance: 'none', cursor: 'pointer' }}>
                        {REASONS.map(r => (
                          <option key={r.value} value={r.value} style={{ background: '#FFFFFF', color: '#1C1C1E' }}>{r.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ marginBottom: 24 }}>
                    <label style={labelStyle} htmlFor="message">Message</label>
                    <textarea id="message" required value={form.message} onChange={update('message')}
                      onFocus={() => setFocused('message')} onBlur={() => setFocused(null)}
                      placeholder="Tell us about your team, your current software, and what you're hoping to fix. The more detail, the faster we can help."
                      rows={6}
                      style={{ ...fieldStyle, resize: 'vertical', minHeight: 130, lineHeight: 1.6, borderColor: focused === 'message' ? C.gold : C.border }} />
                  </div>

                  <button type="submit" disabled={status === 'sending'} style={{
                    width: '100%', padding: '14px 0',
                    background: 'linear-gradient(135deg,#F5C645,#E8A020)',
                    border: 'none', borderRadius: 10, color: '#1A1400',
                    fontWeight: 900, fontSize: 15, cursor: status === 'sending' ? 'default' : 'pointer',
                    opacity: status === 'sending' ? 0.7 : 1, fontFamily: C.font,
                    letterSpacing: 0.3,
                  }}>
                    {status === 'sending' ? 'Sending…' : 'Send message'}
                  </button>

                  <p style={{ fontSize: 12, color: '#6E6E73', textAlign: 'center', margin: '14px 0 0', lineHeight: 1.6 }}>
                    Prefer email? Write us directly at{' '}
                    <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: '#C8881C', textDecoration: 'none', fontWeight: 600 }}>{SUPPORT_EMAIL}</a>.
                    We never share your information.
                  </p>
                </form>
              )}
            </div>

            {/* Side info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ borderTop: '1px solid #E7E5E1', padding: '28px 26px 28px 0' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: C.gold, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>Skip the wait</div>
                <h3 style={{ fontSize: 20, fontWeight: 900, margin: '0 0 10px', lineHeight: 1.25, color: '#1C1C1E' }}>Start free, no sales call required</h3>
                <p style={{ fontSize: 14, color: '#6E6E73', lineHeight: 1.65, margin: '0 0 20px' }}>
                  You do not have to talk to anyone to try Saguaro. Spin up your account, run an AI takeoff, and invite your whole team — free for 30 days, no credit card.
                </p>
                <a href="/signup" style={{ display: 'inline-block', padding: '12px 24px', background: 'linear-gradient(135deg,#F5C645,#E8A020)', borderRadius: 10, color: '#1A1400', fontWeight: 800, fontSize: 14, textDecoration: 'none' }}>
                  Create your account &rarr;
                </a>
              </div>

              <div style={{ borderTop: '1px solid #E7E5E1', padding: '28px 26px 28px 0' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6E6E73', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16 }}>What to expect</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {[
                    'Sales & demos: reply within 1 business hour',
                    'Support tickets: 4-hour SLA on Pro & Enterprise',
                    'Free migration scoped on your first call',
                    'Built and supported in the United States',
                  ].map(item => (
                    <div key={item} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                        <circle cx="8" cy="8" r="8" fill="rgba(52,199,89,0.13)" />
                        <path d="M4.5 8l2.5 2.5 4-5" stroke={C.green} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span style={{ fontSize: 13.5, color: '#1C1C1E', lineHeight: 1.5 }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ borderTop: '1px solid #E7E5E1', padding: '28px 26px 28px 0' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6E6E73', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Headquarters</div>
                <div style={{ fontSize: 14, color: '#1C1C1E', fontWeight: 600, marginBottom: 4 }}>Saguaro Control</div>
                <div style={{ fontSize: 13, color: '#6E6E73', lineHeight: 1.6 }}>Phoenix, Arizona · Remote-first team<br />Serving general contractors across all 50 states</div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section style={{ padding: '0 24px 96px', maxWidth: 760, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ display: 'inline-block', padding: '5px 14px', background: 'rgba(200,136,28,0.10)', border: `1px solid rgba(200,136,28,0.25)`, borderRadius: 999, fontSize: 11, fontWeight: 700, color: C.gold, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16 }}>Before you write</div>
            <h2 style={{ fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 800, margin: 0, letterSpacing: '-0.03em', color: '#1C1C1E' }}>Quick answers</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {FAQS.map(faq => (
              <div key={faq.q} style={{ borderTop: '1px solid #E7E5E1', padding: '22px 0' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', marginBottom: 8 }}>{faq.q}</div>
                <div style={{ fontSize: 14, color: '#6E6E73', lineHeight: 1.7 }}>{faq.a}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section style={{ padding: '96px 24px', background: C.dark, borderTop: '1px solid #E7E5E1', textAlign: 'center' }}>
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900, margin: '0 0 16px', lineHeight: 1.15, letterSpacing: '-0.03em', color: '#1C1C1E' }}>
              Don&rsquo;t wait on us to{' '}
              <span style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldBright})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>get started.</span>
            </h2>
            <p style={{ fontSize: 17, color: '#6E6E73', margin: '0 0 36px', lineHeight: 1.6 }}>
              30-day free trial. Free migration from any platform. No credit card. Your whole team, one flat rate.
            </p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 36 }}>
              <a href="/signup" style={{ display: 'inline-block', padding: '15px 36px', background: 'linear-gradient(135deg,#F5C645,#E8A020)', borderRadius: 10, color: '#1A1400', fontWeight: 800, fontSize: 16, textDecoration: 'none' }}>
                Start Free Trial &rarr;
              </a>
              <a href="/pricing" style={{ display: 'inline-block', padding: '15px 36px', background: 'transparent', border: '1.5px solid #1C1C1E', borderRadius: 10, color: '#1C1C1E', fontWeight: 700, fontSize: 16, textDecoration: 'none' }}>
                See Pricing
              </a>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              {['30 days free', 'Free migration', 'No credit card', 'Unlimited users'].map(pill => (
                <div key={pill} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'rgba(52,199,89,0.10)', border: `1px solid rgba(52,199,89,0.25)`, borderRadius: 20, fontSize: 12, fontWeight: 600, color: C.green }}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="8" fill="rgba(52,199,89,0.18)" />
                    <path d="M4.5 8l2.5 2.5 4-5" stroke={C.green} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {pill}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer style={{ borderTop: '1px solid #E7E5E1', padding: '48px 32px', background: '#FAFAF8' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 32 }}>
            <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
              <img src="/logo-horizontal.png" alt="Saguaro CRM" style={{ height: 30, width: 'auto', objectFit: 'contain' }} />
            </a>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
              {[
                { label: 'Home', href: '/' }, { label: 'Features', href: '/features' },
                { label: 'Pricing', href: '/pricing' }, { label: 'Compare', href: '/compare' },
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
