/**
 * flip-light-shells.mjs — flip the dark-themed shell/portal/field files that
 * the navy-hex flip list missed (they theme with #000/#0A0A0A/BASE=#0F1419).
 * Name-based const remap + black-base backgrounds (context-aware: #000 as text
 * stays dark). Run the generic passes (2,4) afterward for rgba/white cleanup.
 */
import fs from 'node:fs';

const files = fs.readFileSync(process.argv[2], 'utf8').split('\n').map(s => s.trim()).filter(Boolean);

const PAGE = '#F2F2F7', CARD = '#FFFFFF', BORDER = '#E5E5EA', TEXT = '#1C1C1E', DIM = '#6E6E73', GOLD = '#C8881C';

// name-based const remap: const NAME = '#hex'  (and NAME: '#hex' in palette objects)
const NAME = {
  DARK: PAGE, BASE: PAGE, BG: PAGE, NAVY: PAGE, INK: PAGE, DEEP: PAGE, BLACK: PAGE,
  CARD: CARD, RAISED: CARD, PANEL: CARD, SURFACE: CARD, ELEV: CARD, BG2: CARD,
  BORDER: BORDER, LINE: BORDER, STROKE: BORDER, HAIR: BORDER,
  TEXT: TEXT, FG: TEXT, INK2: TEXT,
  DIM: DIM, MUTED: DIM, SUB: DIM, FAINT: '#AEAEB2',
  GOLD: GOLD, GREEN: '#34C759', RED: '#FF3B30', BLUE: '#007AFF', AMBER: '#FF9500', PURPLE: '#AF52DE',
};

// dark base background literals -> light surface (context handled by the regex prefix)
const BG_LITERALS = [
  [/(background(?:Color)?:\s*['"`])#000000(['"`])/gi, (m, p, q) => `${p}${PAGE}${q}`],
  [/(background(?:Color)?:\s*['"`])#000(['"`])/gi, (m, p, q) => `${p}${PAGE}${q}`],
  [/(background(?:Color)?:\s*['"`])#0a0a0a(['"`])/gi, (m, p, q) => `${p}${CARD}${q}`],
  [/(background(?:Color)?:\s*['"`])#0c1420(['"`])/gi, (m, p, q) => `${p}${CARD}${q}`],
  [/(background(?:Color)?:\s*['"`])#07101c(['"`])/gi, (m, p, q) => `${p}${CARD}${q}`],
  [/(background(?:Color)?:\s*['"`])#0f1419(['"`])/gi, (m, p, q) => `${p}${PAGE}${q}`],
  [/(background(?:Color)?:\s*['"`])#0d1117(['"`])/gi, (m, p, q) => `${p}${PAGE}${q}`],
  // dark scrim header/nav at high alpha (these are the shell bars, want frosted white)
  [/(background(?:Color)?:\s*['"`])rgba\(0,\s*0,\s*0,\s*0?\.9\d*\)(['"`])/gi, (m, p, q) => `${p}rgba(255,255,255,0.92)${q}`],
];

let total = 0, changed = 0;
for (const rel of files) {
  let src; try { src = fs.readFileSync(rel, 'utf8'); } catch { continue; }
  let out = src, n = 0;

  // const NAME = '#hex'  and  NAME: '#hex' (palette objects), and lowercase keys
  for (const [name, target] of Object.entries(NAME)) {
    out = out.replace(new RegExp(`\\b${name}(\\s*[=:]\\s*)'#[0-9a-fA-F]{3,8}'`, 'g'), (m, eq) => { n++; return `${name}${eq}'${target}'`; });
  }
  for (const [re, fn] of BG_LITERALS) out = out.replace(re, (...a) => { n++; return fn(...a); });

  if (n > 0 && out !== src) { fs.writeFileSync(rel, out); total += n; changed++; }
}
console.log(`Shells flip: ${changed} files, ${total} substitutions.`);
