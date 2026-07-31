/**
 * Resolves OAuth *app* credentials for a provider. Priority:
 *   1. In-product config (platform_integrations table, set by the super-admin) —
 *      the professional path, no env juggling.
 *   2. Environment variables — fallback for ops that prefer env.
 * One app backs one-or-more providers: microsoft → onedrive + sharepoint,
 * google → gdrive, dropbox → dropbox, box → box.
 */
import { createServerClient } from '@/lib/supabase-server';
import { decryptSecret } from '@/lib/crypto-secrets';

export type OAuthApp = 'microsoft' | 'dropbox' | 'google' | 'box';
export type OAuthProviderId = 'onedrive' | 'sharepoint' | 'dropbox' | 'gdrive' | 'box';

export const APP_FOR: Record<OAuthProviderId, OAuthApp> = {
  onedrive: 'microsoft', sharepoint: 'microsoft', dropbox: 'dropbox', gdrive: 'google', box: 'box',
};

const ENV_FOR: Record<OAuthApp, { id?: string; secret?: string }> = {
  microsoft: { id: 'MS_CLIENT_ID', secret: 'MS_CLIENT_SECRET' },
  dropbox: { id: 'DROPBOX_APP_KEY', secret: 'DROPBOX_APP_SECRET' },
  google: { id: 'GOOGLE_CLIENT_ID', secret: 'GOOGLE_CLIENT_SECRET' },
  box: { id: 'BOX_CLIENT_ID', secret: 'BOX_CLIENT_SECRET' },
};

export interface AppCreds { clientId: string; clientSecret: string }

/** Get an app's credentials (DB first, then env). Null if neither is configured. */
export async function getAppCreds(app: OAuthApp): Promise<AppCreds | null> {
  try {
    const admin = createServerClient() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const { data } = await admin.from('platform_integrations').select('client_id, secret_enc, enabled').eq('app', app).maybeSingle();
    if (data && data.enabled !== false && data.secret_enc) {
      const dec = decryptSecret<AppCreds>(data.secret_enc);
      if (dec?.clientId && dec?.clientSecret) return dec;
    }
  } catch { /* fall through to env */ }
  const env = ENV_FOR[app];
  const clientId = env.id ? process.env[env.id] : undefined;
  const clientSecret = env.secret ? process.env[env.secret] : undefined;
  if (clientId && clientSecret) return { clientId, clientSecret };
  return null;
}

/** Which apps are configured (DB or env) — for the admin status view. */
export async function appConfigured(app: OAuthApp): Promise<boolean> {
  return (await getAppCreds(app)) !== null;
}
