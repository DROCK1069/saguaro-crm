#!/usr/bin/env node
/**
 * ship.mjs — the ONE ship command for Saguaro web.
 *
 * Runs the full quality gate + deploy + live verification, sequentially,
 * aborting on the first failure. Every step streams its output.
 *
 *   1. UI standards audit        node scripts/audit-ui-standards.mjs
 *   2. Type check                npx tsc --noEmit
 *   3. Production build          npx next build   (NODE_OPTIONS=--max-old-space-size=6144)
 *   4. Dataflow proof            npx tsx scripts/proof-dataflow.ts
 *   5. Autobuild proof           npx tsx scripts/proof-autobuild.ts
 *   6. Deploy                    npx vercel deploy --prod --yes
 *   7. Live verify               GET https://saguarocontrol.net        -> 200
 *                                GET /api/project-context?projectId=x  -> 401 (route exists + auth gate)
 *
 * Usage: node scripts/ship.mjs   (or: npm run ship)
 * No dependencies. Node >= 18 (global fetch), ESM. Cross-platform (shell: true).
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIVE_URL = 'https://saguarocontrol.net';

const WIDTH = 64;
const bar = (ch) => ch.repeat(WIDTH);

function banner(text) {
  console.log(`\n${bar('=')}\n  ${text}\n${bar('=')}`);
}

function stepResult(label, ok, extra = '') {
  const verdict = ok ? 'PASS' : 'FAIL';
  console.log(`\n${bar('-')}\n  [${verdict}] ${label}${extra ? ` — ${extra}` : ''}\n${bar('-')}`);
}

function abort(label) {
  banner(`ABORTED at step: ${label}`);
  process.exit(1);
}

/** Run a command, streaming output, abort pipeline on non-zero exit. */
function run(label, command, extraEnv = {}) {
  banner(`STEP: ${label}\n  $ ${command}`);
  const res = spawnSync(command, {
    cwd: ROOT,
    shell: true, // cross-platform: resolves npx/node on Windows and POSIX
    stdio: 'inherit', // stream output live
    env: { ...process.env, ...extraEnv },
  });
  const ok = res.status === 0 && !res.error;
  stepResult(label, ok, ok ? '' : `exit code ${res.status ?? 'n/a'}${res.error ? ` (${res.error.message})` : ''}`);
  if (!ok) abort(label);
}

/** Fetch a URL and assert the expected HTTP status. */
async function verifyStatus(label, url, expected) {
  banner(`STEP: ${label}\n  GET ${url}  (expect HTTP ${expected})`);
  let ok = false;
  let detail = '';
  try {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(30000) });
    detail = `got HTTP ${res.status}`;
    ok = res.status === expected;
  } catch (err) {
    detail = `fetch failed: ${err && err.message ? err.message : err}`;
  }
  stepResult(label, ok, detail);
  if (!ok) abort(label);
}

async function main() {
  const t0 = Date.now();
  banner(`SAGUARO SHIP PIPELINE\n  root: ${ROOT}\n  target: ${LIVE_URL}`);

  // (a) UI standards audit — the standing quality machine gate
  run('UI standards audit', 'node scripts/audit-ui-standards.mjs');

  // (b) Type check
  run('TypeScript check', 'npx tsc --noEmit');

  // (c) Production build (bumped heap — cross-platform via env spread)
  run('Next.js production build', 'npx next build', {
    NODE_OPTIONS: '--max-old-space-size=6144',
  });

  // (d) Dataflow proof
  run('Dataflow proof', 'npx tsx scripts/proof-dataflow.ts');

  // (e) Autobuild proof
  run('Autobuild proof', 'npx tsx scripts/proof-autobuild.ts');

  // (f) Deploy to production
  run('Vercel production deploy', 'npx vercel deploy --prod --yes');

  // (g) Live verification
  await verifyStatus('Live verify: site up', LIVE_URL, 200);
  await verifyStatus(
    'Live verify: API auth gate',
    `${LIVE_URL}/api/project-context?projectId=x`,
    401
  );

  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  banner(`SHIPPED — all steps passed in ${mins} min\n  live: ${LIVE_URL}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  banner('ABORTED — unexpected pipeline error');
  process.exit(1);
});
