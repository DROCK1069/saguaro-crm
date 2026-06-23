import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { buildAuthorizeUrl } from '@/lib/oidc';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * GET /api/auth/sso/[provider]/authorize?tenant=<id>
 * Looks up the tenant's OIDC connection and redirects the browser to the IdP
 * authorize endpoint with state + nonce (set as cookies for the callback).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(req.url);
  const tenant = url.searchParams.get('tenant');
  const db = createServerClient() as any;

  let q = db.from('sso_connections').select('*').eq('provider', provider).eq('enabled', true);
  if (tenant) q = q.eq('tenant_id', tenant);
  const { data: conn } = await q.limit(1).maybeSingle();
  if (!conn) return NextResponse.json({ error: 'SSO not configured for this provider/tenant' }, { status: 404 });

  const state = randomBytes(16).toString('hex');
  const nonce = randomBytes(16).toString('hex');
  const redirectUri = `${url.origin}/api/auth/sso/${provider}/callback`;

  const authorizeUrl = buildAuthorizeUrl({
    authorization_endpoint: conn.authorization_endpoint,
    client_id: conn.client_id,
    redirect_uri: redirectUri,
    scope: 'openid email profile',
    state, nonce,
  });

  const res = NextResponse.redirect(authorizeUrl);
  const opts = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/', maxAge: 600 };
  res.cookies.set('sso_state', state, opts);
  res.cookies.set('sso_nonce', nonce, opts);
  res.cookies.set('sso_tenant', conn.tenant_id, opts);
  return res;
}
