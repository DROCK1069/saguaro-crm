/**
 * lib/folder-access.ts — per-folder document permission evaluation.
 *
 * Rule: a folder with NO rules is open to the whole tenant. As soon as any rule
 * exists for a folder, that folder is restricted to the users/roles that have
 * been granted at least the requested access level.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

export type FolderRule = { folder: string; principal_type: string; principal_id: string; access: string };

const RANK: Record<string, number> = { none: 0, view: 1, edit: 2, admin: 3 };

export async function loadFolderRules(db: any, tenantId: string, projectId: string): Promise<FolderRule[]> {
  try {
    const { data } = await db
      .from('document_folder_permissions')
      .select('folder, principal_type, principal_id, access')
      .eq('tenant_id', tenantId)
      .or(`project_id.eq.${projectId},project_id.is.null`);
    return (data || []) as FolderRule[];
  } catch {
    return [];
  }
}

export function folderAllowed(rules: FolderRule[], folder: string, userId: string, role: string, min: string = 'view'): boolean {
  const f = (folder || '').toLowerCase();
  const forFolder = rules.filter((r) => (r.folder || '').toLowerCase() === f);
  if (forFolder.length === 0) return true; // unrestricted
  const minRank = RANK[min] ?? 1;
  return forFolder.some((r) => {
    const principalMatch = r.principal_type === 'user'
      ? r.principal_id === userId
      : (r.principal_id || '').toLowerCase() === (role || '').toLowerCase();
    return principalMatch && (RANK[r.access] ?? 0) >= minRank;
  });
}
