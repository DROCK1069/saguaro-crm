export const meta = {
  name: 'wave3-foundation',
  description: 'Wave 3 foundation: projects DELETE route + drawings upload metadata fix + api.ts methods',
  phases: [{ title: 'Foundation' }],
}
const SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: { task: { type: 'string' }, added: { type: 'array', items: { type: 'string' } }, filesEdited: { type: 'array', items: { type: 'string' } }, compiles: { type: 'boolean' }, notes: { type: 'string' } },
  required: ['task', 'added', 'filesEdited', 'compiles'],
}
const NATIVE = 'D:/saguaro-mobile/'
const DEPLOY = 'C:/Users/Public/saguaro-deploy/'

const BACKEND = `Backend work in ${DEPLOY}. Follow the existing route pattern (import { createServerClient, getUser } from '@/lib/supabase-server'; getUser->401; service-role client; tenant-scope every query with .eq('tenant_id', user.tenantId); real columns from ${DEPLOY}_schema.txt only).

1) ${DEPLOY}app/api/projects/[projectId]/route.ts currently exports only GET and PUT. ADD a DELETE handler that SOFT-deletes the project (set is_archived=true and archived_at=now(), or is_deleted=true/deleted_at=now() — use whichever columns exist in _schema.txt for the projects table; prefer is_archived/archived_at). Tenant-scoped by id+tenant_id. Return {success:true}. Do NOT hard-delete (FKs). Keep the existing GET/PUT.

2) ${DEPLOY}app/api/projects/list/route.ts — make the list EXCLUDE soft-deleted/archived projects (add .or filter or .neq so is_archived/is_deleted rows don't return). Don't break the existing select.

3) ${DEPLOY}app/api/drawings/upload/route.ts — the mobile upload sends FormData with the file PLUS metadata fields (sheet_number, title, discipline). Verify the route reads formData.get('sheet_number')/('title')/('discipline') (accept both snake & camel) and writes them to the real drawings columns (sheet_number, name, discipline). If it ignores them (only stores the file/name), FIX it so the metadata persists. Real columns: drawings(name, url, sheet_number, discipline, version, status, notes).

Report routes/handlers added or fixed.`

const APICLIENT = `Extend ${NATIVE}src/lib/api.ts (do not break existing methods). Add, verifying each against the backend route in ${DEPLOY}app/api/:
- projects.remove(id) -> DELETE /projects/[projectId] (the new soft-delete handler)
- payApps.submit(id) -> POST /pay-apps/[id]/submit ; payApps.certify(id) -> POST /pay-apps/[id]/certify ; payApps.approve(id) -> POST /pay-apps/[id]/approve ; payApps.markPaid(id, body?) -> POST /pay-apps/[id]/paid  (read each route to confirm method/path; if a route doesn't exist, skip that one and note it)
- equipment.get(id)/equipment.update(id, body) IF /api/equipment/[id] exists (check; else skip)
- lienWaivers: add get(id) and any sign/send method that has a real backend route under /api/lien-waivers (check app/api/lien-waivers; wire only ones that exist)
Run npx tsc --noEmit in ${NATIVE}; report it is clean and list methods added.`

log('Wave 3 foundation: backend routes + api.ts')
const r = await parallel([
  () => agent(BACKEND, { label: 'backend', phase: 'Foundation', schema: SCHEMA }),
  () => agent(APICLIENT, { label: 'api-client', phase: 'Foundation', schema: SCHEMA }),
])
return { results: r.filter(Boolean) }
