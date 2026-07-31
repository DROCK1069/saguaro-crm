/* Proof: AI extract of a sub bid → scope map → feeds the leveling engine. */
const { execSync } = require('child_process');
const path = require('path'), fs = require('fs');
for (const line of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line.trim()); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const KEY = process.env.ANTHROPIC_API_KEY; if (!KEY) { console.error('no key'); process.exit(1); }
const tmp = path.join(__dirname, '_ble');
execSync(`npx tsc lib/bidleveling/index.ts --outDir "${tmp}" --module commonjs --target es2020 --moduleResolution node --skipLibCheck --declaration false`, { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
const { levelBids, usd } = require(path.join(tmp, 'index.js'));

const scopeLines = [
  { id: 'S1', description: 'Hang & finish gypsum board' },
  { id: 'S2', description: 'Metal stud framing' },
  { id: 'S3', description: 'Batt insulation' },
  { id: 'S4', description: 'Corner bead / trim accessories' },
  { id: 'S5', description: 'Level-5 finish' },
];
const bidText = `BUDGET WALL SYSTEMS LLC — Proposal
Base Bid (lump sum): $95,000.00
Scope included: hang and finish gypsum wallboard; metal stud framing; batt insulation in exterior walls.
EXCLUSIONS: corner bead and trim accessories are by others; Level 5 finish is NOT included (Level 4 finish standard throughout).
Alternate No. 1: ADD $9,000 for skylight opening framing and finishing.
Clarification: price held for 30 days.`;

const scopeList = scopeLines.map((s) => `- id "${s.id}": ${s.description}`).join('\n');
const prompt = `Here is the GC's SCOPE CHECKLIST for this trade:
${scopeList}

Read the subcontractor bid below/attached and return, as JSON:
- "bidderName": the company name.
- "baseBidCents": the base/lump-sum bid in integer cents.
- "scope": one entry per checklist id above → {"scopeLineId": id, "status": "included|excluded|clarify", "valueCents": <if broken out, integer cents, else omit>}.
- "alternates": [{"key":"ALT-1","description":"...","valueCents":<int>,"kind":"add|deduct"}].
- "clarifications": short strings.
Dollar amounts → integer cents. Return ONLY the JSON object.

BID TEXT:
${bidText}`;

(async () => {
  const Anthropic = require('@anthropic-ai/sdk').default;
  const client = new Anthropic({ apiKey: KEY });
  const resp = await client.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 2000,
    system: 'You are a senior estimator leveling subcontractor bids. Map the bid precisely onto the provided scope checklist. Return ONLY raw JSON.',
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }] });
  const text = resp.content.filter((x) => x.type === 'text').map((x) => x.text).join('');
  const t = text.replace(/^```json\s*/im, '').replace(/```$/m, '').trim();
  const ex = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
  console.log('EXTRACTED:', JSON.stringify(ex, null, 0));

  const st = (id) => (ex.scope.find((s) => s.scopeLineId === id) || {}).status;
  let pass = 0, fail = 0; const ok = (n, c) => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'} ${n}`); };
  console.log('\n--- extract assertions ---');
  ok('base bid $95,000', ex.baseBidCents === 9500000);
  ok('S1 hang GWB included', st('S1') === 'included');
  ok('S2 framing included', st('S2') === 'included');
  ok('S3 insulation included', st('S3') === 'included');
  ok('S4 corner bead EXCLUDED', st('S4') === 'excluded');
  ok('S5 level-5 EXCLUDED', st('S5') === 'excluded');
  ok('ALT add ~$9,000', (ex.alternates || []).some((a) => a.kind === 'add' && Math.abs(a.valueCents - 900000) <= 100));

  // full loop: level the extracted bidder against a complete bidder
  const extractedBidder = { id: 'BW', name: ex.bidderName, baseBidCents: ex.baseBidCents, scope: ex.scope, alternates: ex.alternates };
  const complete = { id: 'AX', name: 'Apex Drywall', baseBidCents: 10000000,
    scope: scopeLines.map((s) => ({ scopeLineId: s.id, status: 'included', valueCents: s.id === 'S4' ? 800000 : s.id === 'S5' ? 1200000 : 2000000 })),
    alternates: [{ key: 'ALT-1', description: 'skylight', valueCents: 800000, kind: 'add' }] };
  const R = levelBids(scopeLines, [extractedBidder, complete], { selectedAlternateKeys: ['ALT-1'] });
  console.log('\n--- leveled from AI extract ---');
  console.log('  ', R.bidders.map((b) => `${b.name} base ${usd(b.baseBidCents)} → leveled ${usd(b.leveledTotalCents)}${b.isLow ? ' [LOW]' : ''}`).join('\n   '));
  ok('extracted bidder got gap allowances for S4+S5', R.bidders.find((b) => b.id === 'BW').gapAllowanceCents > 0);
  ok('leveling picked a low bidder', !!R.lowBidderId);

  console.log(`\n${pass}/${pass + fail} passed`);
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error('ERR', e.message); fs.rmSync(tmp, { recursive: true, force: true }); process.exitCode = 1; });
