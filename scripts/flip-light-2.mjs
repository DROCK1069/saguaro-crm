/**
 * flip-light-2.mjs — second systematic pass. Fixes the dark-theme leftovers
 * the hex-only codemod could not catch, surfaced by the audit:
 *   - navy borders/panels in rgb() form (rgb 38,51,71 / 30,58,95 / 31,44,62 ...)
 *   - subtle white overlays rgba(255,255,255,<=0.15) -> subtle dark (visible on light)
 *   - semi-transparent WHITE text -> dark text
 *   - black scrims background rgba(0,0,0,0.2-0.6) -> light surface
 *   - slate-300 muted text rgba(203,213,225,a) -> mid gray
 *   - extra navy hexes missed by pass 1
 *   - colorScheme:'dark' -> 'light'; mixBlendMode:'screen' (logo wash) -> removed
 * String-only swaps => no syntax risk. Applied to ALL flipped files (incl. the
 * batches the audit could not reach due to rate limiting).
 */
import fs from 'node:fs';

const files = fs.readFileSync(process.argv[2] || '/tmp/flip_files.txt', 'utf8')
  .split('\n').map(s => s.trim()).filter(Boolean);

const PAGE = '#F2F2F7', CARD = '#FFFFFF', BORDER = '#E5E5EA';

// extra navy hexes the first pass missed
const HEX = {
  '070f18': CARD, '070e18': PAGE, '0a0f16': CARD, '080d13': CARD, '0a1520': PAGE,
  '0a1220': PAGE, '0d1f3c': PAGE, '0a2540': PAGE, '132236': CARD, '111b27': CARD,
  '141e2e': CARD, '131d2e': PAGE, '0f1623': CARD, '0d1520': CARD, '132030': CARD,
  '0b1623': CARD, '09111a': PAGE,
};

const rules = [
  // navy borders (rgb of #263347 / #1E3A5F / #1f2c3e) -> light hairline
  [/rgba\(\s*38\s*,\s*51\s*,\s*71\s*,/g, 'rgba(229,229,234,'],
  [/rgba\(\s*30\s*,\s*58\s*,\s*95\s*,/g, 'rgba(229,229,234,'],
  [/rgba\(\s*31\s*,\s*44\s*,\s*62\s*,/g, 'rgba(229,229,234,'],
  // navy panels/bars (rgb) -> white surface
  [/rgba\(\s*15\s*,\s*22\s*,\s*35\s*,/g, 'rgba(255,255,255,'],
  [/rgba\(\s*26\s*,\s*31\s*,\s*46\s*,/g, 'rgba(255,255,255,'],
  [/rgba\(\s*9\s*,\s*17\s*,\s*26\s*,/g, 'rgba(255,255,255,'],
  // slate-300 muted text/border -> mid gray
  [/rgba\(\s*203\s*,\s*213\s*,\s*225\s*,/g, 'rgba(110,110,115,'],
  // const surface defs that used white-alpha -> solid light
  [/\b(RAISED|CARD|PANEL|SURFACE)(\s*=\s*)'rgba\(255,\s*255,\s*255,[^')]*\)'/g, (m, n, e) => `${n}${e}'#FFFFFF'`],
  [/\bBORDER(\s*=\s*)'rgba\(255,\s*255,\s*255,[^')]*\)'/g, (m, e) => `BORDER${e}'#E5E5EA'`],
  // white borders (any alpha) -> light hairline; only ever meant to show on dark
  [/solid\s+rgba\(\s*255\s*,\s*255\s*,\s*255\s*,[^)]*\)/g, 'solid #E5E5EA'],
  [/(?<![A-Za-z-])borderColor:(\s*)'rgba\(\s*255\s*,\s*255\s*,\s*255\s*,[^)]*\)'/g, (m, s) => `borderColor:${s}'#E5E5EA'`],
  // semi-transparent WHITE text -> dark text (lowercase `color:` only; not backgroundColor/borderColor)
  [/(?<![A-Za-z-])color:(\s*)'rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*(0?\.\d+)\s*\)'/g,
    (m, s, a) => `color:${s}'rgba(28,28,30,${a})'`],
  // subtle white overlays (alpha <= 0.15) in any non-color context -> subtle dark
  [/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*(0?\.\d+|1(?:\.0)?)\s*\)/g,
    (m, a) => parseFloat(a) <= 0.15 ? `rgba(0,0,0,${a})` : m],
  // black scrims used as a background surface -> light
  [/background(?:Color)?:(\s*)'rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0?\.[2-6]\d*\s*\)'/g,
    (m, s) => `background:${s}'#F2F2F7'`],
  // dark native date controls -> light
  [/colorScheme:(\s*)'dark'/g, (m, s) => `colorScheme:${s}'light'`],
  // logo wash-out: remove screen blend (inline + CSS)
  [/,\s*mixBlendMode:\s*'screen'(\s+as\s+const)?/g, ''],
  [/mixBlendMode:\s*'screen'(\s+as\s+const)?\s*,?\s*/g, ''],
  [/mix-blend-mode:\s*screen;?/g, ''],
];

let total = 0, changed = 0;
const per = [];
for (const rel of files) {
  let src; try { src = fs.readFileSync(rel, 'utf8'); } catch { continue; }
  let out = src, n = 0;
  for (const [hex, target] of Object.entries(HEX)) {
    out = out.replace(new RegExp('#' + hex + '(?![0-9a-fA-F])', 'gi'), () => { n++; return target; });
  }
  for (const [re, rep] of rules) {
    out = out.replace(re, (...a) => { const r = typeof rep === 'function' ? rep(...a) : rep; if (r !== a[0]) n++; return r; });
  }
  if (n > 0 && out !== src) { fs.writeFileSync(rel, out); total += n; changed++; per.push([rel, n]); }
}
per.sort((a, b) => b[1] - a[1]);
console.log(`Pass 2: ${changed} files, ${total} substitutions.`);
per.slice(0, 12).forEach(([f, n]) => console.log(`  ${String(n).padStart(3)}  ${f.replace('C:/Users/Public/saguaro-deploy/', '')}`));
