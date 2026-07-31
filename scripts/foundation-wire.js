export const meta = {
  name: 'foundation-wire',
  description: 'Build 3 missing backend routes + add all missing client methods to mobile api.ts',
  phases: [{ title: 'Foundation' }],
}
const SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    task: { type: 'string' },
    added: { type: 'array', items: { type: 'string' } },
    filesEdited: { type: 'array', items: { type: 'string' } },
    compiles: { type: 'boolean' },
    notes: { type: 'string' },
  }, required: ['task', 'added', 'filesEdited', 'compiles'],
}
const NATIVE = 'D:/saguaro-mobile/'
const DEPLOY = 'C:/Users/Public/saguaro-deploy/'

const BACKEND = `Build the 3 MISSING Next.js backend routes in ${DEPLOY}. Follow the EXACT pattern of existing routes (read ${DEPLOY}app/api/safety/incidents/route.ts and ${DEPLOY}app/api/punch-list/[id]/route.ts as templates): import { createServerClient, getUser } from '@/lib/supabase-server'; getUser(req) -> 401 if null; tenant-scope every query with .eq('tenant_id', user.tenantId); only touch columns in ${DEPLOY}_schema.txt.

1) ${DEPLOY}app/api/safety/incidents/[id]/route.ts — export PATCH(req,{params}) to UPDATE a safety_incidents row by id (accept the same fields safety_incidents/create accepts, camel+snake tolerant, only real columns) and DELETE(req,{params}) to delete it. Tenant-scoped by id + tenant_id. Return {success, incident} / {success}.
2) ${DEPLOY}app/api/inspections/list/route.ts — export GET(req): list inspections for a project. Accept project_id||projectId query. Tenant-scoped. Return { inspections: data || [] } ordered by created_at desc. Guard null user -> { inspections: [] } 200.
3) ${DEPLOY}app/api/inspections/[id]/route.ts — export GET (one inspection by id+tenant), PATCH (update result/status/notes/signed_off_by/signed_off_at/re_inspection_date/etc — real columns only, camel+snake tolerant), DELETE. Tenant-scoped.

Verify each route compiles (valid TS, correct Next.js route signature). Report the routes/methods added.`

const APICLIENT = `Extend the mobile API client ${NATIVE}src/lib/api.ts with EVERY missing method below. For each, READ the corresponding backend route in ${DEPLOY}app/api/... to confirm the exact path, HTTP method, and expected body/response shape, then add a method that calls req() correctly (the existing req(path,{method,body,query}) helper; default GET). Match the existing code style in api.ts. Keep it type-clean (add/extend types or use Record<string,any>/as any for bodies as needed). Do NOT remove or break existing methods.

Add under the matching api.<group>:
- projects.create(body) -> POST /projects/create ; projects.update(id, body) -> the method /projects/[projectId] exports (read it: likely PUT/PATCH)
- rfis.update(id, body) , rfis.remove(id) (DELETE /rfis/[id]) , rfis.setStatus(id, status) (read /rfis/[id]/status method) , rfis.reassign(id, body) (/rfis/[id]/reassign)
- punchList.update(id, body) (PUT /punch-list/[id]) , punchList.remove(id) (DELETE /punch-list/[id])
- schedule.create(body) (POST /schedule/create) , schedule.remove(id) (DELETE /schedule/[id])   [schedule.update via PUT /schedule/[id] may already exist — keep it]
- photos.remove(id) (DELETE /photos/[id]) , photos.update(id, body) (read /photos/[id] method)
- drawings.update(id, body) , drawings.remove(id) (read /drawings/[id] methods)
- changeOrders.create(body) (POST /change-orders/create) , changeOrders.approve(id) , changeOrders.reject(id) , changeOrders.update(id, body) (read /change-orders/[id]/*)
- payApps.create(body) (POST /pay-apps/create)
- timesheets: add a new api.timesheets group -> clockIn(body)/create(body) (POST /timesheets/create) and setStatus/clockOut via /timesheets/[id]/status (read it)
- inspections.list(projectId) (GET /inspections/list) , inspections.get(id) , inspections.update(id, body) , inspections.remove(id) (the NEW /inspections/[id] route)
- safety.update(id, body) (PATCH /safety/incidents/[id]) , safety.remove(id) (DELETE /safety/incidents/[id])  [the NEW route]
- dailyLogs.get(id) , dailyLogs.update(id, body) , dailyLogs.remove(id) (read /daily-logs/[id] methods)

Run \`npx tsc --noEmit\` in ${NATIVE} and report whether it is clean. List every method added.`

log('Foundation: 3 backend routes + api.ts client methods')
const results = await parallel([
  () => agent(BACKEND, { label: 'backend-routes', phase: 'Foundation', schema: SCHEMA }),
  () => agent(APICLIENT, { label: 'api-client', phase: 'Foundation', schema: SCHEMA }),
])
return { results: results.filter(Boolean) }
