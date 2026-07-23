export const meta = {
  name: 'reaudit-blockers',
  description: 'Re-audit the 4 previously-blocked screens to confirm betaBlocker now false',
  phases: [{ title: 'Re-audit' }],
}
const SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    screen: { type: 'string' },
    priorBlocker: { type: 'string' },
    nowResolved: { type: 'boolean' },
    verdict: { type: 'string', enum: ['WORKS', 'THIN', 'STUBBED', 'BROKEN', 'MISSING'] },
    betaBlocker: { type: 'boolean' },
    detail: { type: 'string' },
    remainingGaps: { type: 'array', items: { type: 'string' } },
  }, required: ['screen', 'nowResolved', 'betaBlocker', 'detail'],
}
const NATIVE = 'D:/saguaro-mobile/'
const DEPLOY = 'C:/Users/Public/saguaro-deploy/'
const COMMON = `Read-only re-audit (NO edits). Construction app: RN/Expo frontend ${NATIVE}, Next.js backend ${DEPLOY}, schema ${DEPLOY}_schema.txt. For the assigned screen, read the native file AND the backend route(s)/columns it touches. Confirm whether the SPECIFIC prior beta-blocker is now actually resolved end-to-end. Set betaBlocker=true ONLY if a beta user would still hit a STUBBED/BROKEN/MISSING/data-loss action on a core workflow. Be skeptical and cite api method + route + column.`

const CASES = [
  { screen: 'app/project/[id]/financials.tsx', prior: 'Pay-app EDIT silently dropped the work_completed dollar amount (PUT /pay-apps/[id] columnMap had no work_completed mapping). Backend was just fixed to map work_completed->this_period and recompute total_retainage/current_payment_due/net_payment_due. Confirm the mobile edit now persists the amount.' },
  { screen: 'app/lien-waivers.tsx', prior: 'Sign route had no tenant_id guard (cross-tenant write) — now fixed (.eq tenant_id + 404). ALSO a user could Mark-signed with no way to read the waiver PDF — a View document button (Linking on pdf_url/signed_pdf_url) was just added. Confirm both: user can view doc before signing, and sign is tenant-safe.' },
  { screen: 'app/insurance.tsx', prior: 'Screen was read-only: no PDF view, no upload (backend uploadCOIHandler existed but unused). A View certificate button (Linking pdf_url) and an Upload COI action (expo-document-picker -> api.insurance.upload, FormData coiId+file) were just added. Confirm a field user can now view a COI and upload one.' },
  { screen: 'app/project/[id]/drawings.tsx', prior: 'Upload picker was images-only (ImagePicker), so PDF drawing sheets (dominant format) could not be uploaded. Just swapped to expo-document-picker accepting application/pdf + image/*. Confirm PDFs now upload via api.drawings.upload and render in the grid.' },
]

log(`Re-auditing ${CASES.length} previously-blocked screens`)
const results = await parallel(CASES.map(c =>
  () => agent(`${COMMON}\n\nScreen: ${NATIVE}${c.screen}\nPRIOR BETA-BLOCKER: ${c.prior}`,
    { label: c.screen.split('/').pop().replace('.tsx', ''), phase: 'Re-audit', schema: SCHEMA })))
const all = results.filter(Boolean)
const still = all.filter(s => s.betaBlocker).map(s => s.screen)
log(`Still blocking: ${still.join(', ') || 'NONE — all 4 resolved'}`)
return { results: all, stillBlocking: still }
