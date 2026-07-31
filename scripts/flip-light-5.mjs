/**
 * flip-light-5.mjs — classes surfaced by the new-files audit:
 *   - #F5F5F7 near-white text (never a bg here) -> dark #1C1C1E
 *   - rgba(15,20,25,a) / rgba(15,15,15,a) near-black input fills & gradient
 *     stops -> white surface
 *   - #2A3144 slate input border -> #E5E5EA
 */
import fs from 'node:fs';

const files = fs.readFileSync(process.argv[2] || '/tmp/flip_files.txt', 'utf8')
  .split('\n').map(s => s.trim()).filter(Boolean);

const subs = [
  [/#F5F5F7/gi, '#1C1C1E'],
  [/rgba\(\s*15\s*,\s*20\s*,\s*25\s*,/g, 'rgba(255,255,255,'],
  [/rgba\(\s*15\s*,\s*15\s*,\s*15\s*,/g, 'rgba(255,255,255,'],
  [/#2A3144/gi, '#E5E5EA'],
];

let total = 0, changed = 0;
for (const rel of files) {
  let src; try { src = fs.readFileSync(rel, 'utf8'); } catch { continue; }
  let out = src, n = 0;
  for (const [re, rep] of subs) out = out.replace(re, () => { n++; return rep; });
  if (n > 0 && out !== src) { fs.writeFileSync(rel, out); total += n; changed++; }
}
console.log(`Pass 5: ${changed} files, ${total} substitutions.`);
