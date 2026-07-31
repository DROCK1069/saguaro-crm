/**
 * scratch/perm_proof.ts — deterministic proof for lib/permissions.
 * Run:
 *   env NEXT_PUBLIC_SUPABASE_URL=http://localhost \
 *       NEXT_PUBLIC_SUPABASE_ANON_KEY=anon \
 *       SUPABASE_SERVICE_ROLE_KEY=svc \
 *   npx esbuild scratch/perm_proof.ts --bundle --platform=node --format=cjs \
 *       --external:next/server --external:@supabase/supabase-js | node
 */
import {
  getEffectivePermissions,
  hasPermission,
  CATEGORIES,
  type PermissionMap,
  type PermCategory,
} from '../lib/permissions';

/* ── minimal supabase-js query-builder mock ── */
type Fixtures = {
  profileRole?: string | null;
  assignments?: { role_id: string | null; project_id: string | null }[];
  roleDefs?: { id: string; permissions: Record<string, unknown> }[];
};

function makeDb(fx: Fixtures): any {
  return {
    from(table: string) {
      let single: unknown = null;
      let list: unknown = null;
      if (table === 'profiles') single = fx.profileRole === undefined ? null : { role: fx.profileRole };
      if (table === 'user_role_assignments') list = fx.assignments ?? [];
      if (table === 'role_definitions') list = fx.roleDefs ?? [];
      const p: any = {
        select: () => p,
        eq: () => p,
        in: () => p,
        maybeSingle: () => Promise.resolve({ data: single }),
        then: (onF: any, onR: any) => Promise.resolve({ data: list }).then(onF, onR),
      };
      return p;
    },
  };
}

function allNone(): PermissionMap {
  return CATEGORIES.reduce((m, c) => { m[c] = 'None'; return m; }, {} as PermissionMap);
}

let pass = 0, fail = 0;
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name); }
}

async function run() {
  // ── 1. admin / owner bypass ──
  const admin = await getEffectivePermissions(makeDb({ profileRole: 'admin' }), 'u', 't');
  check('admin → Full on Admin', admin.Admin === 'Full');
  check('admin → Full on Budget', admin.Budget === 'Full');
  check('admin → Full on Pay Apps', admin['Pay Apps'] === 'Full');
  const owner = await getEffectivePermissions(makeDb({ profileRole: 'OWNER' }), 'u', 't'); // case-insensitive
  check('owner (any case) → Full', owner.Admin === 'Full');
  // admin bypass ignores any restrictive role assignment
  const adminWithRole = await getEffectivePermissions(
    makeDb({ profileRole: 'admin', assignments: [{ role_id: 'r', project_id: null }], roleDefs: [{ id: 'r', permissions: { Admin: 'None' } }] }),
    'u', 't',
  );
  check('admin bypass overrides assigned role', adminWithRole.Admin === 'Full');

  // ── 2. no-assignment member default ──
  const member = await getEffectivePermissions(makeDb({ profileRole: 'member', assignments: [] }), 'u', 't');
  check('member default → View on Projects', member.Projects === 'View');
  check('member default → View on Pay Apps', member['Pay Apps'] === 'View');
  check('member default → None on Admin', member.Admin === 'None');
  check('member CANNOT Edit Budget', !hasPermission(member, 'Budget', 'Edit'));
  check('member CANNOT Full Change Orders', !hasPermission(member, 'Change Orders', 'Full'));
  check('member CAN View Projects', hasPermission(member, 'Projects', 'View'));
  // null base role behaves like member
  const nullRole = await getEffectivePermissions(makeDb({ profileRole: null, assignments: [] }), 'u', 't');
  check('null role → member default (None Admin)', nullRole.Admin === 'None');

  // ── 3. hasPermission level ordering (None<View<Edit<Full) ──
  const m = allNone(); m.Budget = 'Edit';
  check('Edit satisfies View', hasPermission(m, 'Budget', 'View'));
  check('Edit satisfies Edit', hasPermission(m, 'Budget', 'Edit'));
  check('Edit does NOT satisfy Full', !hasPermission(m, 'Budget', 'Full'));
  check('None does NOT satisfy View', !hasPermission(m, 'Safety', 'View'));

  // ── 4. project scoping ──
  const scopedFx: Fixtures = {
    profileRole: 'member',
    assignments: [{ role_id: 'r_proj', project_id: 'p1' }],
    roleDefs: [{ id: 'r_proj', permissions: { 'Change Orders': 'Full' } }],
  };
  const noProject = await getEffectivePermissions(makeDb(scopedFx), 'u', 't'); // no projectId
  check('project grant NOT applied globally', noProject['Change Orders'] === 'View'); // falls back to member default
  const wrongProject = await getEffectivePermissions(makeDb(scopedFx), 'u', 't', 'p2');
  check('project grant NOT applied to other project', wrongProject['Change Orders'] === 'View');
  const rightProject = await getEffectivePermissions(makeDb(scopedFx), 'u', 't', 'p1');
  check('project grant applied to its project', rightProject['Change Orders'] === 'Full');
  check('project grant leaves unlisted category None', rightProject.Budget === 'None');

  // ── 5. highest-wins merge across multiple global roles ──
  const mergeFx: Fixtures = {
    profileRole: 'member',
    assignments: [
      { role_id: 'a', project_id: null },
      { role_id: 'b', project_id: null },
    ],
    roleDefs: [
      { id: 'a', permissions: { Budget: 'View', Reports: 'Full' } },
      { id: 'b', permissions: { Budget: 'Edit', Reports: 'View' } },
    ],
  };
  const merged = await getEffectivePermissions(makeDb(mergeFx), 'u', 't');
  check('merge Budget = highest (Edit)', merged.Budget === 'Edit');
  check('merge Reports = highest (Full)', merged.Reports === 'Full');
  check('merge grants Budget Edit access', hasPermission(merged, 'Budget', 'Edit'));

  // global grant also applies when a projectId is supplied
  const mergedInProject = await getEffectivePermissions(makeDb(mergeFx), 'u', 't', 'pX');
  check('global grant still applies within a project', mergedInProject.Budget === 'Edit');

  console.log(`\n${pass}/${pass + fail} checks passed`);
  if (fail > 0) process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });
