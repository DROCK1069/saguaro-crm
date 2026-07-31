import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ subs: [] });

    const db = createServerClient();
    // NOTE: `subcontractors` is tenant-scoped only — it has no `project_id` column,
    // and its name column is `company_name` (not `name`). Filtering/ordering on the
    // non-existent columns is what was throwing the 500. Project association lives in
    // `project_subcontractors`; per-tenant listing is the intended behavior here.
    const { data, error } = await db
      .from('subcontractors')
      .select('*')
      .eq('tenant_id', user.tenantId)
      .order('company_name');
    if (error) throw error;
    return NextResponse.json({ subs: data || [] });
  } catch {
    return NextResponse.json({ subs: [], error: "Internal server error" }, { status: 500 });
  }
}
