import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/** GET /api/portal/sub/sessions — list THIS GC's sub portal sessions.
 *  Auth + tenant scope required: these rows include portal tokens; an
 *  unauthenticated/cross-tenant read here previously leaked every tenant's
 *  tokens (sub impersonation). The token is fine to return to the authed GC
 *  who owns these portals (the page builds the shareable link from it). */
export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ sessions: [], error: 'unauthorized' }, { status: 401 });
    const db = createServerClient();

    const { data: sessions, error } = await db
      .from('portal_sub_sessions')
      .select('id, sub_id, project_id, token, status, last_login_at, created_at, tenant_id')
      .eq('tenant_id', user.tenantId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    // Enrich with sub company names and project names
    const subIds = [...new Set((sessions || []).map(s => s.sub_id).filter(Boolean))];
    const projectIds = [...new Set((sessions || []).map(s => s.project_id).filter(Boolean))];

    let subMap: Record<string, { company_name: string; contact_name: string }> = {};
    let projectMap: Record<string, string> = {};

    await Promise.all([
      subIds.length > 0
        ? db.from('subcontractors').select('id, company_name, contact_name').in('id', subIds)
            .then(({ data }) => {
              subMap = Object.fromEntries((data || []).map(s => [s.id, { company_name: s.company_name, contact_name: s.contact_name }]));
            })
        : Promise.resolve(),
      projectIds.length > 0
        ? db.from('projects').select('id, name').in('id', projectIds)
            .then(({ data }) => {
              projectMap = Object.fromEntries((data || []).map(p => [p.id, p.name]));
            })
        : Promise.resolve(),
    ]);

    const enriched = (sessions || []).map(s => ({
      ...s,
      company_name: subMap[s.sub_id]?.company_name || null,
      contact_name: subMap[s.sub_id]?.contact_name || null,
      project_name: projectMap[s.project_id] || null,
    }));

    return NextResponse.json({ sessions: enriched });
  } catch (err) {
    console.error('[portal/sub/sessions]', err);
    return NextResponse.json({ sessions: [] });
  }
}
