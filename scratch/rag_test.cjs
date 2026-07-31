/* Proof: RAG re-ranker surfaces the right project record per question. */
const { execSync } = require('child_process');
const path = require('path'), fs = require('fs');
const tmp = path.join(__dirname, '_rag');
execSync(`npx tsc lib/rag/index.ts --outDir "${tmp}" --module commonjs --target es2020 --moduleResolution node --skipLibCheck --declaration false`, { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
const { rankChunks, buildContext, snippet } = require(path.join(tmp, 'index.js'));

const chunks = [
  { id: 'c1', source: 'Spec 09 30 00 — Tiling', sourceType: 'spec', text: 'Lobby floor tile shall be 24x24 porcelain, color charcoal, manufactured by Daltile. Grout color to match tile. Setting bed per TCNA. Sealer required at all natural stone.' },
  { id: 'c2', source: 'RFI #12', sourceType: 'rfi', text: 'RFI regarding footing rebar at continuous footings. Structural response: use #5 rebar at 12 inches on center each way for the continuous footings; hook at corners.' },
  { id: 'c3', source: 'Submittal — HVAC RTU-1', sourceType: 'submittal', text: 'Rooftop unit submittal for RTU-1, Carrier model 48TC, 5 ton nominal cooling, 460V/3ph, economizer included. Approved as noted.' },
  { id: 'c4', source: 'Daily Log — 2026-05-02', sourceType: 'daily_log', text: 'Poured lobby slab on grade. Weather clear, 78F. Six crew on site. Concrete pump on west side. No safety incidents.' },
  { id: 'c5', source: 'Change Order #3', sourceType: 'change_order', text: 'Added skylight framing at atrium per owner request. Cost impact $8,400 add. Schedule impact 2 days.' },
];

let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'} ${n}${d ? ' · ' + d : ''}`); };

console.log('=== retrieval assertions ===');
const q1 = rankChunks('what tile is specified in the lobby?', chunks);
ok('lobby tile → spec first', q1[0]?.sourceType === 'spec', q1.map((c) => c.sourceType).join('>'));
ok('spec matched tile+lobby', q1[0]?.matchedTerms.includes('tile') && q1[0]?.matchedTerms.includes('lobby'));

const q2 = rankChunks('what did the footing rebar RFI say?', chunks);
ok('footing rebar → rfi first', q2[0]?.sourceType === 'rfi', q2.map((c) => c.sourceType).join('>'));

const q3 = rankChunks('RTU cooling capacity and voltage', chunks);
ok('RTU cooling → submittal first', q3[0]?.sourceType === 'submittal', q3.map((c) => c.sourceType).join('>'));

const q4 = rankChunks('what was the skylight change order cost?', chunks);
ok('skylight cost → change order first', q4[0]?.sourceType === 'change_order');

const q5 = rankChunks('weather during the lobby slab pour', chunks);
ok('slab pour weather → daily log first', q5[0]?.sourceType === 'daily_log', q5.map((c) => c.sourceType).join('>'));

console.log('\n=== context + citations ===');
const { context, citations } = buildContext(q1);
ok('citations numbered from 1', citations[0]?.n === 1 && citations[0]?.source === 'Spec 09 30 00 — Tiling');
ok('context references [1]', /\[1\]/.test(context));
ok('snippet trims long text', snippet('x '.repeat(600), ['x'], 100).length <= 104);

console.log('\n=== determinism ===');
ok('identical query → identical ranking', JSON.stringify(rankChunks('lobby tile spec', chunks)) === JSON.stringify(rankChunks('lobby tile spec', chunks)));
ok('irrelevant query → no false hits', rankChunks('elevator maintenance contract', chunks).length === 0);

console.log(`\n${pass}/${pass + fail} passed`);
fs.rmSync(tmp, { recursive: true, force: true });
process.exitCode = fail ? 1 : 0;
