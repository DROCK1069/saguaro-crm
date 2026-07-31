/**
 * OAuth2 for the token-based providers (OneDrive/SharePoint, Dropbox, Google
 * Drive, Box). The OAuth *app* credentials are ONE set per app, configured ONCE
 * by the platform super-admin — either in-product (platform_integrations table)
 * or via env — resolved by getAppCreds(). Each tenant then authorizes once with
 * their own account; per-tenant tokens live encrypted in ctx.secret. This module
 * builds the consent URL, exchanges the code, and transparently refreshes tokens.
 */
import type { ConnectorCtx, ProviderId } from './types';
import { getAppCreds, appConfigured, APP_FOR, type OAuthProviderId } from './platform-config';

interface OAuthApp { authUrl: string; tokenUrl: string; scope: string; extraAuth?: Record<string, string> }

const APPS: Record<OAuthProviderId, OAuthApp> = {
  onedrive: {
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope: 'offline_access Files.ReadWrite.All User.Read', extraAuth: { response_mode: 'query' },
  },
  sharepoint: {
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope: 'offline_access Sites.ReadWrite.All Files.ReadWrite.All User.Read', extraAuth: { response_mode: 'query' },
  },
  dropbox: {
    authUrl: 'https://www.dropbox.com/oauth2/authorize',
    tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
    scope: 'files.metadata.read files.content.read files.content.write account_info.read',
    extraAuth: { token_access_type: 'offline' },
  },
  gdrive: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/drive openid email',
    extraAuth: { access_type: 'offline', prompt: 'consent' },
  },
  box: {
    authUrl: 'https://account.box.com/api/oauth2/authorize',
    tokenUrl: 'https://api.box.com/oauth2/token',
    scope: 'root_readwrite',
  },
};

export function isOAuthProvider(p: ProviderId): p is OAuthProviderId {
  return p === 'onedrive' || p === 'sharepoint' || p === 'dropbox' || p === 'gdrive' || p === 'box';
}

/** Configured (DB or env) — drives the "available" flag in the connect UI. */
export async function providerConfigured(p: ProviderId): Promise<boolean> {
  return isOAuthProvider(p) ? appConfigured(APP_FOR[p]) : false;
}

export function redirectUri(origin: string, provider: OAuthProviderId): string {
  return `${origin}/api/storage/oauth/${provider}/callback`;
}

export async function buildAuthUrl(provider: OAuthProviderId, origin: string, state: string): Promise<string> {
  const a = APPS[provider];
  const creds = await getAppCreds(APP_FOR[provider]);
  if (!creds) throw new Error(`${provider} is not configured — set its app credentials in Platform Integrations.`);
  const p = new URLSearchParams({
    client_id: creds.clientId, response_type: 'code', redirect_uri: redirectUri(origin, provider),
    scope: a.scope, state, ...(a.extraAuth || {}),
  });
  return `${a.authUrl}?${p.toString()}`;
}

async function tokenRequest(provider: OAuthProviderId, body: Record<string, string>): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const a = APPS[provider];
  const creds = await getAppCreds(APP_FOR[provider]);
  if (!creds) throw new Error(`${provider} app credentials are not configured.`);
  const res = await fetch(a.tokenUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: creds.clientId, client_secret: creds.clientSecret, ...body }).toString(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error_description || json.error || `token endpoint ${res.status}`);
  return json;
}

/** Exchange an auth code for tokens; returns the secret blob to persist. */
export async function exchangeCode(provider: OAuthProviderId, code: string, origin: string): Promise<Record<string, any>> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const t = await tokenRequest(provider, { grant_type: 'authorization_code', code, redirect_uri: redirectUri(origin, provider) });
  return { access_token: t.access_token, refresh_token: t.refresh_token, expires_at: Date.now() + (Number(t.expires_in || 3600) - 60) * 1000 };
}

/** Return a valid access token for a connector, refreshing + persisting if expired. */
export async function getValidAccessToken(ctx: ConnectorCtx): Promise<string> {
  if (!isOAuthProvider(ctx.provider)) throw new Error('not an oauth provider');
  const s = ctx.secret || {};
  if (s.access_token && typeof s.expires_at === 'number' && s.expires_at > Date.now()) return s.access_token;
  if (!s.refresh_token) throw new Error('Not connected — re-authorize this connection.');
  const t = await tokenRequest(ctx.provider, { grant_type: 'refresh_token', refresh_token: s.refresh_token });
  const next = {
    access_token: t.access_token,
    refresh_token: t.refresh_token || s.refresh_token,
    expires_at: Date.now() + (Number(t.expires_in || 3600) - 60) * 1000,
  };
  if (ctx.saveSecret) await ctx.saveSecret(next);
  ctx.secret = next;
  return next.access_token;
}
