import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

// Premium/gated features. FAIL-CLOSED: a tenant only gets a feature when it is
// explicitly turned on in tenants.settings.features[<flag>] === true. Everyone
// else — including new/unknown tenants — gets nothing. This one flag is how a
// feature (e.g. the Command Center / Franchise Rollout) is sold per customer.
const GATED = ['command_center'] as const;

export async function GET(req: NextRequest) {
  const empty = Object.fromEntries(GATED.map((f) => [f, false]));
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ features: empty, plan: null }, { status: 401 });

    const db = createServerClient();
    const { data } = await db.from('tenants').select('settings, plan').eq('id', user.tenantId).maybeSingle();

    const settings = ((data as any)?.settings ?? {}) as Record<string, any>;
    const flags = (settings.features ?? {}) as Record<string, any>;
    const features: Record<string, boolean> = {};
    for (const f of GATED) features[f] = flags[f] === true; // strictly true only
    return NextResponse.json({ features, plan: (data as any)?.plan ?? null });
  } catch {
    // On any error, deny (fail-closed).
    return NextResponse.json({ features: empty, plan: null });
  }
}
