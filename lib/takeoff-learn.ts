/**
 * Shared learning-loop primitive: re-learn a tenant's cost_rates from their own
 * priced history and upsert them as source:'learned' — never clobbering source:'manual'.
 *
 * Deterministic (lib/takeoff.learnRates, quantity-weighted integer-cents). Reads:
 *   - takeoff_line_items (measured takeoffs — always carry cost_key), and
 *   - takeoff_materials (AI blueprint takeoffs) ONCE that table has a cost_key column;
 *     until then that read errors harmlessly and we learn from measured history alone.
 *
 * Called from the manual "Learn from my jobs" button AND automatically on every takeoff
 * completion (measured + AI analyze) so prior jobs make future takeoffs smarter.
 *
 * Pass a SERVICE-ROLE supabase client. The CALLER owns auth; `tenantId` MUST be derived
 * from the authenticated user (never the client) — every read here is tenant-scoped.
 */
import { learnRates, type HistoricalLine } from '@/lib/takeoff';

export interface LearnResult {
  learned: number;
  skippedManual: number;
  fromLines: number;
  message?: string;
  rates?: { cost_key: string; cents: number; samples: number }[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function learnTenantRates(supabase: any, tenantId: string): Promise<LearnResult> {
  const history: HistoricalLine[] = [];

  // Measured takeoffs — the canonical priced history.
  const { data: liLines, error: liErr } = await supabase
    .from('takeoff_line_items')
    .select('cost_key,quantity,unit_material_cost,competitive_factor')
    .eq('tenant_id', tenantId)
    .not('cost_key', 'is', null)
    .limit(20000);
  if (liErr) throw new Error(liErr.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const l of (liLines || []) as any[]) {
    // Divide out any win/loss competitive multiplier so we learn TRUE cost, never the
    // sell-side discount — otherwise a competitive move would compound into the cost basis.
    const cf = Number(l.competitive_factor) || 1;
    history.push({ costKey: l.cost_key, unitMaterialCents: Math.round((Number(l.unit_material_cost) / (cf || 1)) * 100), quantity: Number(l.quantity) });
  }

  // AI blueprint takeoffs — priced materials feed learning too, once the column exists.
  // Tolerant: pre-migration the column is absent → PostgREST returns an error we swallow,
  // so behavior is unchanged until 20260728_takeoff_materials_cost_key.sql is applied.
  try {
    const { data: matLines, error: matErr } = await supabase
      .from('takeoff_materials')
      .select('cost_key,quantity,unit_cost,competitive_factor')
      .eq('tenant_id', tenantId)
      .not('cost_key', 'is', null)
      .limit(20000);
    if (!matErr && matLines) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const l of matLines as any[]) {
        const cf = Number(l.competitive_factor) || 1; // recover true cost (see above)
        history.push({ costKey: l.cost_key, unitMaterialCents: Math.round((Number(l.unit_cost) / (cf || 1)) * 100), quantity: Number(l.quantity) });
      }
    }
  } catch { /* takeoff_materials.cost_key not present yet — measured history is enough */ }

  const learned = learnRates(history);
  if (!learned.length) {
    return { learned: 0, skippedManual: 0, fromLines: history.length, message: 'No priced history yet — save a measured or blueprint takeoff first.' };
  }

  // Never overwrite the GC's manual rates.
  const { data: manual } = await supabase.from('cost_rates').select('cost_key').eq('tenant_id', tenantId).eq('source', 'manual');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const manualKeys = new Set((manual || []).map((m: any) => m.cost_key));
  const rows = learned.filter((l) => !manualKeys.has(l.costKey)).map((l) => ({
    tenant_id: tenantId, cost_key: l.costKey, material_cents: l.materialCents, source: 'learned', samples: l.samples, updated_at: new Date().toISOString(),
  }));
  if (rows.length) {
    const { error: upErr } = await supabase.from('cost_rates').upsert(rows, { onConflict: 'tenant_id,cost_key' });
    if (upErr) throw new Error(upErr.message);
  }
  return {
    learned: rows.length,
    skippedManual: learned.length - rows.length,
    fromLines: history.length,
    rates: rows.map((r) => ({ cost_key: r.cost_key, cents: r.material_cents, samples: r.samples })),
  };
}
