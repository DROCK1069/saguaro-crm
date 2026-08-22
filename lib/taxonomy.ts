// lib/taxonomy.ts
// THE single taxonomy module — every vertical / sector / trade / CSI-division
// dropdown in the app derives its options from HERE.
//
// Sources of truth (imported or unified, never forked):
//   - CSI divisions + canonical trade lists  → lib/construction-intelligence.ts
//     (re-exported below so pages can import everything from one place)
//   - Catalog trade verticals               → previously app/app/catalog/page.tsx
//     (VERTICAL_COST_CODE lifted here verbatim; the catalog page imports it back)
//   - New Project market sectors            → previously app/app/projects/new/page.tsx
//     (SECTORS lifted here verbatim; the New Project page imports it back)
//
// Conflict rule: where the same market name exists in more than one source
// (e.g. 'Concrete' is both a catalog vertical and CSI division 03), the
// CATALOG VERTICALS spelling is canonical — divisions always render with their
// numeric code ("Div 03 — Concrete") so the two never collide in one list.

import { CSI_DIVISIONS, SUB_TRADES, SUB_TRADES_BY_DIVISION } from './construction-intelligence';

export { CSI_DIVISIONS, SUB_TRADES, SUB_TRADES_BY_DIVISION };
export { SHEET_DISCIPLINES } from './construction-intelligence';

// ─── Option shapes (consumed by components/ui/Select.tsx and ListToolbar) ────

export interface SelectOption {
  value: string;
  label: string;
  /** Optional count badge — rendered as "Label (N)" in dropdown faces. */
  count?: number;
}

export interface SelectGroup {
  group: string;
  options: SelectOption[];
}

const opt = (value: string, label?: string): SelectOption => ({ value, label: label ?? value });

// ─── Market sectors (New Project page — Procore-style sector differentiation) ─

export interface Sector {
  key: string;
  label: string;
  /** DB project_type categories this sector maps to. */
  cats: string[];
  /** Building types included beyond the category mapping. */
  extraBts?: string[];
  /** Compliance defaults for public-sector work (prevailing wage / public agency). */
  flags?: { pw: string; pub: string };
}

export const SECTORS: Sector[] = [
  { key: 'residential',   label: 'Residential',    cats: ['residential', 'multifamily', 'addition', 'remodel'] },
  { key: 'commercial',    label: 'Commercial',     cats: ['commercial', 'remodel', 'mixed_use'] },
  { key: 'industrial',    label: 'Industrial',     cats: ['industrial'] },
  { key: 'government',    label: 'Government',     cats: ['government'], flags: { pw: 'Yes — Davis-Bacon', pub: 'Yes — Public Agency' } },
  { key: 'healthcare',    label: 'Healthcare',     cats: ['healthcare'] },
  { key: 'education',     label: 'Education',      cats: ['education'], flags: { pw: 'Yes — State Law', pub: 'Yes — Public Agency' } },
  { key: 'infrastructure', label: 'Infrastructure', cats: ['industrial'], extraBts: ['Civil / Infrastructure', 'Parking Structure', 'Other'], flags: { pw: 'Yes — Davis-Bacon', pub: 'Yes — Public Agency' } },
  { key: 'mixed',         label: 'Mixed-Use',      cats: ['mixed_use', 'commercial', 'multifamily'] },
];

// ─── Catalog trade verticals (Materials Catalog) ─────────────────────────────

/** Vertical -> CSI cost code, so catalog POs commit into the right budget line. */
export const VERTICAL_COST_CODE: Record<string, string> = {
  'Low Voltage & Networking': '27 00 00', 'Electrical': '26 00 00', 'Plumbing': '22 00 00',
  'HVAC': '23 00 00', 'Flooring & Carpet': '09 00 00', 'Drywall': '09 00 00', 'Paint': '09 00 00',
  'Framing & Lumber': '06 00 00', 'Concrete': '03 00 00', 'Roofing': '07 00 00',
  'Doors & Windows': '08 00 00', 'Insulation': '07 00 00',
};

/** The catalog's vertical sub-industry names — canonical spellings platform-wide. */
export const CATALOG_VERTICALS: string[] = Object.keys(VERTICAL_COST_CODE);

// ─── VERTICALS — the platform's vertical sub-industries, grouped ─────────────

/**
 * The unified vertical picture: market sectors (who the work is for), catalog
 * trade verticals (what gets bought and installed), and CSI divisions (how the
 * work is coded). One grouped list, ready for StandardSelect.
 */
export const VERTICALS: SelectGroup[] = [
  { group: 'Market Sectors', options: SECTORS.map((s) => opt(s.key, s.label)) },
  { group: 'Trade Verticals', options: CATALOG_VERTICALS.map((v) => opt(v)) },
  {
    group: 'CSI Divisions',
    options: Object.entries(CSI_DIVISIONS).map(([code, d]) => opt(code, `Div ${code} — ${d.name}`)),
  },
];

// ─── Option helpers ──────────────────────────────────────────────────────────

const DIVISION_TRADE_SET = new Set(SUB_TRADES_BY_DIVISION.flatMap((d) => d.trades));
const EXTRA_TRADES = SUB_TRADES.filter((t) => !DIVISION_TRADE_SET.has(t));

/**
 * Canonical trade picker options: CSI division groups plus the specialty and
 * site markets outside them. Every trade dropdown draws from this.
 */
export function tradeOptions(): SelectGroup[] {
  return [
    ...SUB_TRADES_BY_DIVISION.map((d) => ({
      group: `Div ${d.division} — ${d.name}`,
      options: d.trades.map((t) => opt(t)),
    })),
    { group: 'Specialty & Site Markets', options: EXTRA_TRADES.map((t) => opt(t)) },
  ];
}

/** Flat canonical trade options (the full SUB_TRADES list, alphabetized at source). */
export function tradeOptionsFlat(): SelectOption[] {
  return SUB_TRADES.map((t) => opt(t));
}

/** The unified grouped vertical list (sectors + trade verticals + divisions). */
export function verticalOptions(): SelectGroup[] {
  return VERTICALS;
}

/** Market sector options (New Project sector chooser and friends). */
export function sectorOptions(): SelectOption[] {
  return SECTORS.map((s) => opt(s.key, s.label));
}

/** CSI MasterFormat division options — value is the two-digit division code. */
export function csiDivisionOptions(): SelectOption[] {
  return Object.entries(CSI_DIVISIONS).map(([code, d]) => opt(code, `Div ${code} — ${d.name}`));
}
