/**
 * fix-button-text.mjs — restore dark text where the light-flip turned
 * button labels near-white. Near-white text is never correct on a light
 * theme; these were dark-text-on-gold labels (color:'#0d1117' / color: DARK).
 *
 * Lookbehind `(?<![A-Za-z-])color:` avoids matching backgroundColor /
 * borderColor / background-color (capital C or hyphen prefix).
 */
import fs from 'node:fs';

const files = fs.readFileSync(process.argv[2] || '/tmp/flip_files.txt', 'utf8')
  .split('\n').map(s => s.trim()).filter(Boolean);

const DARKTEXT = "'#1C1C1E'";
const subs = [
  // inline near-white text literal -> dark
  [/(?<![A-Za-z-])color:(\s*)'#F2F2F7'/g, (m, s) => `color:${s}${DARKTEXT}`],
  [/(?<![A-Za-z-])color:(\s*)'#FFFFFF'(\s*,\s*background:\s*`?linear-gradient\([^`)]*#(?:C8881C|E0A030|D4A017))/gi,
    (m, s, rest) => `color:${s}${DARKTEXT}${rest}`], // white-on-gold only
  // const refs that now resolve to a light surface, used as TEXT
  [/(?<![A-Za-z-])color:(\s*)(DARK|BG|BASE)\b/g, (m, s) => `color:${s}${DARKTEXT}`],
];

let total = 0, changed = 0;
for (const rel of files) {
  let src;
  try { src = fs.readFileSync(rel, 'utf8'); } catch { continue; }
  let out = src, n = 0;
  for (const [re, fn] of subs) out = out.replace(re, (...a) => { n++; return fn(...a); });
  if (n > 0 && out !== src) { fs.writeFileSync(rel, out); total += n; changed++; }
}
console.log(`Restored dark button text in ${changed} files, ${total} substitutions.`);
