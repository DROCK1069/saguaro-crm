// SINGLE SOURCE OF TRUTH for CSI division color — CANONICAL copy: D:/Saguaro-Field (mobile) lib/takeoff/divisions.ts; the web repo carries a byte-exact mirror (scripts/sync-takeoff-engine.mjs).
// Drives: hero accents, trade-breakdown bar segments, legend dots, division headers, PDF.
// Reuses the exact hexes already in the Heatmap's SYSTEM_COLORS / WALL_MATERIALS
// (teal #0D9488, orange #F97316, blue #2F6BFF, tan #C9A96A) so the two tools read
// as one family. Keep this identical across web + mobile.
export const DIVISION_COLORS: Record<string, string> = {
  '01': '#8094B0', // General Requirements — slate
  '02': '#B45309', // Existing Conditions / Demo — burnt amber
  '03': '#C9A96A', // Concrete — desert tan
  '04': '#C2410C', // Masonry — brick
  '05': '#9CA3AF', // Metals — steel
  '06': '#B45309', // Wood & Plastics — timber
  '07': '#0D9488', // Thermal & Moisture — teal
  '08': '#8FC4F0', // Openings (doors/windows) — glass blue
  '09': '#A855F7', // Finishes — violet
  '10': '#EAB308', // Specialties — yellow
  '11': '#6366F1', // Equipment — indigo
  '12': '#EC4899', // Furnishings — pink
  '21': '#EF4444', // Fire Suppression — red
  '22': '#2F6BFF', // Plumbing — blue
  '23': '#16C060', // HVAC — green
  '26': '#F97316', // Electrical — orange
  '27': '#FBBF24', // Communications — sky
  '28': '#E5484D', // Electronic Safety/Security — alarm red
  '31': '#A9884F', // Earthwork — earth
  '32': '#84CC16', // Exterior Improvements — lime
  '33': '#F59E0B', // Utilities — cyan
};

/** Color for a CSI code/division. Accepts a full code ('26', '26 05 00', '09 29 00') or a 2-digit division. */
export const divColor = (code: string) => DIVISION_COLORS[(code || '00').replace(/\D/g, '').slice(0, 2)] || '#94a3b8';

/** Human division name for a code, for legends/headers when no name is stored. */
export const DIVISION_NAMES: Record<string, string> = {
  '01': 'General Requirements', '02': 'Existing Conditions', '03': 'Concrete', '04': 'Masonry',
  '05': 'Metals', '06': 'Wood & Plastics', '07': 'Thermal & Moisture', '08': 'Openings',
  '09': 'Finishes', '10': 'Specialties', '11': 'Equipment', '12': 'Furnishings',
  '21': 'Fire Suppression', '22': 'Plumbing', '23': 'HVAC', '26': 'Electrical',
  '27': 'Communications', '28': 'Electronic Safety', '31': 'Earthwork', '32': 'Exterior Improvements',
  '33': 'Utilities',
};
export const divName = (code: string) => DIVISION_NAMES[(code || '00').replace(/\D/g, '').slice(0, 2)] || '';
