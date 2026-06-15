export const meta = {
  name: 'build-create-forms',
  description: 'Build full create forms (with all options) + expand backend routes for RFI, Punch, Safety, Inspection',
  phases: [{ title: 'Build' }],
}

const SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    tool: { type: 'string' },
    formFields: { type: 'array', items: { type: 'string' } },
    backendFieldsAdded: { type: 'array', items: { type: 'string' } },
    filesEdited: { type: 'array', items: { type: 'string' } },
    compiles: { type: 'boolean' },
    notes: { type: 'string' },
  }, required: ['tool', 'formFields', 'backendFieldsAdded', 'filesEdited', 'compiles'],
}

const NATIVE = 'D:/saguaro-mobile/'
const DEPLOY = 'C:/Users/Public/saguaro-deploy/'

const COMMON = `You are completing a construction-management app so its "create" buttons open FULL professional forms (like Procore) that actually save — not thin stubs. This is FULL-STACK: a React Native (Expo) screen in ${NATIVE} AND its Next.js backend create route in ${DEPLOY}.

BACKEND ROUTE (in ${DEPLOY}): expand the create route's inserted \`row\` to accept and persist ALL the listed fields. Accept BOTH camelCase and snake_case from the body (e.g. \`body.dueDate || body.due_date\`). Keep tenant scoping (user.tenantId), keep any auto-number logic, default missing optionals to null (or sensible defaults). Only insert columns that exist in the provided schema. Do not break the existing insert.

FRONTEND FORM (the native screen): the create button must open a clean, PROFESSIONAL modal form (the app uses react-native-modal, theme tokens from '../../../src/theme' as \`C\`, and AppIcon). Build a sectioned form with:
- A labeled field per item below. Use <TextInput> for text/number (keyboardType='numeric' for numbers, multiline for long text), a simple segmented/chip selector or a small dropdown for ENUM fields (render the options as selectable pills — highlight the chosen one in C.gold), a date text field (YYYY-MM-DD), and a toggle (Pressable pill) for booleans.
- Required-field validation (disable submit until required filled; shake or toast on invalid).
- A gold primary "Submit"/"Create" CTA that calls the existing api method (e.g. api.rfis.create / api.punchList.create / api.safety.report / api.inspections.create) with the full body, then on success: success toast, close modal, reload the list. Cast the body \`as any\` if TypeScript complains about extra fields (do NOT edit src/lib/api.ts — it passes the body through).
- PROFESSIONAL styling (the user just said the app looks cheap): white cards, 0.5px hairline borders (C.b1), generous padding, clear field labels in C.t2 (13px), inputs with C.bg3 background and rounded corners, section spacing. NOT bright candy colors — restrained, gold as the one accent.
- Keep any EXISTING flow that works (e.g. the RFI "Draft with AI" path) and ADD the full manual form alongside it (e.g. a toggle between "Draft with AI" and "Manual").

Verify after editing: imports complete, JSX balanced, no obviously broken code. Report formFields (what the form captures), backendFieldsAdded (columns now persisted), filesEdited, compiles.`

const TOOLS = {
  RFI: {
    native: 'app/project/[id]/rfis.tsx',
    backend: 'app/api/rfis/create/route.ts',
    table: 'rfis',
    fields: `subject (text, REQUIRED), question (multiline text, REQUIRED), priority (enum: low/medium/high/critical), due_date (date), spec_section (text), drawing_reference (text), assigned_to_name (text — "Ball in court / assigned to"), is_urgent (boolean toggle), cost_impact (numeric, optional) + cost_impact_direction (enum: add/deduct), schedule_impact_days (numeric, optional), notes (multiline text). KEEP the existing "Draft with AI" path — add a Manual/AI toggle at the top of the create modal.`,
    api: 'api.rfis.create({ project_id, ...fields })',
  },
  Punch: {
    native: 'app/project/[id]/punch.tsx',
    backend: 'app/api/punch-list/create/route.ts',
    table: 'punch_list_items',
    fields: `title (text, REQUIRED), description (multiline text), location (text), trade (enum: General/Electrical/Plumbing/Mechanical/Framing/Drywall/Painting/Flooring/Roofing/Concrete/Landscaping), priority (enum: low/medium/high/critical), due_date (date), notes (multiline text). (Skip assigned_to — it is a uuid needing a user picker; omit it.)`,
    api: 'api.punchList.create({ project_id, ...fields })',
  },
  Safety: {
    native: 'app/project/[id]/safety.tsx',
    backend: 'app/api/safety/incidents/route.ts',
    table: 'safety_incidents',
    fields: `description (multiline text, REQUIRED), severity (enum: low/medium/high/critical), incident_type (enum: injury/illness/near_miss/property_damage/environmental/fire/other), injured_person (text), body_part (text), injury_type (text), location (text), incident_date (date), incident_time (text, e.g. 2:30 PM), witnesses (text), root_cause (multiline text), corrective_actions (multiline text), near_miss (boolean toggle), osha_recordable (boolean toggle), first_aid_only (boolean toggle). This is the "Report Incident" button.`,
    api: 'api.safety.report({ project_id, ...fields })',
  },
  Inspection: {
    native: 'app/project/[id]/inspection.tsx',
    backend: 'app/api/inspections/create/route.ts',
    table: 'inspections',
    fields: `inspection_type (enum: Building/Framing/Electrical/Plumbing/Mechanical/Fire/Foundation/Insulation/Final/Other), inspector_name (text), inspector_agency / agency (text), ahj_name (text — authority having jurisdiction), permit_number (text), scheduled_date (date), result (enum: pending/passed/conditional_pass/failed), notes (multiline text), weather (text). Add a "New inspection" form/button alongside the existing template chooser (keep the templates).`,
    api: 'api.inspections.create({ project_id, ...fields })',
  },
}

log(`Building full create forms + backend for ${Object.keys(TOOLS).length} tools`)

const results = await parallel(Object.entries(TOOLS).map(([tool, t]) =>
  () => agent(
    `${COMMON}\n\n=== TOOL: ${tool} ===\nNative screen: ${NATIVE}${t.native}\nBackend create route: ${DEPLOY}${t.backend}\nDB table \`${t.table}\` — only insert columns that exist there (you were given the real schema; if unsure, read ${DEPLOY}_schema.txt).\nAPI call: ${t.api}\n\nFORM FIELDS TO BUILD (with all options):\n${t.fields}`,
    { label: tool, phase: 'Build', schema: SCHEMA }
  )))

const ok = results.filter(Boolean)
log(`Built ${ok.length}/${Object.keys(TOOLS).length} tool forms`)
return { tools: ok }
