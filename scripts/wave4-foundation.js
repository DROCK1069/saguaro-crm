export const meta = {
  name: 'wave4-foundation',
  description: 'Final foundation: toolbox-talk edit/delete + milestone CRUD routes + api.ts methods for all P2 features',
  phases: [{ title: 'Foundation' }],
}
const SCHEMA = { type: 'object', additionalProperties: false, properties: { task: { type: 'string' }, added: { type: 'array', items: { type: 'string' } }, filesEdited: { type: 'array', items: { type: 'string' } }, compiles: { type: 'boolean' }, notes: { type: 'string' } }, required: ['task', 'added', 'filesEdited', 'compiles'] }
const NATIVE = 'D:/saguaro-mobile/'
const DEPLOY = 'C:/Users/Public/saguaro-deploy/'

const BACKEND = `Backend routes in ${DEPLOY}. Follow the existing route pattern (import { createServerClient, getUser } from '@/lib/supabase-server'; getUser->401; service-role client; tenant-scope EVERY query with .eq('tenant_id', user.tenantId); real columns from ${DEPLOY}_schema.txt only; camel+snake tolerant via a pick() helper; Next 14 handler signature with { params }: { params: Promise<{ id: string }> } and await params). Auto-number columns must be computed.

1) CREATE ${DEPLOY}app/api/safety/talks/[id]/route.ts — export PATCH (update a toolbox_talks row by id+tenant_id: topic, presenter, talk_date, content, attendee_count, duration_minutes — real toolbox_talks columns only) and DELETE (delete by id+tenant_id). Return {success}/{success, talk}.

2) Milestones (the existing app/api/schedule/milestones/[projectId]/route.ts is GET-by-project — do NOT add a sibling [id] segment, Next.js forbids two dynamic names at one level):
   - CREATE ${DEPLOY}app/api/schedule/milestones/route.ts — export POST: create a schedule_milestones row (accept project_id/projectId, title/name, milestone_date/date/target_date — use the REAL date column from _schema.txt for schedule_milestones; tenant_id from user). Return {success, milestone}.
   - CREATE ${DEPLOY}app/api/schedule/milestone/[id]/route.ts (note SINGULAR 'milestone' to avoid the [projectId] clash) — export PUT (update title/date/status — real columns) and DELETE, tenant-scoped by id+tenant_id.
   Read schedule_milestones columns in _schema.txt first to use the correct date/name column names.

3) INVESTIGATE insurance: app/api/insurance/[...path]/route.ts is a catch-all. Determine whether GET /api/insurance/list (or what path) returns a tenant's COI/insurance certificates for a project, and which real table it reads (subcontractor_insurance / insurance_certificates / coi). If a simple project COI list isn't reachable, CREATE ${DEPLOY}app/api/insurance/list/route.ts — export GET: list the tenant's COIs/insurance for a project (project_id/projectId query), tenant-scoped, return { certificates: data || [] } (guard null user -> [] 200). Report the table + path the mobile should call.

Report routes/methods added and the insurance list path/table.`

const APICLIENT = `Extend ${NATIVE}src/lib/api.ts (don't break existing methods; read each backend route to confirm path/method/shape; cast bodies as any if needed). Add:
- payApps.update(id, body) -> PUT /pay-apps/[id] ; payApps.remove(id) -> DELETE /pay-apps/[id]
- changeOrders.remove(id) -> DELETE /change-orders/[id]   (changeOrders.update already exists via /change-orders/[id]/update PATCH — keep it)
- safety.updateTalk(id, body) -> PATCH /safety/talks/[id] ; safety.removeTalk(id) -> DELETE /safety/talks/[id]   [NEW routes]
- schedule.createMilestone(body) -> POST /schedule/milestones ; schedule.updateMilestone(id, body) -> PUT /schedule/milestone/[id] ; schedule.removeMilestone(id) -> DELETE /schedule/milestone/[id]   [NEW routes]
- lienWaivers.list(projectId?) -> GET /lien-waivers/list  (route exists; accept optional projectId query)
- insurance.list(projectId) -> GET the insurance/COI list path the backend agent settled on (default GET /insurance/list?projectId=)  ; returns { certificates }
Run npx tsc --noEmit in ${NATIVE}; report clean + list methods.`

log('Wave 4 foundation')
const r = await parallel([
  () => agent(BACKEND, { label: 'backend', phase: 'Foundation', schema: SCHEMA }),
  () => agent(APICLIENT, { label: 'api-client', phase: 'Foundation', schema: SCHEMA }),
])
return { results: r.filter(Boolean) }
