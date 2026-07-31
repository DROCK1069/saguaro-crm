"use strict";

// scratch/apikey_proof.ts
var import_node_crypto2 = require("node:crypto");

// lib/api-key-auth.ts
var import_node_crypto = require("node:crypto");
var import_server = require("next/server");

// lib/supabase-server.ts
var import_supabase_js = require("@supabase/supabase-js");
var _URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
var _ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
var _SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!_URL || !_ANON || !_SERVICE) {
  throw new Error(
    "Missing required Supabase environment variables: " + [!_URL && "NEXT_PUBLIC_SUPABASE_URL", !_ANON && "NEXT_PUBLIC_SUPABASE_ANON_KEY", !_SERVICE && "SUPABASE_SERVICE_ROLE_KEY"].filter(Boolean).join(", ")
  );
}
var URL = _URL;
var SERVICE = _SERVICE;
var _serviceClient = null;
function createServerClient() {
  if (_serviceClient) return _serviceClient;
  _serviceClient = (0, import_supabase_js.createClient)(URL, SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false },
    // The App Router caches fetch() by default, and supabase-js queries run through
    // fetch — so a parameterless read (e.g. "select * from platform_integrations")
    // gets frozen at its first result. Force no-store so service-role reads are
    // ALWAYS fresh (correct for a data API; avoids stale-empty reads after a write).
    global: { fetch: (input, init) => fetch(input, { ...init || {}, cache: "no-store" }) }
    // eslint-disable-line @typescript-eslint/no-explicit-any
  });
  return _serviceClient;
}
var supabaseAdmin = createServerClient();

// lib/api-key-auth.ts
function looksLikeApiKey(token) {
  return /^sk_live_[0-9a-f]{64}$/.test(token);
}
function hashApiKey(fullKey) {
  return (0, import_node_crypto.createHash)("sha256").update(fullKey).digest("hex");
}

// scratch/apikey_proof.ts
var TABLE = [];
function mint(tenantId, scopes, revoked = false) {
  const fullKey = "sk_live_" + (0, import_node_crypto2.randomBytes)(32).toString("hex");
  const keyPrefix = fullKey.slice(0, 12);
  const keyHash = (0, import_node_crypto2.createHash)("sha256").update(fullKey).digest("hex");
  TABLE.push({
    id: "key_" + (0, import_node_crypto2.randomBytes)(4).toString("hex"),
    tenant_id: tenantId,
    key_hash: keyHash,
    key_prefix: keyPrefix,
    scopes,
    revoked_at: revoked ? (/* @__PURE__ */ new Date()).toISOString() : null
  });
  return fullKey;
}
function verify(bearer) {
  if (!bearer) return { ok: false, status: 401, error: "Missing Authorization" };
  if (!looksLikeApiKey(bearer)) return { ok: false, status: 401, error: "Invalid API key format" };
  const keyHash = hashApiKey(bearer);
  const row = TABLE.find((r) => r.key_hash === keyHash) ?? null;
  if (!row) return { ok: false, status: 401, error: "Invalid API key" };
  if (row.revoked_at) return { ok: false, status: 401, error: "API key has been revoked" };
  return { ok: true, tenantId: row.tenant_id, scopes: row.scopes };
}
var passed = 0;
var failed = 0;
function check(name, cond) {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}`);
  }
}
console.log("API key hash + verify round-trip proof\n");
var sample = "sk_live_" + (0, import_node_crypto2.randomBytes)(32).toString("hex");
var mintHash = (0, import_node_crypto2.createHash)("sha256").update(sample).digest("hex");
check("lib hashApiKey() matches mint-side sha256(fullKey)", hashApiKey(sample) === mintHash);
check("hashApiKey() is 64 hex chars", /^[0-9a-f]{64}$/.test(hashApiKey(sample)));
check("looksLikeApiKey() accepts a freshly minted key", looksLikeApiKey(sample));
var goodKey = mint("tenant-alpha", ["read", "write"]);
var goodRes = verify(goodKey);
check("minted key authenticates (ok)", goodRes.ok === true);
check("authenticated tenant is the key owner", goodRes.ok && goodRes.tenantId === "tenant-alpha");
check("authenticated scopes round-trip", goodRes.ok && goodRes.scopes.join(",") === "read,write");
var otherKey = mint("tenant-beta", ["read"]);
var otherRes = verify(otherKey);
check("second tenant key resolves to tenant-beta", otherRes.ok && otherRes.tenantId === "tenant-beta");
check("keys do not cross tenants", otherRes.ok && otherRes.tenantId !== "tenant-alpha");
var wrongKey = "sk_live_" + (0, import_node_crypto2.randomBytes)(32).toString("hex");
var wrongRes = verify(wrongKey);
check("never-minted key is rejected", wrongRes.ok === false && wrongRes.status === 401);
var tampered = goodKey.slice(0, -1) + (goodKey.endsWith("a") ? "b" : "a");
check("tampered key is rejected", verify(tampered).ok === false);
var revokedKey = mint(
  "tenant-alpha",
  ["read"],
  /* revoked */
  true
);
var revokedRes = verify(revokedKey);
check("revoked key is rejected", revokedRes.ok === false && revokedRes.error.includes("revoked"));
check("missing bearer rejected", verify(null).ok === false);
check("non-sk_live token rejected", verify("Bearer-abc123").ok === false);
check("session JWT shape rejected", verify("eyJhbGci.eyJzdWIi.sig").ok === false);
check("sk_live with wrong length rejected", verify("sk_live_deadbeef").ok === false);
console.log(`
${passed}/${passed + failed} checks passed`);
if (failed > 0) {
  console.error("PROOF FAILED");
  process.exit(1);
}
console.log("PROOF OK");
