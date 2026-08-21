'use client';

/**
 * Premium UI kit — the cinematic "Takeoff-level" surface language.
 *
 * Purely presentational building blocks used to elevate flagship screens
 * (Dashboard, Projects, …) to the same bar as the AI Blueprint Takeoff page:
 * an aurora/blueprint backdrop, a big gradient headline hero, premium stat
 * cards with depth + glow, section cards with an icon chip, and cinematic
 * empty/error states.
 *
 * Everything themes through --brand-primary (white-label aware) with warm
 * amber glows to match Takeoff. No data, no fetching, no routing here.
 */

import React from 'react';

// Brand hooks (white-label re-themes these via WhiteLabelProvider) ------------
const GOLD = 'var(--brand-primary)';        // #F59E0B default
const GOLD_HI = 'var(--brand-primary-strong)'; // #FBBF24 default
// Warm amber glow literals (match Takeoff; intentionally not re-themed) --------
const A08 = 'rgba(245,158,11,0.08)';
const A12 = 'rgba(245,158,11,0.12)';
const A18 = 'rgba(245,158,11,0.18)';
const A22 = 'rgba(245,158,11,0.22)';
const A30 = 'rgba(245,158,11,0.30)';
const A45 = 'rgba(245,158,11,0.45)';
const BORDER = 'rgba(255,255,255,0.08)';
const SURFACE = 'linear-gradient(160deg, rgba(255,255,255,0.045), rgba(255,255,255,0.012))';
const WHITE = '#FFFFFF';
const MUTED = 'rgba(255,255,255,0.62)';
const FAINT = 'rgba(255,255,255,0.42)';

// ─── FX keyframes + interaction classes ──────────────────────────────────────
// Rendered once per page. All motion is disabled under prefers-reduced-motion.
export const PREMIUM_FX = `
@keyframes pmRise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}/* transform:none at rest — translateY(0) + fill-mode both left a PERMANENT stacking context that painted every hero dropdown UNDER later cards */
@keyframes pmFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes pmAur1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(7%,5%) scale(1.14)}}
@keyframes pmAur2{0%,100%{transform:translate(0,0) scale(1.06)}50%{transform:translate(-8%,6%) scale(1)}}
@keyframes pmAur3{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(5%,-7%) scale(1.16)}}
@keyframes pmGridPan{from{background-position:0 0}to{background-position:34px 34px}}
@keyframes pmShimmer{from{background-position:180% 0}to{background-position:-180% 0}}
@keyframes pmPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(1.4)}}
@keyframes pmRing{0%{transform:scale(.85);opacity:.7}70%{opacity:0}100%{transform:scale(1.7);opacity:0}}
@keyframes pmSkeleton{0%,100%{opacity:1}50%{opacity:.4}}
.pmHover{transition:transform .2s cubic-bezier(.2,.7,.3,1),box-shadow .2s ease,border-color .2s ease,background .2s ease}
/* !important on hover: outranks pmRise's held fill value (transform:none) and the inline resting shadow so the lift/elevation actually renders. Hover-only transforms are transient — the rest state stays transform:none, so no permanent stacking context. */
.pmHover:hover{transform:translateY(-4px)!important;border-color:${A45};box-shadow:0 22px 44px -26px ${A30},inset 0 1px 0 rgba(255,255,255,0.08)!important}
.pmHover:hover .pmChip{box-shadow:0 0 0 3px ${A12},0 0 22px ${A30}!important}
.pmBtn{transition:transform .16s ease,box-shadow .16s ease,filter .16s ease}
.pmBtn:hover{transform:translateY(-1px);filter:brightness(1.05)}
.pmBtn:active{transform:scale(.98)}/* transient press; rest state stays transform:none */
.pmTile{transition:transform .18s ease}
.pmTile:hover{transform:translateY(-1px)}
.pmShine{background-size:200% 100%;animation:pmShimmer 3.6s linear infinite}
.pmSkeleton{animation:pmSkeleton 1.4s ease-in-out infinite}
/* Beat the global h1 !important size cap (globals.css) with higher specificity */
h1.pmH1{font-size:clamp(28px,4.4vw,46px)!important;font-weight:900!important;line-height:1.04!important;letter-spacing:-0.03em!important;margin:0!important}
@media (prefers-reduced-motion: reduce){
  .pmRoot,.pmRoot *{animation:none!important;transition:none!important}
  .pmHover:hover,.pmBtn:hover,.pmBtn:active,.pmTile:hover{transform:none!important}
}
`;

export function PremiumFX() {
  return <style>{PREMIUM_FX}</style>;
}

// ─── Aurora backdrop ─────────────────────────────────────────────────────────
// Scoped animated backdrop — aurora amber blobs + drifting blueprint grid +
// vignette. position:absolute so it fills only the page's content column and
// never bleeds under the app sidebar. Purely decorative; pointer-events:none.
export function Aurora({ soft = true }: { soft?: boolean }) {
  const grid =
    'linear-gradient(rgba(245,158,11,0.05) 1px, transparent 1px),' +
    'linear-gradient(90deg, rgba(245,158,11,0.05) 1px, transparent 1px)';
  const gridMask = 'radial-gradient(120% 78% at 50% 10%, #000 22%, transparent 74%)';
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 80% at 50% -10%, rgba(245,158,11,0.09), transparent 55%)' }} />
      <div style={{ position: 'absolute', width: 640, height: 640, left: '-18%', top: '-28%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.17), transparent 62%)', filter: 'blur(34px)', animation: 'pmAur1 18s ease-in-out infinite', opacity: soft ? 0.5 : 0.85 }} />
      <div style={{ position: 'absolute', width: 540, height: 540, right: '-12%', top: '-4%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(217,119,6,0.15), transparent 60%)', filter: 'blur(40px)', animation: 'pmAur2 22s ease-in-out infinite', opacity: soft ? 0.42 : 0.75 }} />
      <div style={{ position: 'absolute', width: 520, height: 520, left: '30%', bottom: '-30%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(251,191,36,0.10), transparent 60%)', filter: 'blur(44px)', animation: 'pmAur3 25s ease-in-out infinite', opacity: soft ? 0.38 : 0.6 }} />
      <div style={{ position: 'absolute', inset: -24, backgroundImage: grid, backgroundSize: '34px 34px', animation: 'pmGridPan 10s linear infinite', maskImage: gridMask, WebkitMaskImage: gridMask, opacity: soft ? 0.3 : 0.5 }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(130% 100% at 50% -6%, transparent 52%, rgba(2,4,8,0.55))' }} />
    </div>
  );
}

// ─── PremiumSurface ──────────────────────────────────────────────────────────
// The relative wrapper that carries the Aurora + FX for a whole page. Content
// sits above the backdrop at zIndex 1.
export function PremiumSurface({
  children,
  maxWidth = 1600,
  soft = true,
  pad = '40px 32px 72px',
}: {
  children: React.ReactNode;
  maxWidth?: number;
  soft?: boolean;
  pad?: string;
}) {
  return (
    <div className="pmRoot" style={{ position: 'relative', overflow: 'hidden', minHeight: 'calc(100vh - 56px)' }}>
      <PremiumFX />
      <Aurora soft={soft} />
      <div style={{ position: 'relative', zIndex: 1, padding: pad, maxWidth, margin: '0 auto' }}>
        {children}
      </div>
    </div>
  );
}

// ─── ModuleHero ──────────────────────────────────────────────────────────────
export function ModuleHero({
  eyebrow,
  eyebrowIcon,
  aux,
  title,
  accent,
  subtitle,
  actions,
  align = 'left',
  style,
}: {
  eyebrow?: string;
  eyebrowIcon?: React.ReactNode;
  aux?: React.ReactNode;
  title: React.ReactNode;
  accent?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  align?: 'left' | 'center';
  style?: React.CSSProperties;
}) {
  const centered = align === 'center';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: centered ? 'center' : 'flex-end',
        flexDirection: centered ? 'column' : 'row',
        justifyContent: 'space-between',
        gap: 18,
        flexWrap: 'wrap',
        marginBottom: 30,
        textAlign: centered ? 'center' : 'left',
        ...style,
      }}
    >
      <div style={{ minWidth: 0, maxWidth: centered ? 720 : undefined }}>
        {(eyebrow || aux) && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap', justifyContent: centered ? 'center' : 'flex-start' }}>
            {eyebrow && (
              <span
                style={{
                  animation: 'pmRise .5s ease both',
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '6px 14px', borderRadius: 999,
                  background: 'linear-gradient(90deg, rgba(245,158,11,0.16), rgba(245,158,11,0.05))',
                  border: `1px solid ${A45}`, color: GOLD_HI,
                  fontSize: 11, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase',
                  boxShadow: '0 0 30px -10px rgba(245,158,11,0.5)',
                }}
              >
                {eyebrowIcon}{eyebrow}
              </span>
            )}
            {aux}
          </div>
        )}
        <h1 className="pmH1" style={{ animation: 'pmRise .55s ease .05s both', color: WHITE }}>
          {title}
          {accent != null && accent !== '' && (
            <>
              {' '}
              <span
                className="pmShine"
                style={{
                  background: `linear-gradient(100deg, ${GOLD} 6%, ${GOLD_HI} 38%, #FDE68A 56%, ${GOLD} 92%)`,
                  WebkitBackgroundClip: 'text', backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent', color: 'transparent',
                }}
              >
                {accent}
              </span>
            </>
          )}
        </h1>
        {subtitle && (
          <p style={{ animation: 'pmRise .6s ease .1s both', color: 'rgba(255,255,255,0.66)', fontSize: 15, margin: '12px 0 0', maxWidth: 620, lineHeight: 1.6, marginInline: centered ? 'auto' : undefined }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div style={{ animation: 'pmRise .6s ease .12s both', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: centered ? 'center' : 'flex-end', paddingBottom: centered ? 0 : 4 }}>
          {actions}
        </div>
      )}
    </div>
  );
}

// ─── IconChip ────────────────────────────────────────────────────────────────
export function IconChip({ children, size = 40 }: { children: React.ReactNode; size?: number }) {
  return (
    <span
      className="pmChip"
      style={{
        flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: size, height: size, borderRadius: Math.round(size * 0.28),
        background: 'linear-gradient(150deg, rgba(245,158,11,0.18), rgba(245,158,11,0.05))',
        border: `1px solid ${A30}`, boxShadow: `0 0 0 3px ${A08}, inset 0 1px 0 rgba(255,255,255,0.08)`,
        transition: 'box-shadow .2s ease',
      }}
    >
      {children}
    </span>
  );
}

// ─── StatCard (premium) ──────────────────────────────────────────────────────
export function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
  onClick,
  href,
  interactive: forceInteractive,
  delay = 0,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: string;
  onClick?: () => void;
  href?: string;
  interactive?: boolean;
  delay?: number;
}) {
  const interactive = !!(onClick || href || forceInteractive);
  const numberColor = accent || WHITE;
  const inner = (
    <div
      onClick={onClick}
      className={interactive ? 'pmHover' : undefined}
      style={{
        position: 'relative', overflow: 'hidden',
        background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16,
        padding: '18px 20px',
        boxShadow: `0 14px 34px -24px ${A30}, inset 0 1px 0 rgba(255,255,255,0.06)`,
        cursor: interactive ? 'pointer' : 'default',
        animation: `pmRise .5s ease ${delay.toFixed(2)}s both`,
        height: '100%',
      }}
    >
      {/* left accent bar */}
      <div aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: `linear-gradient(180deg, ${numberColor}, transparent)`, opacity: 0.85 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 14 }}>
        <IconChip size={38}>{icon}</IconChip>
        <span style={{ fontSize: 11, color: MUTED, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, color: numberColor, letterSpacing: '-0.02em', lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub != null && <div style={{ fontSize: 12.5, color: FAINT, marginTop: 6 }}>{sub}</div>}
    </div>
  );
  if (href) {
    // Link is intentionally not imported here to keep the kit routing-agnostic;
    // callers wrap with their own <Link>. A plain <a> keeps it self-contained.
    return <a href={href} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>{inner}</a>;
  }
  return inner;
}

// ─── SectionCard ─────────────────────────────────────────────────────────────
export function SectionCard({
  title,
  subtitle,
  icon,
  action,
  children,
  accent = GOLD,
  flush = false,
  style,
  bodyStyle,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  accent?: string;
  flush?: boolean;
  style?: React.CSSProperties;
  bodyStyle?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        position: 'relative', overflow: 'hidden',
        background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16,
        boxShadow: `0 24px 48px -32px ${A22}, inset 0 1px 0 rgba(255,255,255,0.06)`,
        ...style,
      }}
    >
      {(title || icon || action) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: `1px solid rgba(255,255,255,0.06)` }}>
          {icon && <IconChip size={34}>{icon}</IconChip>}
          <div style={{ minWidth: 0, flex: 1 }}>
            {title && <div style={{ fontWeight: 800, fontSize: 15.5, color: WHITE, letterSpacing: '-0.01em', lineHeight: 1.25 }}>{title}</div>}
            {subtitle && <div style={{ fontSize: 12.5, color: MUTED, marginTop: 2 }}>{subtitle}</div>}
          </div>
          {action && <div style={{ flex: '0 0 auto' }}>{action}</div>}
        </div>
      )}
      <div style={{ padding: flush ? 0 : 20, ...bodyStyle }}>{children}</div>
      {/* top accent hairline */}
      <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 1, background: `linear-gradient(90deg, transparent, ${accent}, transparent)`, opacity: 0.35 }} />
    </div>
  );
}

// ─── PremiumEmpty ────────────────────────────────────────────────────────────
export function PremiumEmpty({
  icon,
  title,
  description,
  action,
  tone = 'default',
  compact = false,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  tone?: 'default' | 'error';
  compact?: boolean;
}) {
  const ring = tone === 'error' ? 'rgba(239,68,68,0.5)' : A45;
  const halo = tone === 'error' ? 'rgba(239,68,68,0.22)' : A22;
  const glow = tone === 'error' ? 'rgba(239,68,68,0.35)' : 'rgba(245,158,11,0.35)';
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
        padding: compact ? '32px 24px' : '52px 24px',
      }}
    >
      <div
        style={{
          position: 'relative', display: 'inline-flex', width: compact ? 66 : 84, height: compact ? 66 : 84,
          borderRadius: '50%', alignItems: 'center', justifyContent: 'center', marginBottom: 18,
          background: `radial-gradient(circle, ${halo}, rgba(245,158,11,0.02))`,
          border: `1px solid ${ring}`,
          boxShadow: `0 0 0 6px ${tone === 'error' ? 'rgba(239,68,68,0.07)' : A08}, 0 0 44px -10px ${glow}`,
        }}
      >
        <span aria-hidden style={{ position: 'absolute', inset: -1, borderRadius: '50%', border: `1px solid ${ring}`, animation: 'pmRing 3s ease-out infinite' }} />
        {icon}
      </div>
      <div style={{ fontSize: compact ? 16 : 18, fontWeight: 800, color: WHITE, marginBottom: 8, letterSpacing: '-0.01em' }}>{title}</div>
      {description && <div style={{ fontSize: 13.5, color: MUTED, lineHeight: 1.55, maxWidth: 400, marginBottom: action ? 22 : 0 }}>{description}</div>}
      {action}
    </div>
  );
}

// ─── PremiumButton (link-agnostic) ───────────────────────────────────────────
// A gold gradient CTA styled to match Takeoff. Renders as a <button> unless the
// caller wraps it. Kept here so pages don't re-derive the same gradient.
export const goldButtonStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  padding: '11px 20px', borderRadius: 12, border: 'none', cursor: 'pointer',
  background: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD} 60%, var(--brand-primary-hover))`, color: '#241500',
  fontWeight: 800, fontSize: 13.5, letterSpacing: '0.01em', textDecoration: 'none',
  boxShadow: '0 4px 14px var(--brand-primary-25), inset 0 1px 0 rgba(255,255,255,0.35)',
};

export const ghostButtonStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  padding: '11px 18px', borderRadius: 12, cursor: 'pointer',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))', color: 'rgba(255,255,255,0.82)',
  border: `1px solid ${BORDER}`, fontWeight: 700, fontSize: 13.5, textDecoration: 'none',
};

export const goldOutlineButtonStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  padding: '11px 18px', borderRadius: 12, cursor: 'pointer',
  background: A12, color: GOLD_HI, border: `1px solid ${A45}`,
  fontWeight: 800, fontSize: 13.5, textDecoration: 'none',
};

// ─── SmartCreate kit ─────────────────────────────────────────────────────────
// Shared anatomy for every add/create flow: the screen walks in already knowing
// the project (contract, COs, prior records) and shows the user what the system
// pre-filled and what happens after submit. No create screen ships a bare form.

/** Tiny gold pill marking a field the system filled from live project data. */
export function AutoChip({ label = 'AUTO' }: { label?: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', marginLeft: 8, padding: '1.5px 7px',
      borderRadius: 999, background: `linear-gradient(180deg, ${A22}, ${A08})`, border: `1px solid ${A45}`,
      color: GOLD_HI, fontSize: 8.5, fontWeight: 900, letterSpacing: '0.09em',
      verticalAlign: 'middle', lineHeight: 1.6,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
    }}>{label}</span>
  );
}

/** Dense full-width stat band for the top of create screens — kills dead space
 *  by surfacing what the system already knows (sums, counts, prior records). */
export function StatStrip({ items }: {
  items: { label: string; value: React.ReactNode; sub?: React.ReactNode; accent?: string; icon?: React.ReactNode }[];
}) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(150px, 1fr))`, gap: 1,
      background: BORDER, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden',
      marginBottom: 20,
    }}>
      {items.map((it, i) => (
        <div key={i} className="pmTile" style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015)), #101011', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)', padding: '13px 16px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 800, color: FAINT, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 5, whiteSpace: 'nowrap' }}>
            {it.icon}{it.label}
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, color: it.accent || WHITE, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums', textShadow: it.accent ? '0 0 20px currentColor' : undefined, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.value}</div>
          {it.sub && <div style={{ fontSize: 11, color: MUTED, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.sub}</div>}
        </div>
      ))}
    </div>
  );
}

/** Vertical "what happens next" pipeline for the create-screen context rail:
 *  numbered gold nodes with a connector line, so the user sees the downstream
 *  automation (approvals, waivers, budget sync) before they ever submit. */
export function FlowSteps({ title = 'What happens next', steps }: {
  title?: string;
  steps: { title: string; desc?: string; done?: boolean }[];
}) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 900, color: FAINT, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 14 }}>{title}</div>
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', left: 10, top: 8, bottom: 14, width: 1, background: `linear-gradient(180deg, ${A45}, ${A18} 55%, transparent)` }} />
        {steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, marginBottom: i === steps.length - 1 ? 0 : 16, position: 'relative' }}>
            <div style={{
              width: 21, height: 21, borderRadius: 999, flexShrink: 0, zIndex: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: s.done ? `linear-gradient(180deg, ${GOLD_HI}, ${GOLD} 62%, var(--brand-primary-hover))` : '#101011',
              border: s.done ? 'none' : `1px solid ${A45}`,
              boxShadow: s.done ? `inset 0 1px 0 rgba(255,255,255,0.35), 0 0 14px -2px ${A45}` : `0 0 0 3px ${A08}`,
              color: s.done ? '#241500' : GOLD_HI, fontSize: 10, fontWeight: 900,
            }}>{s.done ? '✓' : i + 1}</div>
            <div style={{ minWidth: 0, paddingTop: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: WHITE, lineHeight: 1.35 }}>{s.title}</div>
              {s.desc && <div style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.5, marginTop: 2 }}>{s.desc}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Label/value row for context rails and snapshot cards. */
export function InsightRow({ label, value, accent, strong }: {
  label: React.ReactNode; value: React.ReactNode; accent?: string; strong?: boolean;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '5.5px 0' }}>
      <span style={{ fontSize: 12, color: MUTED, whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ fontSize: strong ? 15 : 12.5, fontWeight: strong ? 800 : 700, color: accent || WHITE, textAlign: 'right', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
    </div>
  );
}
