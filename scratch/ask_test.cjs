/* Proof: full ask-docs loop — retrieve → Claude answers GROUNDED with [n] citations,
   and does not fabricate when the answer isn't in the records. */
const { execSync } = require('child_process');
const path = require('path'), fs = require('fs');
for (const line of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const m = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line.trim()); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const KEY = process.env.ANTHROPIC_API_KEY; if (!KEY) { console.error('no key'); process.exit(1); }
const tmp = path.join(__dirname, '_ask');
execSync(`npx tsc lib/rag/index.ts --outDir "${tmp}" --module commonjs --target es2020 --moduleResolution node --skipLibCheck --declaration false`, { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
const { rankChunks, buildContext } = require(path.join(tmp, 'index.js'));

const chunks = [
  { id: 'c1', source: 'Spec 09 30 00 — Tiling', sourceType: 'spec', text: 'Lobby floor tile shall be 24x24 porcelain, color charcoal, manufactured by Daltile. Grout color to match tile. Sealer required at all natural stone.' },
  { id: 'c2', source: 'RFI #12', sourceType: 'rfi', text: 'RFI regarding footing rebar at continuous footings. Structural response: use #5 rebar at 12 inches on center each way; hook at corners.' },
  { id: 'c3', source: 'Submittal — HVAC RTU-1', sourceType: 'submittal', text: 'Rooftop unit RTU-1, Carrier model 48TC, 5 ton nominal cooling, 460V/3ph. Approved as noted.' },
  { id: 'c4', source: 'Daily Log — 2026-05-02', sourceType: 'daily_log', text: 'Poured lobby slab on grade. Weather clear, 78F. Six crew on site. No safety incidents.' },
];
const system = `You are Sage, answering a general contractor's question using ONLY the numbered project records provided. Rules:
- Answer directly and concisely. Cite every fact with its source number in brackets, e.g. [1].
- If the records don't contain the answer, say so plainly — do NOT invent details.`;

async function ask(client, question) {
  const ranked = rankChunks(question, chunks, 6);
  if (!ranked.length) return { answer: '__NOT_FOUND__', ranked };
  const { context, citations } = buildContext(ranked);
  const resp = await client.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 800, system, messages: [{ role: 'user', content: `QUESTION: ${question}\n\nPROJECT RECORDS:\n${context}` }] });
  return { answer: resp.content.filter((x) => x.type === 'text').map((x) => x.text).join('').trim(), ranked, citations };
}

(async () => {
  const Anthropic = require('@anthropic-ai/sdk').default;
  const client = new Anthropic({ apiKey: KEY });
  let pass = 0, fail = 0; const ok = (n, c, d) => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'} ${n}${d ? ' · ' + d : ''}`); };

  const a1 = await ask(client, 'what tile is specified in the lobby?');
  console.log('\nQ1 tile →', a1.answer.replace(/\n/g, ' '));
  ok('answers with a tile fact', /porcelain|daltile|24|charcoal/i.test(a1.answer));
  ok('cites a source [n]', /\[\d\]/.test(a1.answer));

  const a2 = await ask(client, 'what did the footing rebar RFI say?');
  console.log('Q2 rebar →', a2.answer.replace(/\n/g, ' '));
  ok('answers with rebar detail', /#?5|12|on center/i.test(a2.answer));
  ok('cites a source [n]', /\[\d\]/.test(a2.answer));

  const a3 = await ask(client, 'what is the RTU cooling capacity?');
  console.log('Q3 RTU →', a3.answer.replace(/\n/g, ' '));
  ok('answers 5 ton / Carrier', /5 ?ton|carrier|48tc/i.test(a3.answer));

  // grounding: no record covers electrical subs → retrieval finds nothing → not found
  const a4 = await ask(client, 'who is the electrical subcontractor?');
  console.log('Q4 electrical (absent) →', a4.answer === '__NOT_FOUND__' ? '(no retrieval — route returns not-found)' : a4.answer.replace(/\n/g, ' '));
  ok('absent info → no hallucinated retrieval', a4.ranked.length === 0);

  // grounding under partial match: 'paint color lobby' matches tile chunk (color/lobby) but answer isn't there
  const a5 = await ask(client, 'what paint color is used in the lobby?');
  console.log('Q5 paint (not in docs) →', a5.answer.replace(/\n/g, ' '));
  ok('does not fabricate a paint color', !/paint (color )?(is|shall|=|:)/i.test(a5.answer) || /not|no |couldn|isn|only.*tile|don'?t/i.test(a5.answer));

  console.log(`\n${pass}/${pass + fail} passed`);
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error('ERR', e.message); fs.rmSync(tmp, { recursive: true, force: true }); process.exitCode = 1; });
