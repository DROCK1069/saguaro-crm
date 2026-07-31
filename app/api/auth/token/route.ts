/**
 * POST /api/auth/token — Set session from raw tokens (implicit flow)
 * Used when Supabase returns access_token in the URL hash fragment
 * instead of a ?code= query param (implicit grant flow).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  let body: { access_token?: string; refresh_token?: string; expires_at?: number } = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { access_token, refresh_token, expires_at } = body;
  if (!access_token || !refresh_token) {
    return NextResponse.json({ error: 'Missing tokens' }, { status: 400 });
  }

  // SECURITY: verify the access token is a real, valid Supabase token BEFORE
  // persisting it as an HttpOnly session cookie. Previously any client-supplied
  // string was accepted verbatim (session-fixation primitive). The legitimate
  // implicit-flow login passes a genuine token, so it still works.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  const { data: { user }, error: verifyError } = await supabase.auth.getUser(access_token);
  if (verifyError || !user) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  const base = {
    path: '/',
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
  };

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
