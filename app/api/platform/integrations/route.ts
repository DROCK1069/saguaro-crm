import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { isPlatformAdmin } from '@/lib/platform-admin';
import { getAppCreds, type OAuthApp } from '@/lib/storage-providers/platform-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/* eslint-disable @typescript-eslint/no-explicit-any */

const ENV_FOR: Record<OAuthApp, { id: string; secret: string }> = {
  microsoft: { id: 'MS_CLIENT_ID', secret: 'MS_CLIENT_SECRET' },
  dropbox: { id: 'DROPBOX_APP_KEY', secret: 'DROPBOX_APP_SECRET' },
  google: { id: 'GOOGLE_CLIENT_ID', secret: 'GOOGLE_CLIENT_SECRET' },
  box: { id: 'BOX_CLIENT_ID', secret: 'BOX_CLIENT_SECRET' },
};

export const APPS_META: { app: OAuthApp; label: string; providers: string[]; portal: string; portalName: string; redirects: string[] }[] = [
  { app: 'microsoft', label: 'Microsoft — OneDrive + SharePoint', providers: ['onedrive', 'sharepoint'], portalName: 'Azure Portal → App registrations', portal: 'https://portal.azure.com', redirects: ['/api/storage/oauth/onedrive/callback', '/api/storage/oauth/sharepoint/callback'] },
  { app: 'dropbox', label: 'Dropbox', providers: ['dropbox'], portalName: 'Dropbox App Console', portal: 'https://www.dropbox.com/developers/apps', redirects: ['/api/storage/oauth/dropbox/callback'] },
  { app: 'google', label: 'Google Drive', providers: ['gdrive'], portalName: 'Google Cloud → Credentials', portal: 'https://console.cloud.google.com/apis/credentials', redirects: ['/api/storage/oauth/gdrive/callback'] },
  // Box intentionally omitted — skipped (free Box dev console can't save OAuth apps).
];

async function requireAdmin(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return { err: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!isPlatformAdmin(user.email)) return { err: NextResponse.json({ error: 'Platform owners only' }, { status: 403 }) };
  return { user };
}

export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  const origin = new URL(req.url).origin;
  const admin = createServerClient() as any;
  const { data: rows } = await admin.from('platform_integrations').select('app, client_id, secret_enc, enabled, updated_at');
  const byApp = new Map<string, any>((rows || []).map((r: any) => [r.app, r]));

  const apps = await Promise.all(APPS_META.map(async (m) => {
    const row = byApp.get(m.app);
    const creds = await getAppCreds(m.app);
    const dbConfigured = !!(row && row.secret_enc);
    const env = ENV_FOR[m.app];
    const envConfigured = !!(process.env[env.id] && process.env[env.secret]);
    return {
      ...m,
      redirects: m.redirects.map((r) => `${origin}${r}`),
      configured: !!creds,
      source: dbConfigured ? 'in-product' : envConfigured ? 'env' : null,
      client_id: creds?.clientId || null,            // client_id is not a secret
      enabled: row ? row.enabled !== false : true,
      updated_at: row?.updated_at || null,
    };
  }));
  return NextResponse.json({ apps });
}
