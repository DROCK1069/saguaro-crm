import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase-server';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * GET /api/integrations/quickbooks/connect
 * Builds the Intuit OAuth2 authorize URL (Accounting scope) and returns it so
 * the UI can redirect the user to QuickBooks. The existing /callback route
 * exchanges the code for tokens. Completes the QBO connect handshake.
 */
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const clientId = process.env.QB_CLIENT_ID;
  const redirectUri = process.env.QB_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: 'QuickBooks not configured (set QB_CLIENT_ID, QB_REDIRECT_URI)' }, { status: 503 });
  }

  // state binds the callback to this tenant + a CSRF nonce
  const nonce = randomBytes(12).toString('hex');
  const state = Buffer.from(JSON.stringify({ t: user.tenantId, n: nonce })).toString('base64url');

  const url = new URL('https://appcenter.intuit.com/connect/oauth2');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'com.intuit.quickbooks.accounting');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);

  return NextResponse.json({ authorize_url: url.toString(), state });
}
