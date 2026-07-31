/* Render the new bespoke estimating icons + upgraded takeoff cards to a crisp
   high-DPI PNG on the app's real dark theme — faithful visual proof. */
const fs = require('fs'), path = require('path');
const sharp = require('sharp');
const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'field', 'field-icons.ts'), 'utf8');
const icon = (key) => { const m = new RegExp(key + ':\\s*`(<svg[\\s\\S]*?<\\/svg>)`').exec(src); return m ? m[1] : ''; };
const place = (key, x, y, size) => icon(key).replace(/^<svg[^>]*>/, `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 32 32" fill="none">`);

const GOLD = '#F59E0B', TEXT = '#e6edf3', DIM = '#8b949e', PANEL = '#161b22', LINE = 'rgba(255,255,255,0.10)';
const icons = [
  ['aiCount', 'Count / AI scan'], ['drawings', 'Read blueprint'], ['ruler', 'Scale / linear'],
  ['penTrace', 'Trace on plan'], ['areaPoly', 'Area'], ['costBook', 'Cost catalog'], ['warnTri', 'Sanity flag'],
];
const cellW = 116, x0 = 40, iconRow = icons.map((_, i) => x0 + i * cellW).map((x) => x + (cellW - 60) / 2);

const card = (x, y, w, accent, key, title, sub1, sub2) => `
  <rect x="${x}" y="${y}" width="${w}" height="112" rx="14" fill="${accent}22" stroke="${accent}" stroke-width="1.5"/>
  ${place(key, x + 18, y + 20, 40)}
  <text x="${x + 74}" y="${y + 40}" fill="${TEXT}" font-size="17" font-weight="800" font-family="Segoe UI,system-ui,sans-serif">${title}</text>
  <text x="${x + 74}" y="${y + 66}" fill="${DIM}" font-size="13" font-family="Segoe UI,system-ui,sans-serif">${sub1}</text>
  <text x="${x + 74}" y="${y + 86}" fill="${DIM}" font-size="13" font-family="Segoe UI,system-ui,sans-serif">${sub2}</text>`;

const chip = (x, y, key, label, w) => `
  <rect x="${x}" y="${y}" width="${w}" height="38" rx="9" fill="rgba(245,158,11,0.12)" stroke="rgba(245,158,11,0.4)"/>
  ${place(key, x + 11, y + 9, 20)}
  <text x="${x + 38}" y="${y + 24}" fill="${GOLD}" font-size="13.5" font-weight="700" font-family="Segoe UI,system-ui,sans-serif">${label}</text>`;

const W = 900, H = 520;
const master = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#0d1117"/>
  <text x="40" y="42" fill="${GOLD}" font-size="13" font-weight="700" letter-spacing="1.5" font-family="Segoe UI,system-ui,sans-serif">SAGUARO · ESTIMATING ICON SET — CRAFTED TWO-TONE (STEEL + GOLD)</text>
  ${icons.map((it, i) => place(it[0], iconRow[i], 66, 60)).join('')}
  ${icons.map((it, i) => `<text x="${iconRow[i] + 30}" y="150" fill="${DIM}" font-size="11.5" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif">${it[1]}</text>`).join('')}
  <line x1="40" y1="180" x2="${W - 40}" y2="180" stroke="${LINE}"/>
  <text x="40" y="212" fill="${TEXT}" font-size="13" font-weight="700" letter-spacing="1" font-family="Segoe UI,system-ui,sans-serif">PLAN-READING AI — TWO ENTRY POINTS</text>
  ${card(40, 228, 400, '#F59E0B', 'drawings', 'Read full blueprint', 'Upload the whole plan-set PDF — AI reads', 'every sheet, prices all conditions.')}
  ${card(460, 228, 400, '#38BDF8', 'aiCount', 'Count symbols + auto-scale', 'One sheet — counts doors, fixtures &amp;', 'receptacles, reads scale, auto-calibrates.')}
  <text x="40" y="392" fill="${TEXT}" font-size="13" font-weight="700" letter-spacing="1" font-family="Segoe UI,system-ui,sans-serif">CONTROLS</text>
  ${chip(40, 408, 'areaPoly', 'Area · SF', 128)}
  ${chip(180, 408, 'ruler', 'Linear · LF', 138)}
  ${chip(330, 408, 'aiCount', 'Count · EA', 130)}
  ${chip(472, 408, 'penTrace', 'Trace on plan', 160)}
  ${chip(644, 408, 'costBook', 'Cost catalog', 150)}
  <rect x="40" y="462" width="820" height="34" rx="8" fill="${PANEL}" stroke="rgba(245,158,11,0.4)"/>
  ${place('warnTri', 52, 470, 18)}
  <text x="80" y="484" fill="${GOLD}" font-size="13" font-family="Segoe UI,system-ui,sans-serif">Sanity: door count looks high for the floor area — verify before sending.</text>
</svg>`;

sharp(Buffer.from(master), { density: 216 }).png().toFile(path.join(__dirname, 'icon_preview.png'))
  .then((r) => console.log('rendered icon_preview.png', r.width + 'x' + r.height))
  .catch((e) => { console.error(e.message); process.exitCode = 1; });
