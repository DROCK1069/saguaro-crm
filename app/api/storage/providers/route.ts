import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase-server';
import { PROVIDER_META, type ProviderId } from '@/lib/storage-providers/types';
import { isOAuthProvider, providerConfigured } from '@/lib/storage-providers/oauth';
import { hasEncryptionKey } from '@/lib/crypto-secrets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Drives the connect UI: what each provider is, how it authenticates, and whether
// its app has been configured (in-product Platform Integrations, or env) for the
// OAuth ones.
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // Box is intentionally hidden (skipped — free Box dev console can't save OAuth apps).
  const ids = (Object.keys(PROVIDER_META) as ProviderId[]).filter((id) => id !== 'box');
  const providers = await Promise.all(ids.map(async (id) => {
    const meta = PROVIDER_META[id];
    const oauth = isOAuthProvider(id);
    const available = oauth ? await providerConfigured(id) : true;
    return { id, label: meta.label, auth: meta.auth, blurb: meta.blurb, available, needsAppEnv: oauth && !available };
  }));
  return NextResponse.json({ providers, encryption_ready: hasEncryptionKey() });
}
