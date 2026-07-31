/**
 * flip-light-residual.mjs — catch dark navy surfaces missed by the first
 * pass (low-occurrence panel/page hexes). Surfaces only; accent badge tints
 * (dark red/green/purple) are intentionally left untouched.
 */
import fs from 'node:fs';

const files = fs.readFileSync(process.argv[2] || '/tmp/flip_files.txt', 'utf8')
  .split('\n').map(s => s.trim()).filter(Boolean);

const PAGE = '#F2F2F7', CARD = '#FFFFFF';
const HEX = {
  // deep page navies
  '060e18': PAGE, '070f1b': PAGE, '0a1222': PAGE, '0b1929': PAGE,
  '0a1d2e': PAGE, '060c14': PAGE,
  // card / panel navies
  '0f1a2e': CARD, '142a40': CARD, '162032': CARD, '1a2a3d': CARD,
  '1a2a3a': CARD, '253549': CARD, '1a1d23': CARD, '162a40': CARD,
};

let total = 0, changed = 0;
for (const rel of files) {
  let src; try { src = fs.readFileSync(rel, 'utf8'); } catch { continue; }
  let out = src, n = 0;
  for (const [hex, target] of Object.entries(HEX)) {
    out = out.replace(new RegExp('#' + hex + '(?![0-9a-fA-F])', 'gi'), () => { n++; return target; });
  }
  if (n > 0 && out !== src) { fs.writeFileSync(rel, out); total += n; changed++; }
}
console.log(`Residual flip: ${changed} files, ${total} substitutions.`);
