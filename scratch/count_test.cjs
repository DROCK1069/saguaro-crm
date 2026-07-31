/* Proof: plan-reading AI counts symbols + reads scale + auto-calibrates.
   Draws a synthetic plan with KNOWN counts, runs the route's exact prompt,
   asserts the model returns them. */
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('@napi-rs/canvas');

// load ANTHROPIC_API_KEY from .env.local
for (const line of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line.trim());
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) { console.error('no key'); process.exit(1); }

const W = 1000, H = 760;
const cv = createCanvas(W, H), g = cv.getContext('2d');
g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
g.strokeStyle = '#111'; g.fillStyle = '#111'; g.lineWidth = 2;
g.font = '16px sans-serif';

// building outline
g.strokeRect(80, 120, 700, 520);

// ---- 20'-0" dimension line, exactly 400px (x=100..500) → pxPerFt = 20.0 ----
g.beginPath(); g.moveTo(100, 90); g.lineTo(500, 90); g.stroke();
g.beginPath(); g.moveTo(100, 82); g.lineTo(100, 98); g.moveTo(500, 82); g.lineTo(500, 98); g.stroke();
g.fillText("20'-0\"", 270, 82);

// ---- 6 DOORS (wall gap + 90deg swing arc + leaf) ----
function door(x, y) {
  g.save(); g.translate(x, y);
  g.beginPath(); g.arc(0, 0, 34, -Math.PI / 2, 0); g.stroke();      // swing arc
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -34); g.stroke();       // leaf
  g.restore();
}
const doors = [[180, 300], [320, 300], [460, 300], [600, 300], [250, 470], [520, 470]];
doors.forEach(([x, y]) => door(x, y));

// ---- 8 LIGHT FIXTURES (circle + cross = standard ceiling-light symbol) ----
function light(x, y) {
  g.beginPath(); g.arc(x, y, 13, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(x - 13, y); g.lineTo(x + 13, y); g.moveTo(x, y - 13); g.lineTo(x, y + 13); g.stroke();
}
let n = 0;
for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) { light(160 + c * 150, 170 + r * 44); n++; }
// n === 8
// legend so the symbol is unambiguous (as a real sheet would carry)
g.font = '13px sans-serif';
light(600, 690); g.fillText('= LIGHT FIXTURE (TYP)', 620, 695);
g.font = '16px sans-serif';

// ---- 4 PLUMBING FIXTURES (labeled fixtures along bottom) ----
function fixture(x, y, label) {
  g.beginPath(); g.ellipse(x, y, 20, 14, 0, 0, Math.PI * 2); g.stroke();
  g.fillText(label, x - 8, y + 5);
}
[['WC', 200], ['WC', 300], ['LAV', 640], ['SINK', 720]].forEach(([lab, x]) => fixture(x, 560, lab));

// title block
g.strokeRect(560, 650, 220, 90);
g.font = 'bold 15px sans-serif';
g.fillText('FLOOR PLAN — LEVEL 1', 572, 680);
g.font = '14px sans-serif';
g.fillText('SCALE: 1/8" = 1\'-0"', 572, 705);

const png = cv.toBuffer('image/png');
fs.writeFileSync(path.join(__dirname, 'count_plan.png'), png);
const b64 = png.toString('base64');
console.log('plan drawn', png.length, 'bytes | KNOWN: 6 doors, 8 lights, 4 plumbing, dim 20ft=400px→pxPerFt 20');

// ---- the route's exact prompt ----
const countAssemblies = '"steel_column" (Steel column (W8×24)), "door_frame" (Door, frame & hardware), "plumbing_fixtures" (Plumbing fixtures), "light_fixtures" (Light fixtures)';
const prompt = `This sheet is ${W}px × ${H}px.

1) COUNT every countable element on this sheet — doors, windows, plumbing fixtures, light fixtures, receptacles, data/comm outlets, sprinkler heads, diffusers, columns, whatever is drawn/scheduled. Be thorough and exact.
2) Read the TITLE-BLOCK SCALE if shown (e.g. 1/8" = 1'-0").
3) Find ONE clearly labeled dimension and give its two endpoint pixel coordinates + its real length in feet, so the plan can auto-calibrate.

Map a count to one of these takeoff assemblies when it fits: ${countAssemblies}. Otherwise leave "assembly" empty.

Return ONLY:
{"scale":{"text":"1/8\\" = 1'-0\\"","confidence":0-100},
 "calibration":{"knownFt":20,"p1":{"x":100,"y":200},"p2":{"x":540,"y":200}},
 "counts":[{"symbol":"Door","count":12,"assembly":"door_frame","csi":"08 11 00","confidence":0-100}],
 "notes":["short"]}`;

(async () => {
  const Anthropic = require('@anthropic-ai/sdk').default;
  const client = new Anthropic({ apiKey: KEY });
  const resp = await client.messages.create({
    model: 'claude-sonnet-4-6', max_tokens: 3000,
    system: 'You are a senior estimator doing a symbol count on a construction sheet. Count carefully and completely. Return ONLY raw JSON.',
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: b64 } },
      { type: 'text', text: prompt },
    ] }],
  });
  const text = resp.content.filter((x) => x.type === 'text').map((x) => x.text).join('');
  let t = text.replace(/^```json\s*/im, '').replace(/^```\s*/im, '').replace(/\s*```\s*$/im, '').trim();
  const parsed = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));

  const byAsm = {};
  for (const c of parsed.counts || []) { if (c.assembly) byAsm[c.assembly] = (byAsm[c.assembly] || 0) + c.count; }
  let px = null;
  const cal = parsed.calibration;
  if (cal?.p1 && cal?.p2 && cal.knownFt > 0) px = Math.round((Math.hypot(cal.p2.x - cal.p1.x, cal.p2.y - cal.p1.y) / cal.knownFt) * 100) / 100;

  console.log('\n--- MODEL RETURNED ---');
  console.log('scale:', JSON.stringify(parsed.scale));
  console.log('counts:', JSON.stringify(parsed.counts));
  console.log('pxPerFt (from calibration):', px, '(expect ~20)');

  let pass = 0, fail = 0;
  const chk = (name, cond, got) => { if (cond) { pass++; console.log('  PASS', name, '·', got); } else { fail++; console.log('  FAIL', name, '·', got); } };
  console.log('\n--- ASSERTIONS ---');
  chk('doors ≈ 6 (±1)', Math.abs((byAsm.door_frame || 0) - 6) <= 1, byAsm.door_frame);
  chk('lights ≈ 8 (±1)', Math.abs((byAsm.light_fixtures || 0) - 8) <= 1, byAsm.light_fixtures);
  chk('plumbing ≈ 4 (±1)', Math.abs((byAsm.plumbing_fixtures || 0) - 4) <= 1, byAsm.plumbing_fixtures);
  chk('scale reads 1/8"', /1\/8/.test(parsed.scale?.text || ''), parsed.scale?.text);
  chk('auto-calibrate pxPerFt 20 (±15%)', px != null && Math.abs(px - 20) / 20 <= 0.15, px);
  console.log(`\n${pass}/${pass + fail} passed`);
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error('ERR', e.message); process.exitCode = 1; });
