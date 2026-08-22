/**
 * Tenant entitlements — server-side gating for paid add-ons.
 *
 * The gate lives HERE, on the server, per tenant: clients can't bypass it.
 * A feature is on only while a row is 'active', or 'trial' before expires_at.
 * Routes return 403 { upsell: true, feature } so clients render a pitch
 * screen, never a broken error.
 */

type Db = any;

export type FeatureKey = 'radio' | 'radio_streaming';

export async function hasEntitlement(db: Db, tenantId: string, feature: FeatureKey): Promise<boolean> {
  try {
    const { data } = await db
      .from('tenant_entitlements')
      .select('status, expires_at')
      .eq('tenant_id', tenantId)
      .eq('feature_key', feature)
      .maybeSingle();
    if (!data) return false;
    const row = data as { status: string; expires_at: string | null };
    if (row.status === 'active') return !row.expires_at || new Date(row.expires_at).getTime() > Date.now();
    if (row.status === 'trial') return !!row.expires_at && new Date(row.expires_at).getTime() > Date.now();
    return false;
  } catch {
    // Fail CLOSED for paid features: an entitlement check error never gives
    // away the product.
    return false;
  }
}

/** 403 payload clients recognize as "pitch the add-on", not an error. */
export const upsell = (feature: FeatureKey) => ({
  error: 'This feature is not enabled for your organization.',
  upsell: true,
  feature,
});
