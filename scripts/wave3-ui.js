export const meta = {
  name: 'wave3-ui',
  description: 'Wave 3 UI: project edit/status/archive, financials detail+status, drawings metadata, equipment/lien detail',
  phases: [{ title: 'Build' }],
}
const SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: { screen: { type: 'string' }, built: { type: 'array', items: { type: 'string' } }, compiles: { type: 'boolean' }, notes: { type: 'string' } },
  required: ['screen', 'built', 'compiles'],
}
const R = 'D:/saguaro-mobile/'
const COMMON = `React Native (Expo) app. The API client ${R}src/lib/api.ts ALREADY has every method you need (read it to confirm signatures): projects.update(id,body), projects.remove(id), payApps.submit/certify/approve/markPaid(id), changeOrders.approve(id)/reject(id,body?), lienWaivers.sign(id,{signedBy}), drawings.update/remove. DO NOT edit api.ts.

Build using the existing patterns in the file (react-native-modal, theme tokens C, PressScale, AppIcon, Toast, sectioned cards, chip selectors, gold CTAs, tinted icon chips, 0.5px C.b1 hairlines, sentence-case). On success: haptic + Toast then reload the screen's list/data; confirm (Alert) before destructive actions. Run npx tsc --noEmit in ${R}; report compiles. Do not break existing flows.`

const SCREENS = {
  'project-hub': {
    file: 'app/project/[id]/index.tsx',
    build: `This is the project hub. Add project MANAGEMENT: (1) an 'Edit' action (header button or a small menu) that opens a modal prefilled with the project's name/address/project_type/status/contract_value and saves via api.projects.update(id, body) then reloads. (2) A STATUS changer (chips precon/active/construction/closeout) that calls api.projects.update(id,{status}). (3) An 'Archive project' destructive action (Alert confirm -> api.projects.remove(id) -> Toast -> router.back(), since the archived project leaves the list). Also FIX the dead 'Change Orders' metric card: give it onPress that router.push(es) to /project/<id>/financials. Keep Key Metrics / Modules / Financial summary intact.`,
  },
  'financials': {
    file: 'app/project/[id]/financials.tsx',
    build: `Wire the pay-app and change-order rows + status workflow. (1) Pay-app row onPress -> a DETAIL modal that reads the REAL columns (period_to, this_period as 'Work completed this period', total_retainage as 'Retainage', current_payment_due as 'Payment due', status, app_number) — do NOT read work_completed/retainage (those columns don't exist). In the detail add status actions by current status: draft->Submit (api.payApps.submit), submitted->Certify (api.payApps.certify), certified->Approve (api.payApps.approve), approved->Mark paid (api.payApps.markPaid); each reloads. (2) Change-order row onPress -> DETAIL modal showing title/description/amount/schedule_impact_days/status, with Approve (api.changeOrders.approve) and Reject (api.changeOrders.reject) actions when status is pending/submitted; each reloads. Keep the existing Ring + KPI cards + create CO/pay-app flows.`,
  },
  'drawings': {
    file: 'app/project/[id]/drawings.tsx',
    build: `Ensure the upload actually SENDS the metadata the backend now persists: when uploading, the FormData must include 'sheet_number', 'title' (and 'discipline') from the upload form's inputs (the backend drawings/upload route reads sheet_number/title/discipline). If the current upload only appends the file + projectId, add the metadata fields to the FormData. Confirm the per-sheet Delete (api.drawings.remove) and Edit-metadata (api.drawings.update) flows are wired and call reload after. Allow PDF in the picker if not already.`,
  },
  'more': {
    file: 'app/(tabs)/more.tsx',
    build: `Make the Equipment and Lien-waiver list rows TAPPABLE -> open a read-only DETAIL modal built from the row data already loaded (there is no per-id GET endpoint, so just present the fields already in the list item: for equipment name/make/model/type/status/location; for lien waivers claimant_name/waiver_type/amount/status). For the lien-waiver detail, add a 'Mark signed' action when status is not already signed: api.lienWaivers.sign(id, { signedBy: user?.email || 'Field' }) then reload the lien waivers list. Keep the existing Equipment/Lien sections, the 'More tools' on-web rows, and Sign out unchanged.`,
  },
}

log(`Wave 3 UI across ${Object.keys(SCREENS).length} screens`)
const results = await parallel(Object.entries(SCREENS).map(([k, s]) =>
  () => agent(`${COMMON}\n\n=== SCREEN: ${R}${s.file} ===\nBUILD:\n${s.build}`, { label: k, phase: 'Build', schema: SCHEMA })))
return { screens: results.filter(Boolean) }
