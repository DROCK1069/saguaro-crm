export const meta = {
  name: 'wire-actions',
  description: 'Wire the missing write-lifecycle UI (create/edit/delete/status/detail) across all screens',
  phases: [{ title: 'Build' }],
}
const SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    screen: { type: 'string' },
    built: { type: 'array', items: { type: 'string' } },
    compiles: { type: 'boolean' },
    notes: { type: 'string' },
  }, required: ['screen', 'built', 'compiles'],
}
const R = 'D:/saguaro-mobile/'

const COMMON = `You are completing a React Native (Expo) construction app for BETA. The mobile API client ${R}src/lib/api.ts ALREADY HAS every method you need (projects.create/update, rfis.update/remove/setStatus/reassign, punchList.update/remove, schedule.create/update/remove, photos.update/remove, drawings.update/remove, changeOrders.create/approve/reject/update, payApps.create, timesheets.create/clockIn/setStatus/clockOut, inspections.list/get/update/remove, safety.update/remove, dailyLogs.get/update/remove). DO NOT edit api.ts — just call these methods. Read api.ts to confirm exact signatures.

Build the listed missing actions on the assigned screen using the existing UI patterns ALREADY in that file (the same Modal/react-native-modal, theme tokens C, PressScale, AppIcon, Toast, sectioned form cards, chip selectors, gold CTAs from the create forms). Match the professional restrained style (white cards, 0.5px C.b1 hairlines, tinted icon chips, gold as the one accent, sentence-case headers). After building:
- Wire success/error: success haptic + Toast, then reload the list (call the screen's existing load/refresh).
- Add confirm (Alert) before destructive delete.
- Keep all existing behavior; do not break the create flows just added.
Run \`npx tsc --noEmit\` in ${R} and report compiles. List what you built.`

const SCREENS = {
  'projects': {
    file: 'app/(tabs)/projects.tsx',
    build: `CREATE PROJECT (critical — a fresh tenant has zero projects and no way to make one). Add a "+" / "New project" button in the header that opens a modal form: name (required), address, project_type (chip: Commercial/Residential/Industrial/Civil/Other), status (chip: precon/active/construction/closeout), contract_value (numeric), start_date (YYYY-MM-DD). On submit -> api.projects.create({...}) -> success -> reload list. Also add the same "+ New project" affordance to the EMPTY state.`,
  },
  'home': {
    file: 'app/(tabs)/index.tsx',
    build: `The 'Needs attention' alert rows currently have NO onPress (dead taps with a chevron). Wire each to navigate to a sensible target: Open RFIs / Overdue Punch -> the first active project's rfis/punch screen (router.push('/project/'+activeId+'/rfis' etc.); if no active project, router.push('/(tabs)/projects')). Keep the chevron only on rows that now navigate.`,
  },
  'field': {
    file: 'app/(tabs)/field.tsx',
    build: `Clock in/out currently only sets LOCAL zustand state — make it PERSIST. On Clock In: call api.timesheets.clockIn({ project_id: selectedProject.id, clock_in: <ISO now>, gps_clock_in: optional }) and store the returned entry id; keep the local timer for UX. On Clock Out: call api.timesheets.clockOut(entryId) (or setStatus). Handle offline gracefully (the api req() already queues writes). Show a small "today's hours / last clock" line. Keep the existing live timer UI.`,
  },
  'rfis': {
    file: 'app/project/[id]/rfis.tsx',
    build: `In the RFI detail modal add: EDIT (open the ManualRFIForm prefilled with the selected RFI -> api.rfis.update(id, body)), DELETE (confirm -> api.rfis.remove(id)), CLOSE / change status (api.rfis.setStatus(id,'closed'/'open')), and REASSIGN ball-in-court (small input -> api.rfis.reassign(id,{assigned_to_name})). Also FIX the THIN AI-draft submit: when submitting an AI draft, persist the full draft (subject, question, priority, due_date, etc.) not just title/description.`,
  },
  'punch': {
    file: 'app/project/[id]/punch.tsx',
    build: `In the punch detail sheet add: EDIT (prefill the create form -> api.punchList.update(id, body)), DELETE (confirm -> api.punchList.remove(id)), ASSIGN (text field -> include assigned_to via update). Keep the existing status-change + notes.`,
  },
  'safety': {
    file: 'app/project/[id]/safety.tsx',
    build: `FIX BROKEN: the Stats/badge read i.osha_reportable but the form sets osha_recordable — make the form set osha_reportable (or read osha_recordable consistently) so the OSHA stat/badge reflects what's captured. Add EDIT incident (prefill report form -> api.safety.update(id, body)) and DELETE incident (confirm -> api.safety.remove(id)) in the incident detail modal. Add immediate_actions to the report form. Make the toolbox-talk row open a read-only detail modal (topic, presenter, date, content).`,
  },
  'inspection': {
    file: 'app/project/[id]/inspection.tsx',
    build: `Add a saved-inspections HISTORY list: on load call api.inspections.list(projectId) and render the saved inspections (type, result chip, inspector, date). Tapping one opens a DETAIL modal (api.inspections.get) where the user can UPDATE result/status (chip: pending/passed/conditional_pass/failed), notes, sign-off (signed_off_by/signed_off_at=now) -> api.inspections.update(id, body); and DELETE (confirm -> api.inspections.remove(id)). Keep the template chooser + create form.`,
  },
  'schedule': {
    file: 'app/project/[id]/schedule.tsx',
    build: `Add CREATE TASK (a "+" button -> modal form: name (required), start_date, end_date, phase, trade, percent_complete -> api.schedule.create({project_id,...})). Extend the EDIT sheet to also edit name/start_date/end_date/phase/trade (not only percent_complete) -> api.schedule.update(id, body). Add DELETE task (confirm -> api.schedule.remove(id)). The empty state must offer "+ Add task".`,
  },
  'photos': {
    file: 'app/project/[id]/photos.tsx',
    build: `Add a CAPTION input at capture time (pass caption to the upload). In the lightbox add: EDIT caption (-> api.photos.update(id,{caption})) and DELETE photo (confirm -> api.photos.remove(id) -> remove from grid). `,
  },
  'drawings': {
    file: 'app/project/[id]/drawings.tsx',
    build: `In the upload flow capture metadata: title, sheet_number, discipline (chip: Architectural/Structural/Mechanical/Electrical/Plumbing/Civil/General) and pass them to the upload. Allow PDF in the picker (application/pdf). Add per-sheet DELETE (confirm -> api.drawings.remove(id)) and EDIT metadata (-> api.drawings.update(id, body)).`,
  },
  'financials': {
    file: 'app/project/[id]/financials.tsx',
    build: `Wire the dead Pay Application and Change Order rows: each row onPress opens a DETAIL modal showing the record's fields. Add CREATE CHANGE ORDER (modal: title, description, cost_impact, schedule_impact_days -> api.changeOrders.create({project_id,...})) and approve/reject actions in the CO detail (api.changeOrders.approve/reject). Add CREATE PAY APPLICATION (modal: period_to date, amount/work_completed -> api.payApps.create({project_id,...})).`,
  },
  'daily': {
    file: 'app/project/[id]/daily.tsx',
    build: `Make past LogCard rows tappable -> DETAIL modal (api.dailyLogs.get(id)) showing the full report. Add EDIT (prefill the form -> api.dailyLogs.update(id, body)) and DELETE (confirm -> api.dailyLogs.remove(id)). Prevent duplicate same-date logs (warn if a log for that date already exists before create).`,
  },
}

log(`Wiring write-lifecycle UI across ${Object.keys(SCREENS).length} screens`)
const results = await parallel(Object.entries(SCREENS).map(([key, s]) =>
  () => agent(`${COMMON}\n\n=== SCREEN: ${R}${s.file} ===\nBUILD:\n${s.build}`,
    { label: key, phase: 'Build', schema: SCHEMA })))
const all = results.filter(Boolean)
log(`Built actions on ${all.length} screens`)
return { screens: all }
