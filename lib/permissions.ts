/**
 * lib/permissions.ts — permission-template resolution + enforcement engine.
 *
 * Roles (role_definitions.permissions) are templates: a per-tool access level.
 * user_role_assignments assign a template to a user, optionally scoped to a
 * project. This engine resolves a user's EFFECTIVE matrix (global + project
 * assignments, highest access wins) and answers can(tool, action) — the piece
 * that was missing (templates were defined but never enforced).
 *
 * Pure functions — unit-testable offline.
 */

export const TOOLS = [
  'rfis', 'submittals', 'drawings', 'documents', 'daily_logs', 'punch', 'inspections',
  'schedule', 'budget', 'financials', 'commitments', 'change_orders', 'pay_apps',
  'directory', 'admin',
] as const;
export type Tool = (typeof TOOLS)[number];

export type Level = 'none' | 'read' | 'standard' | 'admin';
const RANK: Record<Level, number> = { none: 0, read: 1, standard: 2, admin: 3 };

export type Matrix = Record<string, Level>;

const ACTION_LEVEL: Record<string, Level> = {
  view: 'read', read: 'read', list: 'read', export: 'read',
  create: 'standard', edit: 'standard', update: 'standard', comment: 'standard',
  delete: 'admin', approve: 'admin', reject: 'admin', configure: 'admin', manage: 'admin',
};

function blank(level: Level): Matrix { const m: Matrix = {}; for (const t of TOOLS) m[t] = level; return m; }

export const STANDARD_TEMPLATES: Record<string, Matrix> = {
  'Administrator': blank('admin'),
  'Project Manager': { ...blank('standard'), rfis: 'admin', submittals: 'admin', change_orders: 'admin', pay_apps: 'admin', financials: 'admin', commitments: 'admin', admin: 'none' },
  'Standard User': { ...blank('standard'), financials: 'read', budget: 'read', commitments: 'read', change_orders: 'read', pay_apps: 'read', directory: 'read', admin: 'none' },
  'Read Only': { ...blank('read'), admin: 'none' },
  'No Access': blank('none'),
};

/** Coerce a stored permissions jsonb (several shapes seen in the wild) into a Matrix. */
export function coercePermissions(raw: unknown): Matrix {
  const out = blank('none');
  if (!raw || typeof raw !== 'object') return out;
  const obj = raw as Record<string, unknown>;
  for (const t of TOOLS) {
    const v = obj[t];
    if (typeof v === 'string' && v in RANK) { out[t] = v as Level; continue; }
    if (v && typeof v === 'object') {
      // booleans like { view, create, edit, delete }
      const b = v as Record<string, unknown>;
      if (b.delete || b.admin || b.approve || b.manage) out[t] = 'admin';
      else if (b.create || b.edit || b.update || b.standard) out[t] = 'standard';
      else if (b.view || b.read || b.list) out[t] = 'read';
      else out[t] = 'none';
    }
  }
  return out;
}

/**
 * Merge applicable assignment templates into one effective matrix.
 * An assignment applies if it's global (project_id null) or matches projectId;
 * across applicable templates the HIGHEST access per tool wins.
 */
export function resolveEffective(
  assignments: { project_id?: string | null; permissions: Matrix }[],
  projectId?: string | null,
): Matrix {
  const eff = blank('none');
  for (const a of assignments) {
    if (a.project_id && projectId && a.project_id !== projectId) continue;
    if (a.project_id && !projectId) continue;
    for (const t of TOOLS) {
      if ((RANK[a.permissions[t] || 'none'] ?? 0) > RANK[eff[t]]) eff[t] = a.permissions[t] || 'none';
    }
  }
  return eff;
}

export function can(matrix: Matrix, tool: string, action: string): boolean {
  const need = ACTION_LEVEL[action] || 'standard';
  return (RANK[matrix[tool] || 'none'] ?? 0) >= RANK[need];
}
