/**
 * lib/tile-token.ts — short-lived signed tokens for private DZI tile access.
 *
 * OpenSeadragon loads tiles from many places (main viewer via AJAX, but the
 * navigator/minimap and some fallbacks via plain <img>), so an Authorization
 * header can't cover every request. Instead we mint a short-lived HMAC token,
 * scoped to one sheet + tenant, and put it in the tile URL query string — every
 * request type carries it. The proxy verifies it without a round-trip.
 *
 * Secret: TILE_TOKEN_SECRET if set, else the service-role key (always present
 * server-side, never shipped to the client).
 */
import { createHmac, timingSafeEqual } from 'crypto';

const SECRET = process.env.TILE_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev-tile-secret';
const DEFAULT_TTL = 60 * 60 * 2; // 2h

function b64url(s: string): string { return Buffer.from(s).toString('base64url'); }
function sign(payload: string): string { return createHmac('sha256', SECRET).update(payload).digest('base64url'); }

/** Mint a token granting access to `sheetId` for `tenantId`, valid for `ttlSec`. */
export function signTileToken(sheetId: string, tenantId: string, ttlSec = DEFAULT_TTL): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const sig = sign(`${sheetId}.${tenantId}.${exp}`);
  return b64url(`${tenantId}:${exp}:${sig}`);
}

/** Verify a token for `sheetId`. Returns { tenantId } if valid + unexpired, else null. */
export function verifyTileToken(token: string, sheetId: string): { tenantId: string } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const [tenantId, expStr, sig] = decoded.split(':');
    if (!tenantId || !expStr || !sig) return null;
    const exp = parseInt(expStr, 10);
    if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;
    const expected = sign(`${sheetId}.${tenantId}.${exp}`);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return { tenantId };
  } catch {
    return null;
  }
}
