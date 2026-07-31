// Runtime proof for the SSRF guard. Run: npx esbuild scratch/ssrf_test.ts --bundle --platform=node --format=cjs | node
import { ipBlocked, guardedLookup, safeGetJson } from '../lib/ssrf';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean) { if (cond) { pass++; console.log('  PASS', name); } else { fail++; console.log('  FAIL', name); } }

// 1) ipBlocked table — metadata/private/loopback must be blocked; real public must pass.
console.log('ipBlocked table:');
ok('169.254.169.254 (cloud metadata) blocked', ipBlocked('169.254.169.254') === true);
ok('10.0.0.5 (RFC1918) blocked', ipBlocked('10.0.0.5') === true);
ok('172.16.9.9 (RFC1918) blocked', ipBlocked('172.16.9.9') === true);
ok('192.168.1.1 (RFC1918) blocked', ipBlocked('192.168.1.1') === true);
ok('127.0.0.1 (loopback) blocked', ipBlocked('127.0.0.1') === true);
ok('100.64.0.1 (CGNAT) blocked', ipBlocked('100.64.0.1') === true);
ok('::1 (IPv6 loopback) blocked', ipBlocked('::1') === true);
ok('::ffff:127.0.0.1 (mapped loopback) blocked', ipBlocked('::ffff:127.0.0.1') === true);
ok('fd00::1 (ULA) blocked', ipBlocked('fd00::1') === true);
ok('8.8.8.8 (public) ALLOWED', ipBlocked('8.8.8.8') === false);
ok('1.1.1.1 (public) ALLOWED', ipBlocked('1.1.1.1') === false);

// 2) guardedLookup must REJECT a hostname that resolves only to a private IP (localhost -> 127.0.0.1).
//    This is the connect-time gate that closes DNS rebinding.
function lookupResult(host: string): Promise<{ err?: string; addr?: string }> {
  return new Promise((resolve) => {
    guardedLookup(host, { all: false }, (err: any, addr: any) => {
      resolve(err ? { err: err.code || err.message } : { addr: String(addr) });
    });
  });
}

(async () => {
  console.log('guardedLookup (connect-time gate):');
  const lh = await lookupResult('localhost');
  ok('localhost -> SSRF_BLOCKED (not a public IP)', lh.err === 'SSRF_BLOCKED');

  const pub = await lookupResult('one.one.one.one'); // Cloudflare, resolves to 1.1.1.1 (public) if DNS available
  ok('one.one.one.one -> resolves to a public IP (or DNS unavailable)', !!pub.addr || pub.err === 'ENOTFOUND' || pub.err === 'EAI_AGAIN');

  // 3) safeGetJson must REFUSE to connect to a metadata literal (guard fires at connect).
  console.log('safeGetJson (no metadata, no redirect-follow):');
  let blockedMeta = false;
  try {
    await safeGetJson('http://169.254.169.254/latest/meta-data/', { 'X-Secret': 'should-never-leave' }, 2000);
  } catch (e: any) {
    blockedMeta = e?.code === 'SSRF_BLOCKED';
  }
  ok('GET http://169.254.169.254 blocked at connect (secret not sent)', blockedMeta);

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
