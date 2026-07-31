/**
 * SSRF guard for outbound requests to user-supplied hosts (e.g. a UniFi controller URL).
 *
 * Closes three real holes that a naive `fetch(userHost)` leaves open:
 *  1. Literal-IP / private-target SSRF — ipBlocked() rejects RFC1918, loopback,
 *     link-local + cloud metadata (169.254.169.254), CGNAT, ULA/link-local IPv6.
 *  2. DNS-rebinding (TOCTOU) — the block is enforced at CONNECT time via a custom
 *     `lookup` that re-resolves and only ever hands the socket a validated public IP.
 *     There is no window between "check" and "connect" for the record to flip.
 *  3. Redirect-to-metadata + header replay — safeGetJson() does NOT follow redirects,
 *     so a vetted public host cannot 30x us to an internal address with our secret
 *     headers (e.g. X-API-Key) attached.
 *
 * Uses Node's built-in http/https + dns only (no extra dependency). TLS SNI is
 * preserved because the hostname stays in the URL; only DNS resolution is guarded.
 */
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import { isIP, type LookupFunction } from 'node:net';

export function ipv4Private(ip: string): boolean {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false;
  const [a, b] = p;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) || // link-local + cloud metadata (169.254.169.254)
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) // CGNAT
  );
}

export function ipBlocked(ip: string): boolean {
  const low = ip.toLowerCase();
  if (low === '::1' || low === '::') return true;
  if (/^(fc|fd|fe8|fe9|fea|feb)/.test(low)) return true; // ULA + link-local IPv6
  const mapped = low.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4Private(mapped[1]);
  return ipv4Private(ip);
}

/** node dns lookup signature that only resolves to a validated PUBLIC address. */
type LookupCb = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;
export function guardedLookup(
  hostname: string,
  options: { all?: boolean; family?: number } | LookupCb,
  callback?: LookupCb
): void {
  const cb = (typeof options === 'function' ? options : callback) as LookupCb;
  const opts = (typeof options === 'function' ? {} : options) || {};
  dnsLookup(hostname, { all: true }, (err, addresses) => {
    if (err) return cb(err, '', 0);
    const list = (Array.isArray(addresses) ? addresses : []) as LookupAddress[];
    const good = list.find((a) => !ipBlocked(a.address));
    if (!good) {
      const e = Object.assign(new Error('SSRF_BLOCKED: host resolves to a private/internal address'), {
        code: 'SSRF_BLOCKED',
      }) as NodeJS.ErrnoException;
      return cb(e, '', 0);
    }
    if (opts.all) return cb(null, [good]);
    cb(null, good.address, good.family);
  });
}

export interface SafeGetResult {
  status: number;
  json?: unknown;
  redirected?: boolean;
  blocked?: boolean;
}

/**
 * GET a URL as JSON with the full SSRF guard. Never follows redirects. Enforces a
 * timeout and a hard body cap. `headers` (e.g. an API key) are only ever sent to the
 * validated origin — a redirect is surfaced, not chased.
 */
export function safeGetJson(
  urlStr: string,
  headers: Record<string, string>,
  timeoutMs = 8000,
  maxBytes = 5_000_000
): Promise<SafeGetResult> {
  return new Promise((resolve, reject) => {
    let u: URL;
    try {
      u = new URL(urlStr);
    } catch {
      return reject(Object.assign(new Error('Invalid URL'), { code: 'BAD_URL' }));
    }
    // Literal-IP hosts skip Node's `lookup` entirely (no DNS needed), so guardedLookup
    // would never fire. Validate them here before we ever open a socket.
    const literal = u.hostname.replace(/^\[|\]$/g, '');
    if (isIP(literal) && ipBlocked(literal)) {
      return reject(Object.assign(new Error('SSRF_BLOCKED: private/internal literal IP'), { code: 'SSRF_BLOCKED' }));
    }
    const isHttps = u.protocol === 'https:';
    const requester = isHttps ? httpsRequest : httpRequest;
    const req = requester(
      u,
      {
        method: 'GET',
        headers,
        // guardedLookup follows the dns.lookup calling convention at runtime; the cast only
        // bridges @types/node's LookupOptions.family (number|"IPv4"|"IPv6") union, which we
        // never read. Connect-time re-validation (kills DNS rebind).
        lookup: guardedLookup as unknown as LookupFunction,
        timeout: timeoutMs,
        ...(isHttps ? { servername: u.hostname } : {}),
      },
      (res) => {
        const status = res.statusCode || 0;
        // NEVER follow redirects — do not replay auth headers to a new origin.
        if (status >= 300 && status < 400) {
          res.destroy();
          return resolve({ status, redirected: true });
        }
        let body = '';
        let bytes = 0;
        res.setEncoding('utf8');
        res.on('data', (c: string) => {
          bytes += Buffer.byteLength(c);
          if (bytes > maxBytes) {
            req.destroy();
            return;
          }
          body += c;
        });
        res.on('end', () => {
          try {
            resolve({ status, json: body ? JSON.parse(body) : undefined });
          } catch {
            resolve({ status });
          }
        });
      }
    );
    req.on('timeout', () => req.destroy(Object.assign(new Error('TIMEOUT'), { code: 'TIMEOUT' })));
    req.on('error', (e) => reject(e));
    req.end();
  });
}
