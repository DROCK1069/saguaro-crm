/* Proof: revision-compare detects real drawing changes. Draws Rev A and Rev B
   (B adds 2 doors + a new partition wall) and asserts the AI reports them. */
const fs = require('fs'), path = require('path');
const { createCanvas } = require('@napi-rs/canvas');
for (const line of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line.trim()); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const KEY = process.env.ANTHROPIC_API_KEY; if (!KEY) { console.error('no key'); process.exit(1); }

function base(g) {
  g.fillStyle = '#fff'; g.fillRect(0, 0, 900, 680); g.strokeStyle = '#111'; g.fillStyle = '#111'; g.lineWidth = 2; g.font = '15px sans-serif';
  g.strokeRect(70, 90, 760, 520);
  g.beginPath(); g.moveTo(450, 90); g.lineTo(450, 610); g.stroke();          // center corridor wall
  // doors (swing arc + leaf)
  const door = (x, y) => { g.save(); g.translate(x, y); g.beginPath(); g.arc(0, 0, 30, -Math.PI / 2, 0); g.stroke(); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -30); g.stroke(); g.restore(); };
  const doors = [[180, 250], [320, 250], [560, 250], [700, 250]];  // 4 doors
  doors.forEach(([x, y]) => door(x, y));
  g.font = 'bold 15px sans-serif'; g.fillText('FLOOR PLAN — LEVEL 1', 300, 60);
  return door;
}
function draw(rev) {
  const cv = createCanvas(900, 680), g = cv.getContext('2d');
  const door = base(g);
  if (rev === 'B') {
    // CHANGES in Rev B: add a new partition wall + 2 more doors + a revision cloud
    g.beginPath(); g.moveTo(70, 400); g.lineTo(450, 400); g.stroke();       // NEW partition wall (left room split)
    door(240, 400); door(620, 430);                                         // 2 NEW doors
    // revision triangle marker
    g.strokeStyle = '#c00'; g.fillStyle = '#c00';
    g.beginPath(); g.moveTo(260, 380); g.lineTo(275, 355); g.lineTo(290, 380); g.closePath(); g.stroke();
    g.fillText('1', 271, 376);
    g.strokeStyle = '#111'; g.fillStyle = '#111';
  }
  return cv.toBuffer('image/png').toString('base64');
}
const A = draw('A'), B = draw('B');
console.log('Rev A: 4 doors, 1 corridor wall | Rev B: +1 partition wall, +2 doors, +rev cloud');

const prompt = `Image 1 is "Rev A (older)". Image 2 is "Rev B (newer)". They are two revisions of the same construction sheet.

Compare them and list EVERY real difference — walls added/removed/moved, doors/windows/fixtures added or removed, rooms re-sized, dimensions changed, schedule/notes changed, revision-cloud areas. Ignore rendering noise; report only genuine design changes. For each, judge the likely cost direction for the trade contractor.

Return ONLY:
{"summary":"one sentence","netScope":"increase|decrease|neutral|unclear","changes":[{"type":"added|removed|moved|modified","trade":"e.g. Openings","description":"what changed","location":"where","costImpact":"increase|decrease|neutral|unclear","confidence":0-100}]}`;

(async () => {
  const Anthropic = require('@anthropic-ai/sdk').default;
  const client = new Anthropic({ apiKey: KEY });
  const resp = await client.messages.create({
    model: 'claude-sonnet-4-6', max_tokens: 3000,
    system: 'You are a senior estimator comparing two revisions of the same construction drawing. Report only real, visible differences. Return ONLY raw JSON.',
    messages: [{ role: 'user', content: [
      { type: 'text', text: 'IMAGE 1 — Rev A (older):' }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: A } },
      { type: 'text', text: 'IMAGE 2 — Rev B (newer):' }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: B } },
      { type: 'text', text: prompt },
    ] }],
  });
  const text = resp.content.filter((x) => x.type === 'text').map((x) => x.text).join('');
  const t = text.replace(/^```json\s*/im, '').replace(/^```\s*/im, '').replace(/\s*```\s*$/im, '').trim();
  const parsed = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
  const all = JSON.stringify(parsed.changes || []).toLowerCase();
  console.log('\nsummary:', parsed.summary, '| netScope:', parsed.netScope);
  (parsed.changes || []).forEach((c) => console.log(`  [${c.type}] ${c.trade}: ${c.description} (${c.costImpact}, ${c.confidence}%)`));

  let pass = 0, fail = 0; const chk = (n, ok) => { ok ? pass++ : fail++; console.log(ok ? '  PASS ' + n : '  FAIL ' + n); };
  console.log('\n--- ASSERTIONS ---');
  chk('detected added door(s)', /door/.test(all) && /add/.test(all));
  chk('detected new wall/partition', /wall|partition/.test(all));
  chk('netScope = increase', parsed.netScope === 'increase');
  chk('at least 2 changes', (parsed.changes || []).length >= 2);
  console.log(`\n${pass}/${pass + fail} passed`);
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error('ERR', e.message); process.exitCode = 1; });
