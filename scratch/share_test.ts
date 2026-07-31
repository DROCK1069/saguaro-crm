// Runtime proof for heatmap share tokens. Run:
//   npx esbuild scratch/share_test.ts --bundle --platform=node --format=cjs | node
import { heatmapShareToken, verifyHeatmapShareToken, newShareNonce, SHARE_TTL_MS } from '../lib/heatmap/share';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) { pass++; console.log('  PASS', n); } else { fail++; console.log('  FAIL', n); } };

const id = '11111111-2222-3333-4444-555555555555';
const nonce = newShareNonce();
const now = Date.now();
const futureExp = now + SHARE_TTL_MS;
const pastExp = now - 1000;

const token = heatmapShareToken(id, nonce, futureExp);

console.log('share token verification:');
ok('valid token within expiry verifies', verifyHeatmapShareToken(id, nonce, futureExp, token) === true);
ok('EXPIRED link (exp in past) rejected', verifyHeatmapShareToken(id, nonce, pastExp, heatmapShareToken(id, nonce, pastExp)) === false);
ok('REVOKED (nonce cleared) rejected', verifyHeatmapShareToken(id, null, futureExp, token) === false);
ok('tampered token rejected', verifyHeatmapShareToken(id, nonce, futureExp, token.slice(0, -2) + 'ff') === false);
ok('token bound to exp — different exp rejected', verifyHeatmapShareToken(id, nonce, futureExp + 60000, token) === false);
ok('different nonce (re-mint/rotate) rejected', verifyHeatmapShareToken(id, newShareNonce(), futureExp, token) === false);
ok('empty token rejected', verifyHeatmapShareToken(id, nonce, futureExp, '') === false);
ok('nonce is unguessable (32 hex chars)', /^[0-9a-f]{32}$/.test(nonce));
ok('two nonces differ', newShareNonce() !== newShareNonce());

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
