import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

/**
 * GET /api/roles/audit
 * Returns a bare array of audit entries (camelCase) for the
 * roles-permissions admin page audit tab. Mapped from audit_logs.
 */
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db = createServerClient();

    const { data: logs } = await db
      .from('audit_logs')
      .select('*')
      .eq('tenant_id', user.tenantId)
      .in('entity_type', ['role', 'role_definition', 'user_role_assignment', 'permission'])
      .order('created_at', { ascending: false })
      .limit(200);

    const rows = logs ?? [];

    const result = rows.map((r) => {
      let detail = '';
      if (typeof r.changes === 'string') {
        detail = r.changes;
      } else if (r.changes && typeof r.changes === 'object') {
        try {
          detail = JSON.stringify(r.changes);
        } catch {
          detail = '';
        }
      }
      return {
        id: r.id,
        action: r.action ?? '',
        roleName: r.entity_name ?? '',
        changedBy: r.user_name ?? r.user_email ?? 'System',
        changedAt: r.created_at,
        detail,
      };
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json([]);
  }
}
