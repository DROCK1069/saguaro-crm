import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/projects?limit=100&status=active&search=foo
 * List tenant-scoped projects. Used by the app shell (app/app/layout.tsx) and
 * several dashboard pages (daily-logs, invoicing, schedule, etc.) to populate
 * project pickers / Sage context.
 *
 * Response shape: { projects: [...] }  (callers read d.projects)
 * Optional query params:
 *   - limit:  max rows to return (default 100)
 *   - status: exact match on projects.status
 *   - search: case-insensitive match on name / project_number / address
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const limitParamRaw = searchParams.get('limit');
    const limit = Math.min(Math.max(parseInt(limitParamRaw || '100', 10) || 100, 1), 1000);
    const status = searchParams.get('status');
    const search = searchParams.get('search')?.trim();

    const db = createServerClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = db
      .from('projects')
      .select(
        'id, name, status, address, city, state, project_number, type, project_type, ' +
          'contract_value, percent_complete, start_date, end_date, created_at, updated_at',
      )
      .eq('tenant_id', user.tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Exclude soft-deleted / archived rows (columns exist on the projects table).
    query = query.or('is_deleted.is.null,is_deleted.eq.false');
    query = query.or('is_archived.is.null,is_archived.eq.false');

    if (status) query = query.eq('status', status);
    if (search) {
      const term = search.replace(/[%,()]/g, ' ');
      query = query.or(
        `name.ilike.%${term}%,project_number.ilike.%${term}%,address.ilike.%${term}%`,
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ projects: data || [] });
  } catch {
    return NextResponse.json({ projects: [] }, { status: 500 });
  }
}
