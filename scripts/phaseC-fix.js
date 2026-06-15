export const meta = {
  name: 'phaseC-fix',
  description: 'Fix the 20 broken pages found by the Phase C crawl',
  phases: [{ title: 'Fix' }],
}

const SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    fixes: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      properties: {
        page: { type: 'string' },
        rootCause: { type: 'string' },
        fixApplied: { type: 'string' },
        filesEdited: { type: 'array', items: { type: 'string' } },
        confident: { type: 'boolean' },
      }, required: ['page', 'rootCause', 'fixApplied', 'filesEdited', 'confident'],
    } },
  }, required: ['fixes'],
}

const R = 'C:/Users/Public/saguaro-deploy/'
const BROKEN = [
  { page: '/app/client-portal', err: 'JS crash (ErrorBoundary caught error)', files: ['app/app/client-portal/page.tsx'] },
  { page: '/app/notifications', err: 'console 404 on a fetched resource', files: ['app/app/notifications/page.tsx'] },
  { page: '/app/prequalification', err: 'JS crash (ErrorBoundary)', files: ['app/app/prequalification/page.tsx'] },
  { page: '/app/projects/[projectId]/inspections', err: '500 from GET /api/projects/[projectId]/inspections', files: ['app/app/projects/[projectId]/inspections/page.tsx', 'app/api/projects/[projectId]/inspections/route.ts'] },
  { page: '/app/projects/[projectId]/insurance', err: '400 from /api/insurance/[id]', files: ['app/app/projects/[projectId]/insurance/page.tsx', 'app/api/insurance/[id]/route.ts'] },
  { page: '/app/projects/[projectId]/proposal', err: '500 from /api/projects/[projectId]/proposals', files: ['app/app/projects/[projectId]/proposal/page.tsx', 'app/api/projects/[projectId]/proposals/route.ts'] },
  { page: '/app/projects/[projectId]/subs', err: '500 from /api/subs/list', files: ['app/app/projects/[projectId]/subs/page.tsx', 'app/api/subs/list/route.ts'] },
  { page: '/app/roles-permissions', err: 'JS crash (ErrorBoundary)', files: ['app/app/roles-permissions/page.tsx'] },
  { page: '/field/activity', err: 'JS crash', files: ['app/field/activity/page.tsx'] },
  { page: '/field/ar-overlay', err: '400 from /api/ar/calibration', files: ['app/field/ar-overlay/page.tsx', 'app/api/ar/calibration/route.ts'] },
  { page: '/field/bim-viewer', err: '405 from GET /api/bim/upload (route is POST-only; page GETs it to list)', files: ['app/field/bim-viewer/page.tsx', 'app/api/bim/upload/route.ts'] },
  { page: '/field/closeout', err: 'JS crash', files: ['app/field/closeout/page.tsx'] },
  { page: '/field/contracts', err: 'JS crash', files: ['app/field/contracts/page.tsx'] },
  { page: '/field/crew-map', err: '400 from /api/field/crew-locations (route reads project_id query param; page likely sends projectId)', files: ['app/field/crew-map/page.tsx', 'app/api/field/crew-locations/route.ts'] },
  { page: '/field/deliveries', err: '400 from /api/field/delivery-tracking (param name mismatch likely)', files: ['app/field/deliveries/page.tsx', 'app/api/field/delivery-tracking/route.ts'] },
  { page: '/field/drone', err: '405 from GET /api/drone/upload (POST-only; page GETs to list)', files: ['app/field/drone/page.tsx', 'app/api/drone/upload/route.ts'] },
  { page: '/field/escalations', err: '405 from GET /api/ai/escalation-check (POST-only; page GETs to list)', files: ['app/field/escalations/page.tsx', 'app/api/ai/escalation-check/route.ts'] },
  { page: '/field/laser', err: '400 from /api/laser/measurements (param name mismatch likely)', files: ['app/field/laser/page.tsx', 'app/api/laser/measurements/route.ts'] },
  { page: '/field/leaderboard', err: '500 from /api/gamification/badges and /api/gamification/leaderboard', files: ['app/field/leaderboard/page.tsx', 'app/api/gamification/badges/route.ts', 'app/api/gamification/leaderboard/route.ts'] },
  { page: '/field/resource-planning', err: 'JS crash', files: ['app/field/resource-planning/page.tsx'] },
]

const BATCH = 3
const batches = []
for (let i = 0; i < BROKEN.length; i += BATCH) batches.push(BROKEN.slice(i, i + BATCH))
log(`Fixing ${BROKEN.length} broken pages in ${batches.length} batches`)

function prompt(batch) {
  return `You are fixing broken pages in a Next.js construction SaaS (saguaro-deploy). Real Supabase schema at ${R}_schema.txt (JSON of every table's columns) — consult it before assuming a column exists. Routes use createServerClient() (service role) + getUser(req) for the tenant. Field tool pages read projectId from the URL ?projectId=.

Fix each of these broken pages by editing the listed files (use the Read then Edit tools, absolute paths under ${R}). Diagnose the ROOT CAUSE, then fix it. Patterns:
- **405 (GET on a POST-only route)**: the page GETs an action/upload endpoint on mount to LIST existing records. Add an \`export async function GET(req)\` to that route that returns the relevant list — query the obvious table (bim_models for bim, drone_jobs for drone, escalations for escalation-check), tenant-scoped via getUser(req).tenantId, filtered by project_id when present. Return { <key>: data || [] } matching what the page expects.
- **400 (missing/mismatched param)**: the route requires a query param (often project_id snake_case) but the page sends projectId (camelCase) or omits it. FIX THE ROUTE to accept BOTH: \`searchParams.get('project_id') || searchParams.get('projectId')\`. If the param is genuinely required and absent, prefer returning empty data ({ items: [] }) over a 400 so the page renders. Do not break the POST handler.
- **500 (route throws)**: read the route, find the throw inside try/catch — common causes: \`user\` is null so \`user.tenantId\` throws (guard: \`if (!user) return NextResponse.json({...empty}, { status: 200 })\` or use \`user?.tenantId\`); a column that doesn't exist (check _schema.txt and use the real column, or \`select('*')\`); an .order() on a missing column. Fix so it returns 200 with data (or empty) for a valid logged-in request.
- **JS crash (ErrorBoundary / pageerror)**: read the page, find the runtime error during render/mount — usually accessing a property of undefined, .map/.filter on a non-array, or .toLowerCase()/.split() on undefined from an API field. Add null-guards / default to [] / optional chaining so the page renders even with empty data.

Pages to fix (with their observed error):
${batch.map(b => `- ${b.page} — ${b.err}\n  files: ${b.files.map(f => R + f).join(', ')}`).join('\n')}

Be surgical and correct — verify column names against _schema.txt, don't introduce new bugs, keep existing behavior. Report rootCause + the exact fix per page.`
}

const results = await parallel(batches.map((b, i) =>
  () => agent(prompt(b), { label: `fix:${i + 1}`, phase: 'Fix', schema: SCHEMA })))

const all = []
for (const r of results.filter(Boolean)) for (const f of (r.fixes || [])) all.push(f)
log(`Applied fixes to ${all.length} pages`)
return { fixes: all }
