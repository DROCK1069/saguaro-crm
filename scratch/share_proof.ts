// Proof of the takeoff share-link token. Run:
//   npx esbuild scratch/share_proof.ts --bundle --platform=node --format=cjs | node
import { takeoffShareToken, newShareNonce, verifyTakeoffShareToken, SHARE_TTL_MS } from '../lib/takeoff/share';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, got?: unknown) => { if (c) { pass++; console.log('  PASS', n); } else { fail++; console.log('  FAIL', n, '→', got); } };

const id = 'takeoff-123';
const nonce = newShareNonce();
const exp = Date.now() + SHARE_TTL_MS;
const token = takeoffShareToken(id, nonce, exp);

ok('nonce is 32 hex chars', /^[0-9a-f]{32}$/.test(nonce), nonce);
ok('token is 32 hex chars', /^[0-9a-f]{32}$/.test(token), token);
ok('valid token verifies', verifyTakeoffShareToken(id, nonce, exp, token) === true);

ok('wrong id rejected', verifyTakeoffShareToken('other-id', nonce, exp, token) === false);
ok('rotated nonce (revoked) rejected', verifyTakeoffShareToken(id, newShareNonce(), exp, token) === false);
ok('cleared nonce (revoked) rejected', verifyTakeoffShareToken(id, null, exp, token) === false);
ok('tampered expiry rejected', verifyTakeoffShareToken(id, nonce, exp + 1000, token) === false);
ok('flipped token char rejected', verifyTakeoffShareToken(id, nonce, exp, (token[0] === 'a' ? 'b' : 'a') + token.slice(1)) === false);
ok('empty token rejected', verifyTakeoffShareToken(id, nonce, exp, '') === false);

const expiredExp = Date.now() - 1000;
const expiredTok = takeoffShareToken(id, nonce, expiredExp);
ok('expired link rejected even with a genuine token', verifyTakeoffShareToken(id, nonce, expiredExp, expiredTok) === false);

ok('token binds to id (unguessable across ids)', takeoffShareToken('a', nonce, exp) !== takeoffShareToken('b', nonce, exp));
ok('token binds to nonce', takeoffShareToken(id, 'n1'.padEnd(32, '0'), exp) !== takeoffShareToken(id, 'n2'.padEnd(32, '0'), exp));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
