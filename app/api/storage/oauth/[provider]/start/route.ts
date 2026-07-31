import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase-server';
import { encryptSecret } from '@/lib/crypto-secrets';
import { buildAuthUrl, isOAuthProvider, providerConfigured } from '@/lib/storage-providers/oauth';
import type { ProviderId } from '@/lib/storage-providers/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Begin OAuth: the signed-in user's tenant is baked into an ENCRYPTED state param
 * (there's no session on the provider's redirect back), then we bounce to the
 * provider's consent screen.
 */
export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const provider = params.provider as ProviderId;
  if (!isOAuthProvider(provider)) return NextResponse.json({ error: 'Not an OAuth provider' }, { status: 400 });
  if (!(await providerConfigured(provider))) return NextResponse.json({ error: `This provider isn't set up yet — a Saguaro admin must add its app credentials in Platform Integrations.` }, { status: 400 });

  const origin = new URL(req.url).origin;
  const state = encodeURIComponent(encryptSecret({ t: user.tenantId, u: user.id, p: provider, ts: Date.now() }));
  return NextResponse.redirect(await buildAuthUrl(provider, origin, state), 302);
}
