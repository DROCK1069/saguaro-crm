'use client';

import React, { useState } from 'react';
import Image from 'next/image';

const C = {
  // warm band fill (was cold grey #F2F2F7)
  dark: 'linear-gradient(180deg,#FBF3E4,#F7EAD4)',
  gold: '#C8881C',
  goldBright: '#D89A1E',
  text: '#2A1B06',
  dim: '#6B5B43',
  border: 'rgba(176,122,18,0.16)',
  raised: 'transparent',
  green: '#15803D',
  red: '#EF4444',
};

const ROWS: {
  feature: string;
  saguaro: string;
  procore: string;
  saguaroWin: boolean | 'neutral';
  note?: string;
}[] = [
  { feature: 'Starting Price', saguaro: '$199/mo', procore: '$375–600/mo+', saguaroWin: true, note: 'Procore pricing requires annual contract and implementation fees' },
  { feature: 'Annual Contract Required', saguaro: 'Month-to-month', procore: 'Annual required', saguaroWin: true, note: 'Cancel Saguaro anytime — no penalty, no lock-in' },
  { feature: 'Setup Time', saguaro: '< 1 day', procore: '3–6 months', saguaroWin: true, note: 'Procore requires a dedicated implementation team and onboarding process' },
  { feature: 'Per-Seat Pricing', saguaro: 'Flat rate', procore: 'Per user (costs grow)', saguaroWin: true, note: 'Add 50 users on Saguaro — same price. Procore charges per seat.' },
  { feature: 'AI Blueprint Takeoff', saguaro: 'Included', procore: 'Add-on ($$$)', saguaroWin: true, note: 'Procore Takeoff is a separate paid module' },
  { feature: 'AIA Pay Apps G702/G703', saguaro: 'Included', procore: 'Included', saguaroWin: 'neutral' },
  { feature: 'Lien Waivers (all 50 states)', saguaro: 'Included', procore: 'Add-on', saguaroWin: true, note: 'Saguaro generates state-compliant lien waivers instantly' },
  { feature: 'Certified Payroll WH-347', saguaro: 'Included', procore: 'Not available', saguaroWin: true, note: 'Procore does not natively generate WH-347 forms' },
  { feature: 'AI Autopilot / Automation', saguaro: 'Included', procore: 'Limited', saguaroWin: true, note: 'Saguaro automates RFI routing, CO triggers, insurance alerts, and more' },
  { feature: 'Mobile Field App', saguaro: 'Free native iOS', procore: 'Native (extra cost)', saguaroWin: true, note: 'Saguaro Field is a free native iOS app — included for your whole team' },
  { feature: 'Offline Mode', saguaro: 'Full offline', procore: 'Limited', saguaroWin: true, note: 'Saguaro works without signal — syncs when back online' },
  { feature: 'Field App Cost', saguaro: 'Free for all users', procore: 'Per-seat add-on', saguaroWin: true, note: 'Every team member gets the iOS field app at no extra charge' },
  { feature: 'AI Field Assistant (Sage)', saguaro: 'Included', procore: 'Not available', saguaroWin: true, note: 'Sage answers field questions, drafts RFIs, and surfaces project data' },
  { feature: 'Bid Intelligence Scoring', saguaro: 'Included', procore: 'Not available', saguaroWin: true },
  { feature: 'Owner + Sub Portals', saguaro: 'Included', procore: 'Included', saguaroWin: 'neutral' },
  { feature: 'ACORD 25 COI Parser', saguaro: 'Included', procore: 'Add-on', saguaroWin: true, note: 'Saguaro auto-reads COI PDFs and flags expiring coverage' },
  { feature: 'OSHA 300 Log', saguaro: 'Included', procore: 'Included', saguaroWin: 'neutral' },
  { feature: 'QuickBooks Sync', saguaro: 'Enterprise', procore: 'Included', saguaroWin: false },
  { feature: 'White Label', saguaro: 'Enterprise', procore: 'Not available', saguaroWin: true, note: 'Saguaro Enterprise supports full white-label branding' },
  { feature: 'Customer Support', saguaro: 'Email + Chat', procore: 'Enterprise only', saguaroWin: true, note: 'Procore support tiers can exceed $1,000/mo' },
];

const DEEP_DIVE = [
  {
    title: 'AI That Works on Job Sites',
    body: "Saguaro's Sage AI answers field questions, drafts RFIs from photos, surfaces budget alerts, and automates document workflows — all without leaving the field app. Procore has limited AI capabilities with no automated workflow intelligence, and AI features are restricted to certain enterprise tiers.",
    procoreBody: "Procore's AI features are in early access and limited to select tiers. There is no native AI field assistant, no automated RFI routing, and no AI-driven document generation.",
  },
  {
    title: 'Document Generation Speed',
    body: 'Generate G702/G703 pay apps, lien waivers for all 50 states, WH-347 certified payroll, ACORD 25 COI forms, preliminary notices, and AIA A310/A312 bonds — all in seconds, all included in your plan price.',
    procoreBody: 'Procore requires integrations, third-party vendors, or manual PDF uploads for most document types. Certified payroll and state-compliant lien waivers require separate tools or paid add-ons.',
  },
  {
    title: 'Pricing That Grows With You',
    body: 'One flat monthly rate. Add 50 users and 50 projects — same price. No annual contract. Cancel anytime. Start free with no credit card required. Starter at $299/mo, Professional at $599/mo.',
    procoreBody: "Procore's per-user, per-module pricing scales sharply as your team grows. Annual contracts are required. Total cost of ownership for a mid-size GC typically exceeds $50,000–$80,000/year when add-ons and implementation are included.",
  },
];

const TESTIMONIALS = [
  {
    quote: 'We were paying $1,800/mo for Procore and still doing lien waivers in Word. Switched to Saguaro and cut admin time by 60% in the first week.',
    author: 'General Contractor',
    location: 'Phoenix, AZ',
    size: '45 employees',
    initials: 'RC',
  },
  {
    quote: 'The AI takeoff alone paid for the subscription in the first month. We estimated a $2M medical building in 41 seconds.',
    author: 'Estimator, Commercial GC',
    location: 'Denver, CO',
    size: 'ENR Regional 250',
    initials: 'MK',
  },
  {
    quote: 'Setup took 3 hours, not 3 months. We were live the same day we signed up. The Procore migration was painless.',
    author: 'Owner, Mid-Size GC',
    location: 'Las Vegas, NV',
    size: '28 employees',
    initials: 'TW',
  },
];

function StarRating() {
  return (
    <div style={{ display: 'flex', gap: 2, marginBottom: 12 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} width="14" height="14" viewBox="0 0 24 24" fill={C.gold}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.red} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function NeutralIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.dim} strokeWidth="2.5" strokeLinecap="round">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export default function CompareProcorePage() {
  const [activeDeep, setActiveDeep] = useState<number | null>(null);
  const [procoreCost, setProcoreCost] = useState<number>(1850);
  const [teamSizeCalc, setTeamSizeCalc] = useState<number>(15);

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #FCF7EE 0%, #F8EFDF 40%, #FBF2E3 70%, #F7ECDA 100%)', color: C.text, fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ── NAV ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        height: 64, background: 'rgba(255,251,242,0.85)',
        borderBottom: `1px solid #F0E7D6`,
        backdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'center',
        padding: '0 32px', gap: 32,
      }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0 }}>
          <Image
            src="/logo-horizontal.png"
            alt="Saguaro"
            width={132}
            height={44}
            style={{ height: 44, width: 'auto', objectFit: 'contain' }}
          />
        </a>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          {['Features', 'Field App', 'Pricing', 'How It Works'].map((link) => (
            <a
              key={link}
              href={`/${link.toLowerCase().replace(/\s+/g, '-')}`}
              style={{ color: C.dim, fontSize: 14, fontWeight: 500, textDecoration: 'none', letterSpacing: 0.2 }}
            >
              {link}
            </a>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginLeft: 8 }}>
          <a href="/login" style={{
            padding: '8px 18px',
            background: 'transparent',
            border: `1px solid #E6D7BC`,
            borderRadius: 8,
            color: C.text,
            fontSize: 13,
            fontWeight: 600,
            textDecoration: 'none',
          }}>
            Log In
          </a>
          <a href="/signup" style={{
            padding: '9px 20px',
            background: 'linear-gradient(135deg,#E8B84B,#C98A1A)',
            borderRadius: 8,
            color: '#2A1B06',
            fontSize: 13,
            fontWeight: 800,
            textDecoration: 'none',
            letterSpacing: 0.2,
            boxShadow: '0 6px 18px rgba(201,138,26,0.28)',
          }}>
            Free Trial
          </a>
        </div>
      </nav>

      {/* ── HERO ── */}
      <div style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(160deg, #FFFBF2, #FDF3E2, #FBEAD2)',
        borderBottom: '1px solid #F0E7D6',
      }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 80% 0%, rgba(216,154,30,0.12), transparent 60%)', pointerEvents: 'none' }} />
      <div style={{
        position: 'relative',
        zIndex: 1,
        textAlign: 'center',
        padding: '128px 24px 72px',
        maxWidth: 860,
        margin: '0 auto',
      }}>
        {/* Badge */}
        <div style={{
          display: 'inline-block',
          padding: '6px 18px',
          background: 'rgba(200,136,28,0.10)',
          border: `1px solid rgba(200,136,28,0.32)`,
          borderRadius: 100,
          fontSize: 12,
          fontWeight: 700,
          color: '#B07A12',
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          marginBottom: 28,
        }}>
          Saguaro vs Procore — 2026 Comparison
        </div>

        <h1 style={{
          fontSize: 'clamp(40px, 6vw, 68px)',
          fontWeight: 900,
          lineHeight: 1.08,
          margin: '0 0 24px',
          letterSpacing: -1.5,
        }}>
          All the Power.{' '}
          <span style={{
            background: `linear-gradient(135deg, #D89A1E, #A86A0C)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            None of the Price Tag.
          </span>
        </h1>

        <p style={{
          fontSize: 18,
          color: C.dim,
          maxWidth: 620,
          margin: '0 auto 40px',
          lineHeight: 1.7,
        }}>
          Procore is built for ENR 400 firms with 6-figure IT budgets. Saguaro gives mid-size GCs enterprise features at a price that makes sense.
        </p>

        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
          <a href="/signup" style={{
            padding: '14px 36px',
            background: 'linear-gradient(135deg,#E8B84B,#C98A1A)',
            borderRadius: 10,
            color: '#2A1B06',
            fontWeight: 800,
            fontSize: 16,
            textDecoration: 'none',
            letterSpacing: 0.2,
            boxShadow: `0 6px 18px rgba(201,138,26,0.28)`,
          }}>
            Try Saguaro Free →
          </a>
          <a href="/pricing" style={{
            padding: '14px 32px',
            background: 'transparent',
            border: `1.5px solid #C8881C`,
            borderRadius: 10,
            color: '#A86A0C',
            fontWeight: 700,
            fontSize: 15,
            textDecoration: 'none',
          }}>
            See Pricing
          </a>
        </div>

        <div style={{ fontSize: 13, color: C.dim, marginBottom: 52, letterSpacing: 0.3 }}>
          No credit card &nbsp;·&nbsp; 30-day free trial &nbsp;·&nbsp; No annual contract
        </div>

        {/* Key win stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 18,
          maxWidth: 720,
          margin: '0 auto',
        }}>
          {[
            { stat: '82%', label: 'lower cost than Procore' },
            { stat: '1 day', label: 'deployed vs 6 months' },
            { stat: 'AI features', label: "Procore doesn't have" },
          ].map((item) => (
            <div key={item.stat} style={{
              padding: '24px 20px',
              textAlign: 'center',
            }}>
              <div style={{
                fontSize: 28, fontWeight: 900, letterSpacing: -0.5, marginBottom: 4,
                background: 'linear-gradient(135deg, #D89A1E, #A86A0C)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>
                {item.stat}
              </div>
              <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.4 }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>
      </div>

      {/* ── QUICK WINS BAR ── */}
      <div style={{
        background: 'rgba(200,136,28,0.06)',
        borderTop: `1px solid rgba(200,136,28,0.15)`,
        borderBottom: `1px solid rgba(200,136,28,0.15)`,
        padding: '18px 24px',
        overflowX: 'auto',
      }}>
        <div style={{
          display: 'flex',
          gap: 12,
          justifyContent: 'center',
          flexWrap: 'wrap',
          maxWidth: 1100,
          margin: '0 auto',
        }}>
          {[
            'No per-seat fees',
            'AI Blueprint Takeoff',
            'Offline field app',
            'Lien waivers all 50 states',
            'Certified Payroll WH-347',
          ].map((item) => (
            <div key={item} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 18px',
              background: 'rgba(200,136,28,0.08)',
              border: `1px solid rgba(200,136,28,0.2)`,
              borderRadius: 100,
              fontSize: 13,
              fontWeight: 600,
              color: '#A86A0C',
              whiteSpace: 'nowrap',
            }}>
              <CheckIcon size={13} />
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* ── COMPARISON TABLE ── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 900, margin: '0 0 14px', letterSpacing: -0.8 }}>
            Feature-by-Feature Comparison
          </h2>
          <p style={{ color: C.dim, fontSize: 16, margin: 0 }}>
            20 features that matter most to mid-size general contractors.
          </p>
        </div>

        <div>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1.1fr 1.1fr',
            background: 'linear-gradient(180deg, rgba(216,154,30,0.12), rgba(216,154,30,0.05))',
            borderBottom: `2px solid rgba(176,122,18,0.4)`,
          }}>
            <div style={{ padding: '18px 28px', fontSize: 11, fontWeight: 700, color: '#B07A12', textTransform: 'uppercase', letterSpacing: 1.2 }}>
              Feature
            </div>
            <div style={{
              padding: '18px 24px',
              textAlign: 'center',
              background: 'rgba(216,154,30,0.10)',
            }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#A86A0C' }}>Saguaro</div>
              <div style={{ fontSize: 11, color: '#B07A12', opacity: 0.8, marginTop: 2 }}>Recommended</div>
            </div>
            <div style={{
              padding: '18px 24px',
              textAlign: 'center',
            }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: C.dim }}>Procore</div>
            </div>
          </div>

          {ROWS.map((row, i) => {
            const saguaroGood = row.saguaroWin === true;
            const neutral = row.saguaroWin === 'neutral';
            const procoreBad = row.saguaroWin === true;
            return (
              <div
                key={row.feature}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1.1fr 1.1fr',
                  borderBottom: i < ROWS.length - 1 ? `1px solid rgba(176,122,18,0.16)` : 'none',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(216,154,30,0.035)',
                }}
              >
                <div style={{ padding: '16px 28px' }}>
                  <div style={{ fontWeight: 600, color: C.text, fontSize: 14 }}>{row.feature}</div>
                  {row.note && (
                    <div style={{ fontSize: 11, color: C.dim, marginTop: 4, lineHeight: 1.5 }}>{row.note}</div>
                  )}
                </div>

                {/* Saguaro cell */}
                <div style={{
                  padding: '16px 24px',
                  background: 'rgba(216,154,30,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}>
                  {saguaroGood ? <CheckIcon /> : neutral ? <NeutralIcon /> : <NeutralIcon />}
                  <span style={{
                    color: saguaroGood ? C.green : C.text,
                    fontWeight: saguaroGood ? 700 : 400,
                    fontSize: 13,
                  }}>
                    {row.saguaro}
                  </span>
                </div>

                {/* Procore cell */}
                <div style={{
                  padding: '16px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}>
                  {procoreBad ? <XIcon /> : neutral ? <NeutralIcon /> : <CheckIcon />}
                  <span style={{
                    color: procoreBad ? C.red : C.dim,
                    fontSize: 13,
                    fontWeight: 400,
                  }}>
                    {row.procore}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── ROI MINI-CALCULATOR ── */}
      <div style={{
        background: 'linear-gradient(180deg,#FBF3E4,#F7EAD4)',
        padding: '64px 24px',
        borderTop: `1px solid rgba(176,122,18,0.16)`,
        borderBottom: `1px solid rgba(176,122,18,0.16)`,
      }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2 style={{
              fontSize: 'clamp(28px, 4vw, 42px)',
              fontWeight: 900,
              margin: '0 0 14px',
              letterSpacing: -0.8,
              background: `linear-gradient(135deg, #D89A1E, #A86A0C)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              Calculate Your Exact Savings
            </h2>
            <p style={{ color: C.dim, fontSize: 16, margin: 0 }}>
              Tell us what you&apos;re paying. We&apos;ll show you the math.
            </p>
          </div>

          {/* Inputs row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 20,
            marginBottom: 32,
          }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.dim, marginBottom: 8 }}>
                Current monthly software cost
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 15, fontWeight: 700, color: '#B07A12', pointerEvents: 'none',
                }}>$</span>
                <input
                  type="number"
                  value={procoreCost}
                  onChange={(e) => setProcoreCost(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '14px 16px 14px 30px',
                    background: 'rgba(255,251,242,0.9)',
                    border: `1px solid rgba(200,136,28,0.3)`,
                    borderRadius: 10,
                    color: C.text,
                    fontSize: 18,
                    fontWeight: 700,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#C8881C'; e.currentTarget.style.boxShadow = `0 0 0 2px rgba(200,136,28,0.15)`; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(200,136,28,0.3)'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              </div>
              <button
                onClick={() => setProcoreCost(1850)}
                style={{
                  marginTop: 8,
                  padding: '5px 14px',
                  background: 'rgba(200,136,28,0.1)',
                  border: `1px solid rgba(200,136,28,0.25)`,
                  borderRadius: 100,
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#A86A0C',
                  cursor: 'pointer',
                }}
              >
                I use Procore — fill $1,850
              </button>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.dim, marginBottom: 8 }}>
                Team size (users)
              </label>
              <input
                type="number"
                value={teamSizeCalc}
                onChange={(e) => setTeamSizeCalc(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: 'rgba(255,251,242,0.9)',
                  border: `1px solid rgba(200,136,28,0.3)`,
                  borderRadius: 10,
                  color: C.text,
                  fontSize: 18,
                  fontWeight: 700,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#C8881C'; e.currentTarget.style.boxShadow = `0 0 0 2px rgba(200,136,28,0.15)`; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(200,136,28,0.3)'; e.currentTarget.style.boxShadow = 'none'; }}
              />
              <div style={{ marginTop: 8, fontSize: 12, color: C.dim }}>
                Saguaro is flat-rate — {teamSizeCalc} users, same price
              </div>
            </div>
          </div>

          {/* Live results */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
            marginBottom: 32,
          }}>
            {[
              {
                label: 'Monthly Savings',
                value: Math.max(0, procoreCost - 399),
                suffix: '/mo',
                highlight: true,
              },
              {
                label: 'Annual Savings',
                value: Math.max(0, (procoreCost - 399) * 12),
                suffix: '/yr',
                highlight: false,
              },
              {
                label: '3-Year Savings',
                value: Math.max(0, (procoreCost - 399) * 36),
                suffix: ' total',
                highlight: false,
              },
            ].map((item) => (
              <div key={item.label} style={{
                padding: '28px 20px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.dim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
                  {item.label}
                </div>
                <div style={{
                  fontSize: 'clamp(24px, 3vw, 36px)',
                  fontWeight: 900,
                  ...(item.highlight
                    ? { background: 'linear-gradient(135deg, #D89A1E, #A86A0C)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }
                    : { color: C.green }),
                  letterSpacing: -1,
                  lineHeight: 1,
                }}>
                  ${item.value.toLocaleString()}
                </div>
                <div style={{ fontSize: 12, color: C.dim, marginTop: 4 }}>{item.suffix}</div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div style={{ textAlign: 'center' }}>
            <a href="/signup" style={{
              display: 'inline-block',
              padding: '15px 40px',
              background: `linear-gradient(135deg,#E8B84B,#C98A1A)`,
              borderRadius: 10,
              color: '#2A1B06',
              fontWeight: 800,
              fontSize: 16,
              textDecoration: 'none',
              boxShadow: `0 6px 18px rgba(201,138,26,0.28)`,
              marginBottom: 16,
            }}>
              Claim This Savings — Start Free →
            </a>
            <div style={{ fontSize: 13, color: C.dim }}>
              <a href="/roi-calculator" style={{ color: '#A86A0C', textDecoration: 'none', fontWeight: 600 }}>
                Or see our full ROI calculator →
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ── WHERE WE WIN DEEP DIVE ── */}
      <div style={{
        background: 'linear-gradient(180deg,#FBF3E4,#F7EAD4)',
        borderTop: `1px solid rgba(176,122,18,0.16)`,
        borderBottom: `1px solid rgba(176,122,18,0.16)`,
        padding: '80px 24px',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 900, margin: '0 0 14px', letterSpacing: -0.8 }}>
              Where We Win
            </h2>
            <p style={{ color: C.dim, fontSize: 16, margin: 0 }}>
              A deeper look at the capabilities that change how your business runs.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {DEEP_DIVE.map((card, idx) => (
              <div
                key={card.title}
                onClick={() => setActiveDeep(activeDeep === idx ? null : idx)}
                style={{
                  background: 'rgba(255,251,242,0.6)',
                  border: `1px solid ${activeDeep === idx ? 'rgba(200,136,28,0.5)' : 'rgba(176,122,18,0.16)'}`,
                  borderRadius: 14,
                  padding: '28px 26px',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  boxShadow: activeDeep === idx ? `0 8px 24px rgba(201,138,26,0.12)` : 'none',
                }}
              >
                <div style={{
                  display: 'inline-flex',
                  padding: '6px 12px',
                  background: 'rgba(200,136,28,0.1)',
                  border: `1px solid rgba(200,136,28,0.2)`,
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#A86A0C',
                  textTransform: 'uppercase',
                  letterSpacing: 0.8,
                  marginBottom: 16,
                }}>
                  Saguaro Advantage
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: C.text, margin: '0 0 14px', lineHeight: 1.3 }}>
                  {card.title}
                </h3>
                <p style={{ fontSize: 13, color: C.dim, lineHeight: 1.75, margin: '0 0 20px' }}>
                  {card.body}
                </p>
                {activeDeep === idx && (
                  <div style={{
                    background: 'rgba(239,68,68,0.05)',
                    border: `1px solid rgba(239,68,68,0.15)`,
                    borderRadius: 8,
                    padding: '14px 16px',
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.red, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                      Procore
                    </div>
                    <p style={{ fontSize: 12, color: C.dim, lineHeight: 1.7, margin: 0 }}>{card.procoreBody}</p>
                  </div>
                )}
                <div style={{ fontSize: 12, color: '#A86A0C', marginTop: 12 }}>
                  {activeDeep === idx ? 'Hide Procore comparison ↑' : 'Compare with Procore →'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── COST CALCULATOR ── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 900, margin: '0 0 14px', letterSpacing: -0.8 }}>
            What Would You Pay?
          </h2>
          <p style={{ color: C.dim, fontSize: 16, margin: 0 }}>
            Real numbers for a real team. No asterisks.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          gap: 24,
          alignItems: 'stretch',
          maxWidth: 900,
          margin: '0 auto',
        }}>
          {/* Procore card */}
          <div style={{
            background: 'rgba(255,251,242,0.55)',
            border: `1px solid rgba(176,122,18,0.16)`,
            borderRadius: 16,
            padding: '32px 28px',
            opacity: 0.92,
          }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.dim, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 20 }}>
              Procore
            </div>
            <div style={{ fontSize: 11, color: C.dim, marginBottom: 20, lineHeight: 1.6 }}>
              Team of 25 users, 15 active projects
            </div>
            <div style={{ fontSize: 42, fontWeight: 900, color: C.red, letterSpacing: -1, marginBottom: 4 }}>
              $1,850
              <span style={{ fontSize: 16, fontWeight: 500, color: C.dim }}>/mo</span>
            </div>
            <div style={{ fontSize: 12, color: C.dim, marginBottom: 24 }}>Estimated — before add-ons and implementation</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                'Annual contract required',
                '3–6 month implementation',
                'Per-user pricing scales up',
                'Add-ons billed separately',
              ].map((item) => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <XIcon size={13} />
                  <span style={{ fontSize: 13, color: C.dim }}>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* VS divider */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 8px',
          }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'rgba(255,251,242,0.9)',
              border: `2px solid rgba(200,136,28,0.35)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 800,
              color: '#A86A0C',
            }}>
              VS
            </div>
          </div>

          {/* Saguaro card */}
          <div style={{
            background: 'rgba(216,154,30,0.07)',
            border: `2px solid rgba(200,136,28,0.4)`,
            borderRadius: 16,
            padding: '32px 28px',
            boxShadow: `0 8px 28px rgba(201,138,26,0.14)`,
          }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#A86A0C', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 20 }}>
              Saguaro Professional
            </div>
            <div style={{ fontSize: 11, color: C.dim, marginBottom: 20, lineHeight: 1.6 }}>
              Team of 25 users, 15 active projects
            </div>
            <div style={{ fontSize: 42, fontWeight: 900, color: C.green, letterSpacing: -1, marginBottom: 4 }}>
              $299
              <span style={{ fontSize: 16, fontWeight: 500, color: C.dim }}>/mo</span>
            </div>
            <div style={{ fontSize: 12, color: C.dim, marginBottom: 24 }}>All features included. No add-ons.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                'Month-to-month, cancel anytime',
                'Live in under 1 day',
                'Flat rate — unlimited users',
                'AI takeoff, Sage, docs included',
              ].map((item) => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckIcon size={13} />
                  <span style={{ fontSize: 13, color: C.text }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Savings banner */}
        <div style={{
          maxWidth: 900,
          margin: '24px auto 0',
          background: 'rgba(34,197,94,0.08)',
          border: `1px solid rgba(34,197,94,0.25)`,
          borderRadius: 12,
          padding: '20px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontSize: 13, color: C.dim, marginBottom: 2 }}>Estimated annual savings vs Procore</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: C.green, letterSpacing: -0.5 }}>$17,412 / year</div>
          </div>
          <a href="/signup" style={{
            padding: '12px 28px',
            background: 'linear-gradient(135deg,#E8B84B,#C98A1A)',
            borderRadius: 9,
            color: '#2A1B06',
            fontWeight: 800,
            fontSize: 14,
            textDecoration: 'none',
            flexShrink: 0,
            boxShadow: '0 6px 18px rgba(201,138,26,0.28)',
          }}>
            Start Saving Today →
          </a>
        </div>
      </div>

      {/* ── READY TO SWITCH / MIGRATION CTA ── */}
      <div style={{
        padding: '80px 24px',
        background: 'transparent',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{
            padding: '24px 0 0',
            borderTop: `3px solid rgba(200,136,28,0.5)`,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 48,
            alignItems: 'start',
          }}>
            {/* LEFT */}
            <div>
              <div style={{
                display: 'inline-block',
                padding: '5px 14px',
                background: 'rgba(200,136,28,0.12)',
                border: `1px solid rgba(200,136,28,0.3)`,
                borderRadius: 100,
                fontSize: 11,
                fontWeight: 700,
                color: '#B07A12',
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                marginBottom: 20,
              }}>
                Procore Migration
              </div>
              <h2 style={{
                fontSize: 'clamp(24px, 3vw, 36px)',
                fontWeight: 900,
                color: C.text,
                margin: '0 0 16px',
                lineHeight: 1.2,
                letterSpacing: -0.5,
              }}>
                We&apos;ll Move You Over in 1 Business Day
              </h2>
              <p style={{ fontSize: 15, color: C.dim, lineHeight: 1.7, margin: '0 0 28px' }}>
                Our migration team exports your Procore data, imports it into Saguaro, and trains your team — all for free. You&apos;ll be live before the end of the week.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  'Free data migration — projects, contacts, documents',
                  '1-day setup vs. Procore\'s 6-month implementation',
                  'Dedicated onboarding call with your team',
                  'Month-to-month — cancel if you\'re not blown away',
                ].map((item) => (
                  <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ marginTop: 1, flexShrink: 0 }}>
                      <CheckIcon size={15} />
                    </div>
                    <span style={{ fontSize: 14, color: C.text, lineHeight: 1.5 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT */}
            <div style={{
              background: 'rgba(216,154,30,0.06)',
              border: `1px solid rgba(200,136,28,0.3)`,
              borderRadius: 14,
              padding: '32px 28px',
              boxShadow: `0 8px 28px rgba(201,138,26,0.10)`,
            }}>
              <div style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#A86A0C',
                textTransform: 'uppercase',
                letterSpacing: 0.8,
                marginBottom: 20,
              }}>
                What you get on day 1:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
                {[
                  'Full AI takeoff with your blueprints',
                  'All 50-state lien waivers activated',
                  'Field app installed on your crew\'s phones',
                  'Your Procore data fully imported',
                  'G702 pay app template ready',
                ].map((item) => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CheckIcon size={15} />
                    <span style={{ fontSize: 14, color: C.text }}>{item}</span>
                  </div>
                ))}
              </div>
              <a href="/switch-from-procore" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '14px 24px',
                background: `linear-gradient(135deg,#E8B84B,#C98A1A)`,
                borderRadius: 9,
                color: '#2A1B06',
                fontWeight: 800,
                fontSize: 15,
                textDecoration: 'none',
                marginBottom: 12,
                boxShadow: `0 6px 18px rgba(201,138,26,0.28)`,
              }}>
                Start My Free Migration →
              </a>
              <a href="/sandbox" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '13px 24px',
                background: 'transparent',
                border: `1px solid rgba(200,136,28,0.4)`,
                borderRadius: 9,
                color: '#A86A0C',
                fontWeight: 700,
                fontSize: 14,
                textDecoration: 'none',
              }}>
                Talk to Sales First
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ── TESTIMONIALS ── */}
      <div style={{
        background: 'linear-gradient(180deg,#FBF3E4,#F7EAD4)',
        borderTop: `1px solid rgba(176,122,18,0.16)`,
        borderBottom: `1px solid rgba(176,122,18,0.16)`,
        padding: '80px 24px',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <h2 style={{ fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 900, margin: '0 0 12px', letterSpacing: -0.6 }}>
              GCs Who Made the Switch
            </h2>
            <p style={{ color: C.dim, fontSize: 15, margin: 0 }}>Real results from real contractors.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {TESTIMONIALS.map((t) => (
              <div key={t.author} style={{
                background: 'rgba(255,251,242,0.6)',
                border: `1px solid rgba(176,122,18,0.16)`,
                borderRadius: 14,
                padding: '28px 26px',
              }}>
                <StarRating />
                <p style={{
                  fontSize: 14,
                  color: C.text,
                  lineHeight: 1.75,
                  margin: '0 0 24px',
                  fontStyle: 'italic',
                }}>
                  &quot;{t.quote}&quot;
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: `linear-gradient(135deg,#E8B84B,#C98A1A)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 800,
                    color: '#2A1B06',
                    flexShrink: 0,
                  }}>
                    {t.initials}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{t.author}</div>
                    <div style={{ fontSize: 11, color: C.dim }}>{t.location} &nbsp;·&nbsp; {t.size}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FINAL CTA ── */}
      <div style={{
        padding: '96px 24px',
        textAlign: 'center',
        background: `radial-gradient(ellipse at 50% 0%, #251608, #0E0B08)`,
      }}>
        <div style={{
          display: 'inline-block',
          padding: '6px 18px',
          background: 'rgba(216,154,30,0.14)',
          border: `1px solid rgba(216,154,30,0.4)`,
          borderRadius: 100,
          fontSize: 11,
          fontWeight: 700,
          color: '#E8B84B',
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          marginBottom: 24,
        }}>
          Ready to switch?
        </div>

        <h2 style={{
          fontSize: 'clamp(32px, 5vw, 52px)',
          fontWeight: 900,
          margin: '0 0 16px',
          letterSpacing: -1,
          lineHeight: 1.1,
          color: '#F5E9D6',
        }}>
          Make the Switch Today.
        </h2>

        <p style={{ fontSize: 17, color: '#C9B79A', marginBottom: 8, lineHeight: 1.6 }}>
          Start your free trial. No credit card. No annual contract. No sales call required.
        </p>
        <p style={{ fontSize: 14, color: '#C9B79A', marginBottom: 44 }}>
          We&apos;ll help migrate your data from Procore — at no additional cost.
        </p>

        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 48 }}>
          <a href="/signup" style={{
            padding: '16px 44px',
            background: 'linear-gradient(135deg,#E8B84B,#C98A1A)',
            borderRadius: 10,
            color: '#2A1B06',
            fontWeight: 800,
            fontSize: 17,
            textDecoration: 'none',
            boxShadow: `0 6px 18px rgba(201,138,26,0.4)`,
            letterSpacing: 0.2,
          }}>
            Start Free Trial →
          </a>
          <a href="/contact" style={{
            padding: '16px 36px',
            background: 'transparent',
            border: `1px solid rgba(216,154,30,0.45)`,
            borderRadius: 10,
            color: '#F5E9D6',
            fontWeight: 700,
            fontSize: 16,
            textDecoration: 'none',
          }}>
            Talk to Sales
          </a>
        </div>

        <div style={{ fontSize: 13, color: '#C9B79A' }}>
          Also compare:&nbsp;
          <a href="/compare/buildertrend" style={{ color: '#E8B84B', textDecoration: 'none', fontWeight: 600 }}>
            Saguaro vs Buildertrend
          </a>
        </div>
      </div>

      {/* ── MOBILE STICKY CTA ── */}
      <div className="mobile-sticky-cta" style={{ display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200, background: 'rgba(255,251,242,0.97)', borderTop: '1px solid rgba(200,136,28,0.3)', padding: '12px 16px', backdropFilter: 'blur(12px)' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <a href="/signup" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '13px', background: 'linear-gradient(135deg,#E8B84B,#C98A1A)', borderRadius: 8, color: '#2A1B06', fontSize: 14, fontWeight: 800, textDecoration: 'none' }}>
            Start Free Trial
          </a>
          <a href="/switch-from-procore" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '13px', background: 'rgba(200,136,28,0.1)', border: '1px solid rgba(200,136,28,0.35)', borderRadius: 8, color: '#A86A0C', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
            Free Migration
          </a>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .mobile-sticky-cta { display: block !important; }
        }
      `}</style>

    </div>
  );
}
