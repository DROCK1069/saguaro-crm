export const meta = {
  name: 'feature-audit',
  description: 'Beta-readiness audit: every action on every screen vs its backend route + schema (read-only, no fixes)',
  phases: [{ title: 'Audit' }],
}

const SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    screens: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      properties: {
        screen: { type: 'string' },
        actions: { type: 'array', items: {
          type: 'object', additionalProperties: false,
          properties: {
            action: { type: 'string' },
            verdict: { type: 'string', enum: ['WORKS', 'THIN', 'STUBBED', 'BROKEN', 'MISSING'] },
            detail: { type: 'string' },
          }, required: ['action', 'verdict', 'detail'],
        } },
        missingCrud: { type: 'array', items: { type: 'string' } },
        betaBlocker: { type: 'boolean' },
      }, required: ['screen', 'actions', 'missingCrud', 'betaBlocker'],
    } },
  }, required: ['screens'],
}

const NATIVE = 'D:/saguaro-mobile/'
const DEPLOY = 'C:/Users/Public/saguaro-deploy/'

const COMMON = `You are auditing a construction-management mobile app (React Native/Expo frontend in ${NATIVE}, Next.js backend in ${DEPLOY}) for BETA READINESS. The user was wrongly told it was 100% done; it is not. Your job is an HONEST, read-only audit (NO edits) of whether every feature actually works end-to-end.

For each assigned screen: Read the native screen (${NATIVE}<path>). For EVERY interactive action a user can take (every button, create/submit, edit, delete, toggle, filter, row-tap, upload, AI action), determine the TRUE state by also reading the backend route it calls (in ${DEPLOY}app/api/...) and checking the real DB schema (${DEPLOY}_schema.txt):
- **WORKS**: fully wired — calls a real api method, the backend route exists and persists/returns the correct full data, UI handles success/error.
- **THIN**: wired but the backend route persists only a SUBSET of the relevant columns (data silently lost), OR the form captures far fewer fields than the table supports.
- **STUBBED**: no-op handler, Alert('coming soon'), TODO, disabled with no impl, or the button does nothing real.
- **BROKEN**: calls an endpoint that 404s / wrong method / would throw, or reads a field that doesn't exist.
- **MISSING**: an action a real user NEEDS that isn't there at all (e.g. can create but cannot edit or delete; no detail view; no status change).

Also list missingCrud (CRUD operations a real workflow needs but the screen lacks). Set betaBlocker=true if this screen has a STUBBED/BROKEN/MISSING action that a beta user would hit on a core workflow.

Be skeptical and specific — cite the api method, the backend route, and the column(s). Do NOT edit anything. This is reconnaissance to plan the fixes.`

const BATCHES = [
  ['app/(tabs)/index.tsx', 'app/(tabs)/projects.tsx'],
  ['app/(tabs)/field.tsx', 'app/(tabs)/more.tsx', 'app/(tabs)/sage.tsx'],
  ['app/project/[id]/index.tsx', 'app/project/[id]/daily.tsx'],
  ['app/project/[id]/rfis.tsx', 'app/project/[id]/punch.tsx'],
  ['app/project/[id]/safety.tsx', 'app/project/[id]/inspection.tsx'],
  ['app/project/[id]/drawings.tsx', 'app/project/[id]/photos.tsx'],
  ['app/project/[id]/schedule.tsx', 'app/project/[id]/financials.tsx'],
]

log(`Beta-readiness audit across ${BATCHES.flat().length} screens`)

const results = await parallel(BATCHES.map((b, i) =>
  () => agent(
    `${COMMON}\n\nAssigned screen(s):\n${b.map(f => '- ' + NATIVE + f).join('\n')}\n\nReturn one object PER screen (call the structured output once per screen, or include all — but cover every screen).`,
    { label: b[0].split('/').pop().replace('.tsx', ''), phase: 'Audit', schema: SCHEMA }
  )))

const all = results.filter(Boolean)
const blockers = all.filter(s => s.betaBlocker).map(s => s.screen)
log(`Audited ${all.length} screens; beta-blockers on: ${blockers.join(', ') || 'none'}`)
return { screens: all }
