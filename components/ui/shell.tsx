import React from 'react';

// ─── Design Tokens ────────────────────────────────────────────────────────────
// Warm neutral palette — premium construction CRM direction.
// Surfaces, hairlines, amber accent, status colours.
export const T = {
  bg: '#FAFAF9',
  surface: '#FAFAF9',
  surface2: '#FFFFFF',
  elevated: '#FFFFFF',
  border: '#EAE8E4',
  borderSubtle: 'rgba(28,25,23,0.06)',
  borderStrong: 'rgba(28,25,23,0.14)',
  borderGold: 'rgba(200,136,28,0.35)',
  gold: '#C8881C',
  goldBright: '#E8B420',
  goldDim: '#FBF3E2',
  goldMid: 'rgba(200,136,28,0.22)',
  white: '#1C1917',
  muted: '#57534E',
  faint: '#8A847E',
  green: '#15803D',
  greenDim: '#EAF5EE',
  red: '#B42318',
  redDim: '#FBEDEC',
  amber: '#B9791A',
  amberDim: '#FBF3E2',
  blue: '#1D4ED8',
  blueDim: '#EAF0FB',
  shadowSm: '0 1px 2px rgba(28,25,23,.05)',
  shadowMd: '0 1px 3px rgba(28,25,23,.07), 0 1px 2px rgba(28,25,23,.05)',
  shadowLg: '0 12px 32px rgba(28,25,23,.10), 0 2px 6px rgba(28,25,23,.05)',
} as const;

// ─── PageWrap ─────────────────────────────────────────────────────────────────
export function PageWrap({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: T.bg,
        color: T.white,
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: 14,
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
// Not a floating box — a flat section baked onto the page. No fill, no shadow,
// no radius. Structure comes from the header rule and internal hairlines.
export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: 'transparent',
        border: 'none',
        boxShadow: 'none',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        padding: '0 0 12px',
        borderBottom: `2px solid ${T.white}`,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 4,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function CardBody({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ padding: '18px 0 0', ...style }}>
      {children}
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
type BadgeColor = 'gold' | 'green' | 'red' | 'amber' | 'blue' | 'muted';

const badgeStyles: Record<BadgeColor, { bg: string; color: string; border: string }> = {
  gold:  { bg: T.goldDim,  color: T.gold,  border: T.borderGold },
  green: { bg: T.greenDim, color: T.green, border: 'rgba(21,128,61,0.25)' },
  red:   { bg: T.redDim,   color: T.red,   border: 'rgba(180,35,24,0.25)' },
  amber: { bg: T.amberDim, color: T.amber, border: 'rgba(185,121,26,0.25)' },
  blue:  { bg: T.blueDim,  color: T.blue,  border: 'rgba(29,78,216,0.25)' },
  muted: { bg: T.bg,       color: T.faint, border: T.border },
};

export function Badge({ label, color = 'muted' }: { label: string; color?: BadgeColor }) {
  const s = badgeStyles[color];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 10px',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: s.color,
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
export function StatCard({ icon, label, value, sub }: { icon: string; label: string; value: string; sub?: string }) {
  return (
    <div
      style={{
        background: 'transparent',
        borderTop: `2px solid ${T.borderStrong}`,
        padding: '16px 0 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: T.faint,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
          color: T.white,
          letterSpacing: '-0.03em',
          lineHeight: 1.05,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: T.faint, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────────────
export function SectionHeader({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: T.white, letterSpacing: '-0.02em', lineHeight: 1.2 }}>{title}</h2>
        {sub && <p style={{ margin: '6px 0 0', fontSize: 13.5, color: T.muted, lineHeight: 1.5 }}>{sub}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ─── Btn ──────────────────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'ghost' | 'danger';
type BtnSize = 'sm' | 'md';

const btnBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  fontWeight: 600,
  cursor: 'pointer',
  border: 'none',
  borderRadius: 10,
  transition: 'opacity 0.15s, background 0.15s, border-color 0.15s',
  fontFamily: 'inherit',
  letterSpacing: '0.01em',
  whiteSpace: 'nowrap',
};

const btnVariants: Record<BtnVariant, React.CSSProperties> = {
  primary: {
    background: 'linear-gradient(135deg, #E8B420, #C8881C)',
    color: '#FFFFFF',
    boxShadow: '0 4px 14px rgba(200,136,28,.28)',
  },
  ghost: {
    background: T.elevated,
    color: T.white,
    border: `1px solid ${T.border}`,
  },
  danger: {
    background: T.redDim,
    color: T.red,
    border: `1px solid rgba(180,35,24,0.25)`,
  },
};

const btnSizes: Record<BtnSize, React.CSSProperties> = {
  sm: { padding: '6px 14px', fontSize: 12 },
  md: { padding: '9px 18px', fontSize: 13 },
};

export function Btn({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled,
  style,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: BtnVariant;
  size?: BtnSize;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...btnBase,
        ...btnVariants[variant],
        ...btnSizes[size],
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// ─── ProgressBar ─────────────────────────────────────────────────────────────
export function ProgressBar({
  pct,
  color,
  height = 6,
}: {
  pct: number;
  color?: string;
  height?: number;
}) {
  const clampedPct = Math.max(0, Math.min(100, pct));
  return (
    <div
      style={{
        width: '100%',
        height,
        background: 'rgba(28,25,23,0.06)',
        borderRadius: 999,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${clampedPct}%`,
          background: color || T.gold,
          borderRadius: 999,
          transition: 'width 0.4s ease',
        }}
      />
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────
type TableHeader = string | { label: string; align: 'left' | 'right' };

function resolveHeader(h: TableHeader): { label: string; align: 'left' | 'right' } {
  if (typeof h === 'string') return { label: h, align: 'left' };
  return h;
}

export function Table({ headers, rows }: { headers: TableHeader[]; rows: React.ReactNode[][] }) {
  const resolved = headers.map(resolveHeader);
  return (
    <div style={{ overflowX: 'auto', width: '100%' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {resolved.map((h, i) => (
              <th
                key={i}
                style={{
                  padding: '0 12px 10px',
                  textAlign: h.align,
                  color: T.faint,
                  fontWeight: 700,
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  borderBottom: `2px solid ${T.white}`,
                  background: 'transparent',
                  whiteSpace: 'nowrap',
                }}
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              style={{ borderBottom: `1px solid ${T.border}` }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(200,136,28,0.05)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLTableRowElement).style.background = '';
              }}
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  style={{
                    padding: '10px 12px',
                    color: T.white,
                    verticalAlign: 'middle',
                    textAlign: ci < resolved.length ? resolved[ci].align : 'left',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={headers.length}
                style={{ padding: '40px 12px', textAlign: 'center', color: T.faint, fontSize: 13 }}
              >
                No data available
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────
export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '48px 24px',
        gap: 8,
      }}
    >
      {icon && (
        <div style={{ fontSize: 32, marginBottom: 4, color: T.faint }}>{icon}</div>
      )}
      <div style={{ fontSize: 16, fontWeight: 700, color: T.white }}>{title}</div>
      {subtitle && (
        <div style={{ fontSize: 13, color: T.faint, maxWidth: 320, lineHeight: 1.5 }}>{subtitle}</div>
      )}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}
