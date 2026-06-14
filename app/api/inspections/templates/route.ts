import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET /api/inspections/templates  -> { templates: [...] }
// Returns this tenant's templates plus any global ones, mapping the jsonb
// `items` column to the `checklist_items` the mobile wizard expects.
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ templates: [] }, { status: 401 });
  try {
    const db = createServerClient();
    const { data, error } = await db
      .from('inspection_templates')
      .select('*')
      .or(`tenant_id.eq.${user.tenantId},is_global.eq.true`)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    const templates = (data || []).map((t: Record<string, any>) => ({
      ...t,
      checklist_items: t.checklist_items ?? t.items ?? t.fields ?? [],
    }));
    return NextResponse.json({ templates });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg, templates: [] }, { status: 500 });
  }
}
