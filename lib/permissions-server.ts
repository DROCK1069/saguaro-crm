/**
 * lib/permissions-server.ts — server-side permission guard.
 *
 * Endpoints adopt `userCan(db, tenantId, userId, tool, action, projectId?)`.
 * Opt-in: if the user has no role assignments, enforcement is OFF (returns
 * true) so adopting the guard never locks out tenants that haven't set up
 * permission templates yet.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { coercePermissions, resolveEffective, can, type Matrix } from './permissions';

export async function loadUserMatrix(
  db: any, tenantId: string, userId: string, projectId?: string | null,
): Promise<{ matrix: Matrix; enforced: boolean }> {
  const { data: assigns } = await db.from('user_role_assignments')
    .select('project_id, role_id').eq('tenant_id', tenantId).eq('user_id', userId);
  if (!assigns || assigns.length === 0) return { matrix: resolveEffective([], projectId), enforced: false };

  const roleIds = [...new Set(assigns.map((a: any) => a.role_id).filter(Boolean))];
  let roleMap = new Map<string, Matrix>();
  if (roleIds.length) {
    const { data: roles } = await db.from('role_definitions').select('id, permissions').in('id', roleIds);
    roleMap = new Map((roles || []).map((r: any) => [r.id, coercePermissions(r.permissions)]));
  }
  const mapped = assigns.map((a: any) => ({ project_id: a.project_id, permissions: roleMap.get(a.role_id) || ({} as Matrix) }));
  return { matrix: resolveEffective(mapped, projectId), enforced: true };
}

export async function userCan(
  db: any, tenantId: string, userId: string, tool: string, action: string, projectId?: string | null,
): Promise<boolean> {
  const { matrix, enforced } = await loadUserMatrix(db, tenantId, userId, projectId);
  if (!enforced) return true; // opt-in enforcement
  return can(matrix, tool, action);
}
