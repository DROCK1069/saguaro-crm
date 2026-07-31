/**
 * lib/supabase-browser.ts
 * Browser-side Supabase client + auth helpers.
 * Import from any client component that needs auth or DB access.
 */

import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const HAS_SUPABASE =
  !!SUPABASE_URL &&
  SUPABASE_URL !== 'https://demo.supabase.co' &&
  !!SUPABASE_KEY;

let _client: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      SUPABASE_URL || 'https://demo.supabase.co',
      SUPABASE_KEY || 'demo-key',
    );
  }
  return _client;
}

/**
 * Hydrate the browser Supabase client's session from the server's httpOnly auth cookies.
 * The app logs in server-side (httpOnly cookies), so the browser client starts SIGNED OUT —
 * every page that queries Supabase directly from the browser (time clock, fleet, daily log,
 * document versions, lien deadlines) was silently RLS-blocked. Call `await ensureBrowserSession()`
 * before those queries. Idempotent + memoized: the network fetch happens at most once.
 */
let _hydrate: Promise<boolean> | null = null;
export function ensureBrowserSession(): Promise<boolean> {
  if (!HAS_SUPABASE) return Promise.resolve(false);
  if (_hydrate) return _hydrate;
  _hydrate = (async () => {
    const sb = getSupabaseBrowser();
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (session?.access_token) return true; // already hydrated
      const r = await fetch('/api/auth/session', { credentials: 'include' });
      if (!r.ok) return false;
      const { access_token, refresh_token } = await r.json();
      if (!access_token || !refresh_token) return false;
      const { error } = await sb.auth.setSession({ access_token, refresh_token });
      return !error;
    } catch {
      _hydrate = null; // allow a retry on transient failure
      return false;
    }
  })();
  return _hydrate;
}

/** Returns { Authorization: 'Bearer <token>' } or {} in demo mode. */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  if (!HAS_SUPABASE) return {};
  const { data: { session } } = await getSupabaseBrowser().auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

/** Returns the current user session or null. */
export async function getSession(): Promise<Session | null> {
  if (!HAS_SUPABASE) return null;
  const { data: { session } } = await getSupabaseBrowser().auth.getSession();
  return session;
}

/** Returns the current user's tenant ID (= user.id) or 'demo' in demo mode. */
export async function getTenantId(): Promise<string> {
  const session = await getSession();
  return session?.user?.id ?? 'demo';
}
