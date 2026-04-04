/**
 * Saguaro CRM — Centralized Design Tokens
 * Import these instead of hardcoding colors/spacing in every file.
 */

/* ── Colors ────────────────────────────────────────────────────────── */
export const colors = {
  gold:       '#D4A017',
  goldLight:  '#F0C040',
  goldDim:    'rgba(212,160,23,.12)',
  goldBorder: 'rgba(212,160,23,.25)',
  goldHover:  'rgba(212,160,23,.18)',
  goldActive: 'rgba(212,160,23,.25)',

  dark:       '#0d1117',
  darkAlt:    '#0a0e14',
  raised:     '#161b22',
  raisedAlt:  '#1c2333',
  surface:    '#1f2c3e',

  border:     '#263347',
  borderDim:  'rgba(38,51,71,.5)',

  text:       '#e8edf8',
  textMuted:  '#8fa3c0',
  textDim:    '#546a8a',
  textFaint:  '#3a4f6a',

  green:      '#22c55e',
  red:        '#ef4444',
  orange:     '#f59e0b',
  blue:       '#3b82f6',

  white:      '#ffffff',
  black:      '#000000',
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
  sm:   '0 1px 2px rgba(0,0,0,.3)',
  md:   '0 4px 12px rgba(0,0,0,.4)',
  lg:   '0 8px 32px rgba(0,0,0,.5)',
  xl:   '0 16px 48px rgba(0,0,0,.6)',
  glow: `0 0 20px rgba(212,160,23,.15)`,
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
