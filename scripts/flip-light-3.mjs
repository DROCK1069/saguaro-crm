/**
 * flip-light-3.mjs — final cleanup of low-count bespoke stragglers across ALL
 * files (incl. the audit-rate-limited half): slate fills, dark accent toast
 * fills, near-white active-label text, and the get-the-app gold-button CSS.
 */
import fs from 'node:fs';

const files = fs.readFileSync(process.argv[2] || '/tmp/flip_files.txt', 'utf8')
  .split('\n').map(s => s.trim()).filter(Boolean);

const HEX = {
  '374151': '#6E6E73', '3a3a4a': '#AEAEB2',
  '1a0f00': '#FFFFFF', '1f1100': '#F2F2F7',
  '7f1d1d': '#FF3B30', '166534': '#34C759',
};

const rules = [
  // near-white active-label text (color ternary true-branch) -> dark
  [/'#F2F2F7'(\s*:\s*DIM)/g, (m, t) => `'#1C1C1E'${t}`],
  [/(?<![A-Za-z-])color:(\s*)'#F2F2F7'/g, (m, s) => `color:${s}'#1C1C1E'`],
  // CSS near-white text (gold buttons etc.) -> dark
  [/color:(\s*)#F2F2F7\b/g, (m, s) => `color:${s}#1C1C1E`],
  // leftover white text stored in a variable -> mid gray
  [/let color = 'rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0?\.\d+\s*\)'/g, "let color = '#6E6E73'"],
];

let total = 0, changed = 0;
for (const rel of files) {
  let src; try { src = fs.readFileSync(rel, 'utf8'); } catch { continue; }
  let out = src, n = 0;
  for (const [hex, target] of Object.entries(HEX)) {
    out = out.replace(new RegExp('#' + hex + '(?![0-9a-fA-F])', 'gi'), () => { n++; return target; });
  }
  for (const [re, rep] of rules) {
    out = out.replace(re, (...a) => { const r = typeof rep === 'function' ? rep(...a) : rep; if (r !== a[0]) n++; return r; });
  }
  if (n > 0 && out !== src) { fs.writeFileSync(rel, out); total += n; changed++; }
}
console.log(`Pass 3 cleanup: ${changed} files, ${total} substitutions.`);
