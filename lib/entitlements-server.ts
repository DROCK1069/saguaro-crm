/**
 * lib/entitlements-server.ts
 * Server-side entitlement checks. Fail-closed: a tenant only has a gated feature
 * when tenants.settings.features[flag] === true. Used by both /api/me/entitlements
 * and every gated franchise API route, so the DATA surface — not just the UI — is
 * locked to entitled tenants (defense-in-depth). Server only.
 */
import { createServerClient } from './supabase-server';

export const GATED_FEATURES = ['command_center', 'win_loss_pricing'] as const;
export type GatedFeature = (typeof GATED_FEATURES)[number];

/** True only when this tenant has the flag explicitly turned on. Any error → false. */
export async function hasFeature(tenantId: string | null | undefined, flag: string): Promise<boolean> {
  if (!tenantId) return false;
  try {
    const db = createServerClient();
    const { data } = await db.from('tenants').select('settings').eq('id', tenantId).maybeSingle();
    const settings = ((data as any)?.settings ?? {}) as Record<string, any>;
    const flags = (settings.features ?? {}) as Record<string, any>;
    return flags[flag] === true; // strictly true
  } catch {
    return false;
  }
}

/** Read every gated flag for a tenant at once. Missing/unknown → false. */
export async function getFeatures(tenantId: string | null | undefined): Promise<Record<string, boolean>> {
  const empty = Object.fromEntries(GATED_FEATURES.map((f) => [f, false]));
  if (!tenantId) return empty;
  try {
    const db = createServerClient();
    const { data } = await db.from('tenants').select('settings').eq('id', tenantId).maybeSingle();
    const settings = ((data as any)?.settings ?? {}) as Record<string, any>;
    const flags = (settings.features ?? {}) as Record<string, any>;
    const out: Record<string, boolean> = {};
    for (const f of GATED_FEATURES) out[f] = flags[f] === true;
    return out;
  } catch {
    return empty;
  }
}
