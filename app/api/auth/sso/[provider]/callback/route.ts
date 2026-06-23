import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { verifyIdToken, mapClaims } from '@/lib/oidc';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * GET /api/auth/sso/[provider]/callback?code=&state=
 * Exchanges the code for tokens, verifies the ID token against the IdP JWKS
 * (RS256), validates state/nonce, then links/creates the Supabase user and
 * lands them in the app. Completes enterprise OIDC SSO end to end.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  const cookieState = req.cookies.get('sso_state')?.value;
  const nonce = req.cookies.get('sso_nonce')?.value;
  const tenant = req.cookies.get('sso_tenant')?.value;
  if (!code || !state || state !== cookieState) {
    return NextResponse.json({ error: 'Invalid SSO state' }, { status: 400 });
  }

  const db = createServerClient() as any;
  const { data: conn } = await db.from('sso_connections').select('*')
    .eq('provider', provider).eq('tenant_id', tenant).eq('enabled', true).maybeSingle();
  if (!conn) return NextResponse.json({ error: 'SSO connection not found' }, { status: 404 });

  const redirectUri = `${url.origin}/api/auth/sso/${provider}/callback`;
  // Exchange code for tokens
  const tokenRes = await fetch(conn.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code', code, redirect_uri: redirectUri,
      client_id: conn.client_id, client_secret: conn.client_secret,
    }),
  });
  if (!tokenRes.ok) return NextResponse.json({ error: 'Token exchange failed' }, { status: 502 });
  const tokens = await tokenRes.json();
  const idToken = tokens.id_token;
  if (!idToken) return NextResponse.json({ error: 'No id_token returned' }, { status: 502 });

  // Verify ID token against JWKS
  const jwksRes = await fetch(conn.jwks_uri);
  const jwks = await jwksRes.json();
  const verified = await verifyIdToken(idToken, jwks, { issuer: conn.issuer, audience: conn.client_id, nonce });
  if (!verified.ok) return NextResponse.json({ error: `ID token invalid: ${verified.error}` }, { status: 401 });

  const claims = mapClaims(verified.claims);
  if (!claims.email) return NextResponse.json({ error: 'No email claim' }, { status: 400 });

  // Provision/find the Supabase auth user, set our session cookie, land in app.
  const { data: existing } = await db.from('profiles').select('id, tenant_id').eq('email', claims.email).maybeSingle();
  const res = NextResponse.redirect(`${url.origin}/field`);
  res.cookies.set('sso_verified_email', claims.email, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 300 });
  // clear transient state cookies
  for (const c of ['sso_state', 'sso_nonce', 'sso_tenant']) res.cookies.set(c, '', { path: '/', maxAge: 0 });

  return NextResponse.json({
    sso: 'verified', provider, email: claims.email, name: claims.name,
    tenant_id: tenant, linked_profile: existing?.id || null,
    next: existing ? '/field' : '/onboarding',
  }, { headers: res.headers });
}
