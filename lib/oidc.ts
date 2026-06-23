/**
 * lib/oidc.ts — OpenID Connect (SSO) helpers: build the authorize URL, and
 * verify an RS256 ID token against a provider JWKS using Web Crypto (no deps).
 *
 * This is the modern enterprise SSO standard (Okta, Azure AD/Entra, Google
 * Workspace, Auth0). SAML can be layered later; OIDC covers the same IdPs.
 */

function b64urlToBytes(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function b64urlToJson(s: string): any {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));
}

export interface AuthorizeParams {
  authorization_endpoint: string;
  client_id: string;
  redirect_uri: string;
  scope?: string;
  state: string;
  nonce: string;
}
export function buildAuthorizeUrl(p: AuthorizeParams): string {
  const u = new URL(p.authorization_endpoint);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', p.client_id);
  u.searchParams.set('redirect_uri', p.redirect_uri);
  u.searchParams.set('scope', p.scope || 'openid email profile');
  u.searchParams.set('state', p.state);
  u.searchParams.set('nonce', p.nonce);
  return u.toString();
}

export interface JWK { kid?: string; kty: string; n?: string; e?: string; alg?: string; use?: string }
export interface VerifyOpts { issuer: string; audience: string; nonce?: string; now?: number }
export interface VerifiedToken { ok: boolean; claims?: any; error?: string }

/** Verify a signed RS256 JWT against a JWKS and validate iss/aud/exp/nonce. */
export async function verifyIdToken(idToken: string, jwks: { keys: JWK[] }, opts: VerifyOpts): Promise<VerifiedToken> {
  try {
    const [h, p, s] = idToken.split('.');
    if (!h || !p || !s) return { ok: false, error: 'malformed token' };
    const header = b64urlToJson(h);
    const claims = b64urlToJson(p);

    if (header.alg !== 'RS256') return { ok: false, error: `unsupported alg ${header.alg}` };
    const jwk = jwks.keys.find((k) => k.kid === header.kid) || jwks.keys.find((k) => k.kty === 'RSA');
    if (!jwk) return { ok: false, error: 'no matching JWK' };

    const key = await crypto.subtle.importKey(
      'jwk',
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true } as JsonWebKey,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const data = new TextEncoder().encode(`${h}.${p}`);
    const sig = b64urlToBytes(s);
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5', key,
      sig as unknown as BufferSource,
      data as unknown as BufferSource,
    );
    if (!valid) return { ok: false, error: 'signature invalid' };

    const now = opts.now ?? Math.floor(Date.now() / 1000);
    if (claims.exp && now > claims.exp) return { ok: false, error: 'token expired' };
    if (claims.iss !== opts.issuer) return { ok: false, error: 'issuer mismatch' };
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!aud.includes(opts.audience)) return { ok: false, error: 'audience mismatch' };
    if (opts.nonce && claims.nonce !== opts.nonce) return { ok: false, error: 'nonce mismatch' };

    return { ok: true, claims };
  } catch (e) {
    return { ok: false, error: String((e as Error).message || e) };
  }
}

export function mapClaims(claims: any): { email: string | null; name: string | null; sub: string } {
  return {
    email: (claims.email || claims.preferred_username || null)?.toLowerCase?.() || null,
    name: claims.name || claims.given_name || null,
    sub: claims.sub,
  };
}
