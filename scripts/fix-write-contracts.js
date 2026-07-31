export const meta = {
  name: 'fix-write-contracts',
  description: 'Align every mobile write to its backend route: accept the fields/casing the app sends, write real columns',
  phases: [{ title: 'Fix' }],
}
const SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    domain: { type: 'string' },
    mismatchesFixed: { type: 'array', items: { type: 'string' } },
    filesEdited: { type: 'array', items: { type: 'string' } },
    compiles: { type: 'boolean' },
  }, required: ['domain', 'mismatchesFixed', 'filesEdited', 'compiles'],
}
const NATIVE = 'D:/saguaro-mobile/'
const DEPLOY = 'C:/Users/Public/saguaro-deploy/'

const COMMON = `A React Native app (${NATIVE}) calls a Next.js backend (${DEPLOY}). The mobile WRITE forms send field names/casing that the backend routes DON'T read, so data is silently dropped on save. Your job: make the writes actually persist — PREFER fixing the BACKEND ROUTE (so it deploys live with no app rebuild).

For each write below: (1) Read the mobile call in ${NATIVE}src/lib/api.ts AND the screen that builds the body, to see the EXACT keys + casing the app sends. (2) Read the backend route in ${DEPLOY}app/api/... and the real columns in ${DEPLOY}_schema.txt. (3) Fix the route so it accepts BOTH camelCase and snake_case for every field the app sends (e.g. const v = body.projectType ?? body.project_type), honors them (do NOT hard-code values the user chose, like status), and INSERTs/UPDATEs the correct REAL columns (only columns that exist in _schema.txt; write to the column the list/detail screens READ from). Keep tenant scoping + auth + auto-numbering. Do NOT break existing callers (web). Only edit api.ts if the client targets the wrong path/table entirely.

Verify the route is valid TS / correct Next handler signature. Report the mismatches you fixed, files edited, compiles.`

const DOMAINS = {
  'projects-create': `${DEPLOY}app/api/projects/create/route.ts — the app sends snake_case {name, address, project_type, status, contract_value, start_date}. The route currently reads camelCase (projectType, contractAmount, startDate) and HARD-CODES status:'active'. FIX: accept project_type||projectType, status (use the value sent, default 'active' only if absent), contract_value||contractAmount (write it to the contract_value column AND original_contract/contract_amount as appropriate so the projects LIST/dashboard which read contract_value show it), start_date||startDate. project_type must be honored, not defaulted to 'commercial'. Also default percent_complete to 0 explicitly. Result: a project created on mobile shows the chosen type/status/contract/date in the list.`,
  'timesheets': `${DEPLOY}app/api/timesheets/create/route.ts and ${DEPLOY}app/api/timesheets/[id]/status/route.ts — clock-in/out is BROKEN (table/field mismatch). The app sends {project_id, clock_in, gps_clock_in} to /timesheets/create and PATCHes /timesheets/[id]/status with {status}. Determine the REAL table the time-clock data must live in (check _schema.txt: time_entries vs timesheet_entries vs timesheets) and make create INSERT a row there with clock_in, gps_clock_in (and tenant/user/project), returning {entry:{id}}. Make the status PATCH update that same table's row (set clock_out when status submitted, status). Ensure the table the create writes and the status route updates are the SAME table the app's clock history would read. If the client path is wrong, you may adjust api.ts timesheets methods to hit the correct route.`,
  'drawings-photos': `Two write-contract bugs. (1) ${DEPLOY}app/api/drawings/[id]/route.ts — sheet_number edit is dropped on save; accept sheet_number||sheetNumber||sheet_no and title/discipline/revision, update the real columns. (2) ${DEPLOY}app/api/photos/[id]/route.ts — caption is lost. The app's api.photos.update sends {description} (mapped from caption). Make the route accept caption||description and write it to the column the photos screen READS as the caption (check _schema.txt: caption vs description) — accept both and write the one the grid/lightbox displays. Also the upload caption: ensure ${DEPLOY}app/api/photos/upload/route.ts persists a caption if the app sends one.`,
  'schedule': `${DEPLOY}app/api/schedule/create/route.ts and ${DEPLOY}app/api/schedule/[id]/route.ts — the app's schedule.create maps title->name and pct, and saveEdit sends {title,start_date,end_date,phase,trade,percent_complete,status}. Make BOTH routes accept name||title, start_date||startDate, end_date||endDate, phase, trade, percent_complete||pct_complete||percentComplete, status — and write the real schedule_tasks columns (check _schema.txt; e.g. percent column name). Honor trade (it's currently dropped on create). Keep tenant scoping.`,
  'financials': `${DEPLOY}app/api/change-orders/create/route.ts and ${DEPLOY}app/api/pay-apps/create/route.ts. Change order: app sends {title, description, amount/cost_impact/costImpact, schedule_impact_days/scheduleImpact} — accept all casings and write the real change_orders columns (amount/cost_impact, schedule_impact_days, description, title, status default). Pay app: app sends {period_to/periodTo, work_completed/workCompleted} — accept both, write the real pay_applications columns the financials detail sheet READS (the audit says the detail reads work_completed and retainage — make create/list expose those exact keys, or write to the real columns and have list return them). Ensure created COs/pay-apps appear in the financials lists with their amounts.`,
  'punch-inspection': `(1) ${DEPLOY}app/api/punch-list/create/route.ts — the app sends assigned_to but it's dropped; accept assigned_to (it's a real punch_list column) and insert it. (2) ${DEPLOY}app/api/inspections/create/route.ts — the template-wizard save posts {template_name, results, score} with no top-level result; set a sensible top-level result/status from the score (e.g. passed if score>=threshold else failed/conditional) so saved inspections show a result. Accept both the wizard shape and the manual-form shape.`,
}

log(`Fixing write contracts across ${Object.keys(DOMAINS).length} domains`)
const results = await parallel(Object.entries(DOMAINS).map(([k, task]) =>
  () => agent(`${COMMON}\n\n=== DOMAIN: ${k} ===\n${task}`, { label: k, phase: 'Fix', schema: SCHEMA })))
return { domains: results.filter(Boolean) }
