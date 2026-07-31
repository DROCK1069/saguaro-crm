/** The GC's learning cost catalog — their manual/learned unit rates that override the book. */
import { NextRequest } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { requirePermission } from '@/lib/permissions';
import { COST_CATALOG, type RateOverrides } from '@/lib/takeoff';

export const runtime = 'nodejs';

/** GET → { rates (overrides map for the engine), list (editor rows), catalog (book) } */
export async function GET(req: NextRequest) {
  const user = await getUser(req).catch(() => null);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServerClient() as any;
  const { data, error } = await supabase.from('cost_rates').select('cost_key,material_cents,source,samples,updated_at').eq('tenant_id', user.tenantId);
  if (error) { console.error('[takeoff/cost-rates] list failed:', error); return Response.json({ error: 'Could not load your cost rates.' }, { status: 500 }); }
  const rates: RateOverrides = {};
  for (const r of data || []) rates[r.cost_key] = r.material_cents;
  const list = Object.entries(COST_CATALOG).map(([cost_key, e]) => {
    const own = (data || []).find((x: any) => x.cost_key === cost_key);
    return { cost_key, unit: e.unit, note: e.note || '', bookCents: e.materialCents, ownCents: own?.material_cents ?? null, source: own?.source ?? null, samples: own?.samples ?? 0 };
  });
  return Response.json({ rates, list });
}

/** POST { costKey, materialCents } → upsert a manual rate. */
export async function POST(req: NextRequest) {
  const g = await requirePermission(req, 'Projects', 'Edit');
  if (!g.ok) return g.res;
  const user = g.user;
  const body = await req.json().catch(() => null);
  const costKey = body?.costKey; const cents = Math.round(Number(body?.materialCents));
  if (!costKey || !COST_CATALOG[costKey] || !(cents >= 0)) return Response.json({ error: 'Invalid costKey or amount' }, { status: 400 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServerClient() as any;
  const { error } = await supabase.from('cost_rates').upsert(
    { tenant_id: user.tenantId, cost_key: costKey, material_cents: cents, source: 'manual', samples: 0, updated_at: new Date().toISOString() },
    { onConflict: 'tenant_id,cost_key' },
  );
  if (error) { console.error('[takeoff/cost-rates] save failed:', error); return Response.json({ error: 'Could not save this rate. Please try again.' }, { status: 500 }); }
  return Response.json({ ok: true });
}

/** DELETE ?costKey= → revert to the book rate. */
export async function DELETE(req: NextRequest) {
  const g = await requirePermission(req, 'Projects', 'Full');
  if (!g.ok) return g.res;
  const user = g.user;
  const costKey = new URL(req.url).searchParams.get('costKey');
  if (!costKey) return Response.json({ error: 'costKey required' }, { status: 400 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServerClient() as any;
  const { error } = await supabase.from('cost_rates').delete().eq('tenant_id', user.tenantId).eq('cost_key', costKey);
  if (error) { console.error('[takeoff/cost-rates] delete failed:', error); return Response.json({ error: 'Could not reset this rate. Please try again.' }, { status: 500 }); }
  return Response.json({ ok: true });
}
