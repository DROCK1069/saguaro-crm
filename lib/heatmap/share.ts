/**
 * Read-only heatmap share links.
 *
 * The token is an HMAC bound to THREE things: the design id, a per-design random
 * `share_nonce`, and the link's expiry (ms). That makes a link:
 *   - unguessable (can't enumerate by id — needs the secret + the nonce),
 *   - expiring (past `expMs` the token is rejected),
 *   - revocable (clear/rotate `share_nonce` in the row → every prior link dies),
 * without breaking other tenants (no shared global that has to be rotated).
 * Server-only.
 */
import { createHmac, timingSafeEqual, randomBytes } from 'crypto';

export const SHARE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function secret(): string {
  return process.env.HEATMAP_SHARE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'saguaro-heatmap-share-dev';
}

/** Fresh random nonce for a design's share link (rotating it revokes existing links). */
export function newShareNonce(): string {
  return randomBytes(16).toString('hex');
}

/** Token = HMAC(secret, id:nonce:expMs). Changing nonce or expMs invalidates it. */
export function heatmapShareToken(id: string, nonce: string, expMs: number): string {
  return createHmac('sha256', secret()).update(`heatmap-design:${id}:${nonce}:${expMs}`).digest('hex').slice(0, 32);
}

/** Constant-time verify. Fails if revoked (no nonce), expired, or tampered. */
export function verifyHeatmapShareToken(
  id: string,
  nonce: string | null | undefined,
  expMs: number,
  token: string,
): boolean {
  if (!nonce || !token || !Number.isFinite(expMs)) return false;
  if (Date.now() > expMs) return false; // expired
  const expected = heatmapShareToken(id, nonce, expMs);
  if (token.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  } catch {
    return false;
  }
}
