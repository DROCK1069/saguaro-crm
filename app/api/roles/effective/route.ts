import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { coercePermissions, resolveEffective, STANDARD_TEMPLATES, TOOLS } from '@/lib/permissions';

export const runtime = 'nodejs';
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * GET /api/roles/effective[?projectId=]
 * Returns the current user's EFFECTIVE permission matrix for a project
 * (global + project-scoped role assignments merged, highest access wins),
 * plus the catalog of standard templates the admin can apply.
 *
 * `enforced` is false when the user has no role assignments — permission
 * templates are opt-in, so endpoints that adopt the guard fail open until a
 * tenant actually assigns roles (never silently locks existing users out).
 */
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const projectId = new URL(req.url).searchParams.get('projectId');

  try {
    const db = createServerClient() as any;
    const { data: assigns } = await db.from('user_role_assignments')
      .select('project_id, role_id').eq('tenant_id', user.tenantId).eq('user_id', user.id);

    const roleIds = [...new Set((assigns || []).map((a: any) => a.role_id).filter(Boolean))];
    let roleMap = new Map<string, any>();
    if (roleIds.length) {
      const { data: roles } = await db.from('role_definitions').select('id, permissions').eq('tenant_id', user.tenantId).in('id', roleIds);
      roleMap = new Map((roles || []).map((r: any) => [r.id, coercePermissions(r.permissions)]));
    }

    const mapped = (assigns || []).map((a: any) => ({ project_id: a.project_id, permissions: roleMap.get(a.role_id) || {} }));
    const effective = resolveEffective(mapped, projectId);

    return NextResponse.json({
      effective,
      tools: TOOLS,
      enforced: (assigns || []).length > 0,
      standardTemplates: STANDARD_TEMPLATES,
    });
  } catch (err) {
    console.error('[roles/effective]', err);
    return NextResponse.json({ error: 'Could not resolve permissions' }, { status: 500 });
  }
}
