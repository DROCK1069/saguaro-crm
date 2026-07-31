/**
 * flip-light.mjs — deterministic dark→Apple-light codemod.
 *
 * Replaces hex/rgba SURFACE, BORDER, TEXT, DIM and GOLD values with the
 * Apple light palette. Accent colors (red/green/blue/purple/amber) are left
 * untouched — they read fine on light. String-only replacement inside existing
 * quotes => cannot introduce syntax errors.
 *
 * Verified safe for these files (see investigation):
 *   - near-white TEXT hexes are never used as backgrounds
 *   - navy BORDER hexes are never used as color/fill/stroke
 *   - dark SURFACE hexes used as `color:` are button-labels-on-gold -> become
 *     near-white on gold (still readable)
 *
 * Usage: node scripts/flip-light.mjs <fileListPath>
 */
import fs from 'node:fs';

const listPath = process.argv[2] || '/tmp/flip_files.txt';
const files = fs.readFileSync(listPath, 'utf8').split('\n').map(s => s.trim()).filter(Boolean);

// ── Apple light targets ────────────────────────────────────────────────────
const PAGE = '#F2F2F7';   // grouped page background
const CARD = '#FFFFFF';   // raised cards / panels
const BORDER = '#E5E5EA'; // hairline
const TEXT = '#1C1C1E';   // primary text
const DIM = '#6E6E73';    // secondary text
const GOLD = '#C8881C';   // brand gold
const GOLD2 = '#E0A030';  // gold gradient light end

// hex (lowercase, no #) -> target. Case-insensitive match on source.
const HEX = {
  // page / deep backgrounds
  '0d1117': PAGE, '07101c': PAGE, '060c15': PAGE, '080f1a': PAGE,
  '0f1419': PAGE, '09111a': PAGE, '0a1117': PAGE, '060a13': PAGE,
  '0a0e1a': PAGE, '0e1726': PAGE, '0b1220': PAGE,
  // cards / panels / raised
  '1f2c3e': CARD, '0d1d2e': CARD, '0f172a': CARD, '0a1628': CARD,
  '0a1929': CARD, '0b1623': CARD, '1a2535': CARD, '151f2e': CARD,
  '1a1f2e': CARD, '1a2840': CARD, '161f2e': CARD, '111827': CARD,
  '1a2332': CARD, '0d1929': CARD, '07101b': CARD,
  // borders
  '1e3a5f': BORDER, '263347': BORDER, '1e293b': BORDER,
  // near-white text -> dark
  'e8edf8': TEXT, 'f0f4ff': TEXT, 'f8fafc': TEXT, 'e2e8f0': TEXT,
  // dim / muted text
  '8baac8': DIM, '8fa3c0': DIM, 'cbd5e1': DIM, '94a3b8': DIM,
  '4a5f7a': DIM, '64748b': DIM,
  // gold normalization (brand cohesion)
  'd4a017': GOLD, 'f0c040': GOLD2,
};

// rgba dark overlays -> light equivalents (sticky bars, scrims)
const RGBA = [
  [/rgba\(\s*13\s*,\s*17\s*,\s*23\s*,/gi, 'rgba(255,255,255,'],   // #0d1117 scrim
  [/rgba\(\s*15\s*,\s*23\s*,\s*42\s*,/gi, 'rgba(242,242,247,'],   // #0f172a scrim
  [/rgba\(\s*10\s*,\s*22\s*,\s*40\s*,/gi, 'rgba(255,255,255,'],   // #0a1628 scrim
  [/rgba\(\s*2\s*,\s*6\s*,\s*23\s*,/gi, 'rgba(242,242,247,'],     // slate-950 scrim
  [/rgba\(\s*7\s*,\s*16\s*,\s*28\s*,/gi, 'rgba(242,242,247,'],    // #07101c scrim
];

let grandTotal = 0;
const perFile = [];

for (const rel of files) {
  let src;
  try { src = fs.readFileSync(rel, 'utf8'); } catch { continue; }
  let out = src, n = 0;

  for (const [hex, target] of Object.entries(HEX)) {
    // #hex not followed by another hex digit (avoid clipping 8-digit hexes)
    const re = new RegExp('#' + hex + '(?![0-9a-fA-F])', 'gi');
    out = out.replace(re, m => { n++; return target; });
  }
  for (const [re, target] of RGBA) {
    out = out.replace(re, () => { n++; return target; });
  }

  if (n > 0 && out !== src) {
    fs.writeFileSync(rel, out);
    grandTotal += n;
    perFile.push([rel, n]);
  }
}

perFile.sort((a, b) => b[1] - a[1]);
console.log(`Flipped ${perFile.length} files, ${grandTotal} substitutions.`);
console.log('Top 15:');
perFile.slice(0, 15).forEach(([f, n]) => console.log(`  ${n.toString().padStart(4)}  ${f}`));
