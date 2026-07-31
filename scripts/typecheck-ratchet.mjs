#!/usr/bin/env node
/**
 * Type-check ratchet.
 *
 * The Supabase client is now typed against the live DB schema
 * (lib/database.types.ts), so wrong columns/shapes in `.from().insert()/.select()`
 * become TypeScript errors. The repo still has a backlog of pre-existing type
 * errors (type-checking was disabled in next.config for a long time), so we
 * can't fail the build on ALL of them yet — instead this gate fails CI only
 * when the error count INCREASES over the committed baseline.
 *
 * Net effect: a new feature can no longer silently reintroduce schema drift —
 * any new wrong-column query bumps the count and fails the PR. As errors are
 * fixed, the baseline ratchets down automatically (run locally and commit
 * .typecheck-baseline). Once it reaches 0, flip
 * `typescript.ignoreBuildErrors` to false in next.config.js for full
 * build-time enforcement.
 *
 * Regenerate types after a schema change:  npm run db:types
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const BASELINE_FILE = '.typecheck-baseline';

let out = '';
try {
  out = execSync('npx tsc --noEmit', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
} catch (e) {
  out = `${e.stdout || ''}${e.stderr || ''}`;
}

const count = (out.match(/error TS\d+/g) || []).length;
const baseline = existsSync(BASELINE_FILE)
  ? parseInt(readFileSync(BASELINE_FILE, 'utf8').trim(), 10) || 0
  : Number.POSITIVE_INFINITY;

console.log(`tsc error count: ${count}  (baseline: ${baseline})`);

if (count > baseline) {
  console.error(`\n❌ Type errors increased by ${count - baseline} over the baseline.`);
  console.error('   A new/edited file has a type error — most likely a wrong DB column or response shape.');
  console.error('   Fix the error. Do NOT raise the baseline just to make CI pass.\n');
  process.exit(1);
}

if (count < baseline && Number.isFinite(baseline)) {
  writeFileSync(BASELINE_FILE, `${count}\n`);
  console.log(`✅ Improved — lowering baseline ${baseline} → ${count}. Commit ${BASELINE_FILE}.`);
}

console.log('✅ Type-check ratchet passed.');
