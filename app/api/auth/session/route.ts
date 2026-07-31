/**
 * POST /api/auth/session — Server-side login
 * Sets HttpOnly cookies so tokens are never accessible via JavaScript
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function isConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return !!(url && url !== 'https://demo.supabase.co' && key && !key.includes('placeholder') && !key.startsWith('demo_') && key.length > 20);
}

/**
 * GET /api/auth/session — hand the current session tokens to the authenticated browser
 * so the browser Supabase client can hydrate its session (setSession). Reads the httpOnly
 * cookies server-side and refreshes if the access token is stale. Only works for a request
 * that already carries valid auth cookies, so it never leaks tokens to an unauthenticated caller.
 */
export async function GET(req: NextRequest) {
  if (!isConfigured()) return NextResponse.json({ session: null }, { status: 503 });
  const access = req.cookies.get('sb-access-token')?.value;
  const refresh = req.cookies.get('sb-refresh-token')?.value;
  if (!access && !refresh) return NextResponse.json({ session: null }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  // Valid access token → return the pair as-is.
  if (access) {
    const { data: { user }, error } = await supabase.auth.getUser(access);
    if (!error && user && refresh) {
      return NextResponse.json({ access_token: access, refresh_token: refresh });
    }
  }
  // Stale access token → refresh, hand back the fresh pair, and re-set the cookies.
  if (refresh) {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refresh });
    if (!error && data?.session) {
      const res = NextResponse.json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
      const base = { path: '/', sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', httpOnly: true };
      res.cookies.set('sb-access-token', data.session.access_token, { ...base, expires: data.session.expires_at ? new Date(data.session.expires_at * 1000) : undefined });
      res.cookies.set('sb-refresh-token', data.session.refresh_token, { ...base, maxAge: 60 * 60 * 24 * 365 });
      return res;
    }
  }
  return NextResponse.json({ session: null }, { status: 401 });
}

export async function POST(req: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.json({ error: 'Authentication service not configured' }, { status: 503 });
  }

  let body: { email?: string; password?: string } = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { email, password } = body;
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.toLowerCase().trim(),
    password,
  });

  if (error || !data.session) {
    const msg = error?.message?.toLowerCase() || '';
    if (msg.includes('not confirmed')) {
      return NextResponse.json({ error: 'Please confirm your email before signing in. Check your inbox.' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  }

  const { access_token, refresh_token, expires_at } = data.session;
  const response = NextResponse.json({
    ok: true,
    user: { id: data.user.id, email: data.user.email },
  });

  const base = { path: '/', sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', httpOnly: true };
  response.cookies.set('sb-access-token', access_token, {
    ...base,
    expires: expires_at ? new Date(expires_at * 1000) : undefined,
  });
  response.cookies.set('sb-refresh-token', refresh_token, {
    ...base,
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}
