/**
 * scratch/apikey_proof.ts
 * -------------------------------------------------------------------------
 * Proves the API-key hash + verify round-trip WITHOUT a live DB:
 *   1. Mint a key EXACTLY the way the Integration Hub route does
 *      (sk_live_ + 32 random bytes; key_hash = sha256(fullKey) hex).
 *   2. Assert the mint-side hash === the lib's hashApiKey() output
 *      (same algorithm both sides — the core requirement).
 *   3. Build an in-memory api_keys table and run a verifier that mirrors
 *      lib/api-key-auth.ts::authenticateApiKey's lookup logic.
 *   4. Assert: correct key authenticates → right tenant/scopes;
 *      wrong key, tampered key, revoked key, and malformed key all fail.
 *
 * Build+run:
 *   npx esbuild scratch/apikey_proof.ts --bundle --platform=node \
 *     --format=cjs --packages=external --tsconfig=tsconfig.json \
 *     --outfile=scratch/apikey_proof.cjs
 *   NEXT_PUBLIC_SUPABASE_URL=http://x NEXT_PUBLIC_SUPABASE_ANON_KEY=x \
 *     SUPABASE_SERVICE_ROLE_KEY=x node scratch/apikey_proof.cjs
 * -------------------------------------------------------------------------
 */
import { createHash, randomBytes } from 'node:crypto';
import { hashApiKey, looksLikeApiKey } from '../lib/api-key-auth';

/* ---- In-memory stand-in for the api_keys table ---- */
interface ApiKeyRow {
  id: string;
  tenant_id: string;
  key_hash: string;
  key_prefix: string;
  scopes: string[];
  revoked_at: string | null;
}
const TABLE: ApiKeyRow[] = [];

/** Mint exactly like app/api/integrations/api-keys/route.ts POST. */
function mint(tenantId: string, scopes: string[], revoked = false): string {
  const fullKey = 'sk_live_' + randomBytes(32).toString('hex');
  const keyPrefix = fullKey.slice(0, 12);
  const keyHash = createHash('sha256').update(fullKey).digest('hex'); // mint-side hash
  TABLE.push({
    id: 'key_' + randomBytes(4).toString('hex'),
    tenant_id: tenantId,
    key_hash: keyHash,
    key_prefix: keyPrefix,
    scopes,
    revoked_at: revoked ? new Date().toISOString() : null,
  });
  return fullKey;
}

type VerifyResult =
  | { ok: true; tenantId: string; scopes: string[] }
  | { ok: false; status: number; error: string };

/** Mirrors lib/api-key-auth.ts::authenticateApiKey against the in-memory table. */
function verify(bearer: string | null): VerifyResult {
  if (!bearer) return { ok: false, status: 401, error: 'Missing Authorization' };
  if (!looksLikeApiKey(bearer)) return { ok: false, status: 401, error: 'Invalid API key format' };
  const keyHash = hashApiKey(bearer); // <-- the REAL lib hash function
  const row = TABLE.find((r) => r.key_hash === keyHash) ?? null;
  if (!row) return { ok: false, status: 401, error: 'Invalid API key' };
  if (row.revoked_at) return { ok: false, status: 401, error: 'API key has been revoked' };
  return { ok: true, tenantId: row.tenant_id, scopes: row.scopes };
}

/* ---- Assertions ---- */
let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}`); }
}

console.log('API key hash + verify round-trip proof\n');

// 0. Hash algorithm parity: mint-side sha256 === lib hashApiKey()
const sample = 'sk_live_' + randomBytes(32).toString('hex');
const mintHash = createHash('sha256').update(sample).digest('hex');
check('lib hashApiKey() matches mint-side sha256(fullKey)', hashApiKey(sample) === mintHash);
check('hashApiKey() is 64 hex chars', /^[0-9a-f]{64}$/.test(hashApiKey(sample)));
check('looksLikeApiKey() accepts a freshly minted key', looksLikeApiKey(sample));

// 1. A key minted the hub's way authenticates → correct tenant + scopes
const goodKey = mint('tenant-alpha', ['read', 'write']);
const goodRes = verify(goodKey);
check('minted key authenticates (ok)', goodRes.ok === true);
check('authenticated tenant is the key owner', goodRes.ok && goodRes.tenantId === 'tenant-alpha');
check('authenticated scopes round-trip', goodRes.ok && goodRes.scopes.join(',') === 'read,write');

// 2. Tenant isolation — a different tenant's key resolves to its OWN tenant
const otherKey = mint('tenant-beta', ['read']);
const otherRes = verify(otherKey);
check('second tenant key resolves to tenant-beta', otherRes.ok && otherRes.tenantId === 'tenant-beta');
check('keys do not cross tenants', otherRes.ok && otherRes.tenantId !== 'tenant-alpha');

// 3. A wrong key (never minted) fails
const wrongKey = 'sk_live_' + randomBytes(32).toString('hex');
const wrongRes = verify(wrongKey);
check('never-minted key is rejected', wrongRes.ok === false && (wrongRes as any).status === 401);

// 4. A tampered key (one char flipped) fails — hash no longer matches
const tampered = goodKey.slice(0, -1) + (goodKey.endsWith('a') ? 'b' : 'a');
check('tampered key is rejected', verify(tampered).ok === false);

// 5. A revoked key fails even though the hash matches
const revokedKey = mint('tenant-alpha', ['read'], /* revoked */ true);
const revokedRes = verify(revokedKey);
check('revoked key is rejected', revokedRes.ok === false && (revokedRes as any).error.includes('revoked'));

// 6. Malformed tokens fail format check (never even hit the table)
check('missing bearer rejected', verify(null).ok === false);
check('non-sk_live token rejected', verify('Bearer-abc123').ok === false);
check('session JWT shape rejected', verify('eyJhbGci.eyJzdWIi.sig').ok === false);
check('sk_live with wrong length rejected', verify('sk_live_deadbeef').ok === false);

console.log(`\n${passed}/${passed + failed} checks passed`);
if (failed > 0) { console.error('PROOF FAILED'); process.exit(1); }
console.log('PROOF OK');
