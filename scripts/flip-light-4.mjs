/**
 * flip-light-4.mjs — generalize the light-text fix. ANY light-colored text or
 * stroke in rgba() form (avg RGB >= 150: white, slate-50, slate-300, blue-gray)
 * was muted-on-dark and is now invisible/faint on light. Map to dark/mid text.
 * Also a couple more slate/navy hexes the audit surfaced. All files.
 */
import fs from 'node:fs';

const files = fs.readFileSync(process.argv[2] || '/tmp/flip_files.txt', 'utf8')
  .split('\n').map(s => s.trim()).filter(Boolean);

const HEX = { '3a4a5a': '#E5E5EA', '090f1b': '#F2F2F7', '0a0f1a': '#FFFFFF', '08111d': '#FFFFFF' };

// color:/stroke: rgba(r,g,b,a) where the color is light -> dark/mid text.
// Quote group \2 is '' | ' | " so it round-trips inline and CSS forms.
const LIGHTTEXT = /(?<![A-Za-z-])(color|stroke):(\s*)(['"]?)rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)\3/g;

let total = 0, changed = 0;
for (const rel of files) {
  let src; try { src = fs.readFileSync(rel, 'utf8'); } catch { continue; }
  let out = src, n = 0;

  for (const [hex, target] of Object.entries(HEX)) {
    out = out.replace(new RegExp('#' + hex + '(?![0-9a-fA-F])', 'gi'), () => { n++; return target; });
  }

  out = out.replace(LIGHTTEXT, (m, prop, sp, q, r, g, b, a) => {
    const avg = (+r + +g + +b) / 3;
    if (avg < 150) return m;                 // already dark/colored text — leave
    const al = parseFloat(a);
    n++;
    if (al >= 0.55) return `${prop}:${sp}${q}rgba(28,28,30,${a})${q}`;
    return `${prop}:${sp}${q}rgba(110,110,115,0.7)${q}`;
  });

  if (n > 0 && out !== src) { fs.writeFileSync(rel, out); total += n; changed++; }
}
console.log(`Pass 4 (generalized light text): ${changed} files, ${total} substitutions.`);
