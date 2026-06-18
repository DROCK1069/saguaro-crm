import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/** GET /api/portal/sub/sessions — list all sub portal sessions for this tenant */
export async function GET() {
  try {
    const db = createServerClient();

    const { data: sessions, error } = await db
      .from('portal_sub_sessions')
      .select('id, sub_id, project_id, token, status, last_login_at, created_at, tenant_id')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    // Enrich with sub company names and project names
    const subIds = [...new Set((sessions || []).map(s => s.sub_id).filter((id): id is string => Boolean(id)))];
    const projectIds = [...new Set((sessions || []).map(s => s.project_id).filter((id): id is string => Boolean(id)))];

    let subMap: Record<string, { company_name: string; contact_name: string | null }> = {};
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
      company_name: s.sub_id ? subMap[s.sub_id]?.company_name || null : null,
      contact_name: s.sub_id ? subMap[s.sub_id]?.contact_name || null : null,
      project_name: s.project_id ? projectMap[s.project_id] || null : null,
    }));

    return NextResponse.json({ sessions: enriched });
  } catch (err) {
    console.error('[portal/sub/sessions]', err);
    return NextResponse.json({ sessions: [] });
  }
}
