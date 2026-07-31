/**
 * lib/permissions.ts
 * Server-side enforcement of the Roles & Permissions matrix.
 *
 * The Roles & Permissions admin UI (app/app/roles-permissions/page.tsx) lets a
 * tenant define role_definitions with a permission map of the shape
 *   { [Category]: 'None' | 'View' | 'Edit' | 'Full' }
 * and assign those roles to users (optionally scoped to a single project) via
 * user_role_assignments. Until now those permissions were read and enforced
 * NOWHERE — the matrix was cosmetic. This module makes it real.
 *
 * Server only — imports the service-role client. Never import from a client component.
 */
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient, getUser } from './supabase-server';
import type { Database } from './database.types';

/* ── vocabulary (must mirror app/app/roles-permissions/page.tsx) ── */
export type PermLevel = 'None' | 'View' | 'Edit' | 'Full';

export type PermCategory =
  | 'Projects'
  | 'Budget'
  | 'Schedule'
  | 'Safety'
  | 'Documents'
  | 'RFIs'
  | 'Submittals'
  | 'Change Orders'
  | 'Pay Apps'
  | 'Reports'
  | 'Admin';

export const CATEGORIES: PermCategory[] = [
  'Projects', 'Budget', 'Schedule', 'Safety', 'Documents',
  'RFIs', 'Submittals', 'Change Orders', 'Pay Apps', 'Reports', 'Admin',
];

export type PermissionMap = Record<PermCategory, PermLevel>;

/** Ordering used for comparisons: None < View < Edit < Full. */
const LEVEL_RANK: Record<PermLevel, number> = { None: 0, View: 1, Edit: 2, Full: 3 };

/** Roles that get an unconditional Full-on-everything bypass. */
const ADMIN_ROLES = new Set(['admin', 'owner']);

type ServerDb = SupabaseClient<Database>;

/* ── helpers ── */

function fill(level: PermLevel): PermissionMap {
  return CATEGORIES.reduce((acc, c) => {
    acc[c] = level;
    return acc;
  }, {} as PermissionMap);
}

/** Full on every category — the admin/owner bypass. */
function adminAll(): PermissionMap {
  return fill('Full');
}

/**
 * Default for a NON-admin user who has ZERO role assignments.
 *
 * DECISION: View on every operational category, None on Admin. This lets a
 * bare member read the app but denies every write/approve (Edit/Full) and all
 * access-control (Admin) actions until a role is explicitly granted. It is the
 * safe, least-privilege default: nothing that mutates money or membership is
 * reachable without a deliberate role assignment.
 */
function memberDefault(): PermissionMap {
  const m = fill('View');
  m['Admin'] = 'None';
  return m;
}

/** Coerce an arbitrary jsonb value into a known PermLevel (unknown → None). */
function normalizeLevel(v: unknown): PermLevel {
  return v === 'Full' || v === 'Edit' || v === 'View' || v === 'None' ? v : 'None';
}

/** Take the higher of two levels. */
function maxLevel(a: PermLevel, b: PermLevel): PermLevel {
  return LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b;
}

/**
 * Resolve a user's effective permission map for a tenant, optionally within a
 * project.
 *
 * Rules:
 *  - profiles.role === 'admin' | 'owner'  ⇒  Full on every category (bypass).
 *  - Otherwise, gather the user's role_definitions via user_role_assignments:
 *      • a GLOBAL assignment (project_id IS NULL) always applies;
 *      • a PROJECT-SCOPED assignment applies only when `projectId` is provided
 *        and matches. (With no projectId, only global grants are considered.)
 *    Merge them by taking the HIGHEST level per category across all applicable
 *    roles (highest-wins).
 *  - A non-admin user with NO applicable assignments ⇒ memberDefault()
 *    (View on operational categories, None on Admin).
 */
export async function getEffectivePermissions(
  db: ServerDb,
  userId: string,
  tenantId: string,
  projectId?: string | null,
): Promise<PermissionMap> {
  // 1) Base role bypass.
  const { data: profile } = await db
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  const baseRole = (profile?.role || '').toLowerCase();
  if (ADMIN_ROLES.has(baseRole)) return adminAll();

  // 2) Applicable role assignments (global + this project).
  const { data: assignments } = await db
    .from('user_role_assignments')
    .select('role_id, project_id')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId);

  const applicable = (assignments ?? []).filter(
    (a) => a.project_id == null || (projectId != null && a.project_id === projectId),
  );

  const roleIds = Array.from(
    new Set(applicable.map((a) => a.role_id).filter((r): r is string => !!r)),
  );

  // 3) No applicable assignments → safe member default.
  if (roleIds.length === 0) return memberDefault();

  const { data: roleDefs } = await db
    .from('role_definitions')
    .select('id, permissions')
    .eq('tenant_id', tenantId)
    .in('id', roleIds);

  // 4) Merge highest-wins across every applicable role.
  const merged = fill('None');
  for (const rd of roleDefs ?? []) {
    const perms = (rd.permissions ?? {}) as Record<string, unknown>;
    for (const c of CATEGORIES) {
      merged[c] = maxLevel(merged[c], normalizeLevel(perms[c]));
    }
  }
  return merged;
}

/** True if `perms` grants at least `minLevel` on `category`. */
export function hasPermission(
  perms: PermissionMap,
  category: PermCategory,
  minLevel: PermLevel,
): boolean {
  const have = perms[category] ?? 'None';
  return LEVEL_RANK[have] >= LEVEL_RANK[minLevel];
}

export type AuthedUser = { id: string; tenantId: string; email: string };

export type PermissionGuard =
  | { ok: true; user: AuthedUser; perms: PermissionMap; db: ServerDb }
  | { ok: false; res: NextResponse };

/**
 * Route ergonomic gate. Resolves the caller, loads their effective permissions,
 * and either lets the route proceed or hands back a ready-to-return response.
 *
 *   const g = await requirePermission(req, 'Admin', 'Full');
 *   if (!g.ok) return g.res;
 *   // ... g.user is the authenticated user, g.perms the effective map
 *
 * opts.projectId narrows the check to a project (so project-scoped role grants
 * count). opts.db reuses an existing service client.
 */
export async function requirePermission(
  req: NextRequest,
  category: PermCategory,
  minLevel: PermLevel,
  opts?: { projectId?: string | null; db?: ServerDb },
): Promise<PermissionGuard> {
  const user = await getUser(req);
  if (!user) {
    return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const db = opts?.db ?? createServerClient();
  const perms = await getEffectivePermissions(db, user.id, user.tenantId, opts?.projectId);

  if (!hasPermission(perms, category, minLevel)) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: 'Forbidden', detail: `Requires ${category} ≥ ${minLevel}` },
        { status: 403 },
      ),
    };
  }

  return { ok: true, user, perms, db };
}
