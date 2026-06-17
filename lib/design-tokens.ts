/**
 * Saguaro CRM — Centralized Design Tokens
 * Import these instead of hardcoding colors/spacing in every file.
 */

/* ── Colors ────────────────────────────────────────────────────────── */
export const colors = {
  gold:       '#C8881C',
  goldLight:  '#E0A030',
  goldDim:    'rgba(200,136,28,.12)',
  goldBorder: 'rgba(200,136,28,.25)',
  goldHover:  'rgba(200,136,28,.18)',
  goldActive: 'rgba(200,136,28,.25)',

  // Apple LIGHT ramp — matches the (light) mobile app: iOS grouped page
  // background #F2F2F7 with #FFFFFF cards/panels and #F2F2F7 grouped insets.
  dark:       '#F2F2F7',
  darkAlt:    '#FFFFFF',
  raised:     '#FFFFFF',
  raisedAlt:  '#F2F2F7',
  surface:    '#FFFFFF',

  border:     '#E5E5EA',
  borderDim:  'rgba(0,0,0,0.06)',

  text:       '#1C1C1E',
  textMuted:  '#6E6E73',
  textDim:    '#AEAEB2',
  textFaint:  '#C7C7CC',

  green:      '#34C759',
  red:        '#FF3B30',
  orange:     '#FF9500',
  blue:       '#007AFF',

  white:      '#ffffff',
  black:      '#000000',
} as const;

/* ── Brand palette — sampled directly from the Saguaro logo artwork ────
 * Use these for brand moments (hero accents, sunset gradients, PDF
 * letterheads, section dividers, the dark field-app surfaces). The neutral
 * UI chrome stays on `colors` above; `brand` is the desert identity layer. */
export const brand = {
  gold:       '#E8B84B', // wordmark / primary highlight
  sunset:     '#F2A93B', // bright sun
  ember:      '#E8732B', // sunset orange
  terracotta: '#A8431C', // canyon rock
  canyon:     '#4A1E08', // deep shadow / dark text on warm fills
  cactus:     '#2E8B3D', // saguaro green (positive / accent, sparing)
  night:      '#0B1220', // field-app dark surface
  sand:       '#F7F2E8', // warm light surface
} as const;

/* ── Spacing (4px grid) ────────────────────────────────────────────── */
export const space = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
} as const;

/* ── Typography ────────────────────────────────────────────────────── */
export const font = {
  family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  mono: '"SF Mono", "Fira Code", "Cascadia Code", monospace',

  size: {
    xs:  '11px',
    sm:  '12px',
    md:  '13px',
    lg:  '14px',
    xl:  '16px',
    '2xl': '18px',
    '3xl': '22px',
    '4xl': '28px',
  },
  weight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    black: 800,
  },
} as const;

/* ── Radius ────────────────────────────────────────────────────────── */
export const radius = {
  sm: 4,
  md: 6,
  lg: 8,
  xl: 10,
  '2xl': 12,
  full: 9999,
} as const;

/* ── Shadows ───────────────────────────────────────────────────────── */
export const shadow = {
  sm:   '0 1px 2px rgba(0,0,0,.06)',
  md:   '0 4px 14px rgba(0,0,0,.08)',
  lg:   '0 16px 44px rgba(0,0,0,.10)',
  xl:   '0 24px 60px rgba(0,0,0,.12)',
  glow: `0 0 20px rgba(200,136,28,.15)`,
} as const;

/* ── Sidebar ───────────────────────────────────────────────────────── */
export const sidebar = {
  width: 240,
  widthCollapsed: 64,
  headerHeight: 56,
  itemHeight: 36,
  sectionGap: 24,
} as const;

/* ── Breakpoints ───────────────────────────────────────────────────── */
export const breakpoint = {
  mobile: 768,
  tablet: 1024,
  desktop: 1280,
  wide: 1536,
} as const;

/* ── Z-Index Scale ─────────────────────────────────────────────────── */
export const z = {
  sidebar: 50,
  topbar: 60,
  dropdown: 100,
  modal: 200,
  overlay: 250,
  toast: 300,
  tooltip: 400,
} as const;
