import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET /api/dashboard/metrics -> { alerts: { rfis_open, coi_expiring_30d, lien_waivers_pending, overdue_punch } }
// Tenant-wide home-screen alert counts. Each count is independently guarded so
// one failing query degrades to 0 instead of 500ing the whole snapshot.
export async function GET(_req: NextRequest) {
  const user = await getUser(_req);
  if (!user) return NextResponse.json({ alerts: {} }, { status: 401 });

  const db = createServerClient();
  const t = user.tenantId;
  const today = new Date().toISOString().slice(0, 10);
  const inThirty = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);

  const guard = async (fn: () => Promise<number>) => {
    try { return await fn(); } catch { return 0; }
  };

  const [rfis_open, coi_expiring_30d, lien_waivers_pending, overdue_punch] = await Promise.all([
    guard(async () => {
      const { count } = await db.from('rfis').select('id', { count: 'exact', head: true })
        .eq('tenant_id', t).neq('status', 'answered').neq('status', 'closed');
      return count || 0;
    }),
    guard(async () => {
      const { count } = await db.from('subcontractor_insurance').select('id', { count: 'exact', head: true })
        .eq('tenant_id', t).gte('expiry_date', today).lte('expiry_date', inThirty);
      return count || 0;
    }),
    guard(async () => {
      const { count } = await db.from('lien_waivers').select('id', { count: 'exact', head: true })
        .eq('tenant_id', t).eq('status', 'pending');
      return count || 0;
    }),
    guard(async () => {
      const { count } = await db.from('punch_list_items').select('id', { count: 'exact', head: true })
        .eq('tenant_id', t).lt('due_date', today).neq('status', 'complete');
      return count || 0;
    }),
  ]);

  return NextResponse.json({ alerts: { rfis_open, coi_expiring_30d, lien_waivers_pending, overdue_punch } });
}
