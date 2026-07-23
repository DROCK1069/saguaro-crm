export const meta = {
  name: 'wave5-blockers',
  description: 'Close the 4 audit beta-blockers: drawings PDF upload, lien-waiver + insurance PDF view, insurance COI upload',
  phases: [{ title: 'Foundation' }, { title: 'UI' }],
}
const R = 'D:/saguaro-mobile/'
const DEPLOY = 'C:/Users/Public/saguaro-deploy/'
const SCHEMA = { type: 'object', additionalProperties: false, properties: { unit: { type: 'string' }, built: { type: 'array', items: { type: 'string' } }, compiles: { type: 'boolean' }, notes: { type: 'string' } }, required: ['unit', 'built', 'compiles'] }

const COMMON = `React Native (Expo, expo-router) construction app at ${R}. Backend (Next.js) at ${DEPLOY}. Match existing patterns exactly: theme tokens C, PressScale, AppIcon, Toast, Haptics on success, react-native-modal bottom sheets, 0.5px C.b1 hairlines, gold CTAs, sentence-case headers. Run npx tsc --noEmit in ${R} and report compiles. Do not break existing flows.`

// ---- Phase 1: api.ts foundation (insurance upload/request) ----
phase('Foundation')
const apiResult = await agent(`${COMMON}

Extend ${R}src/lib/api.ts insurance object (currently only has .list). Read the backend catch-all ${DEPLOY}app/api/insurance/[...path]/route.ts AND the handlers it dispatches in ${DEPLOY}lib/insurance-tracker.ts (uploadCOIHandler ~line 165, requestCOIHandler ~line 66) to learn the EXACT path + payload each expects. Add:
- insurance.upload(projectId, formDataOrBody) -> POST the COI upload path (likely /insurance/upload). If it expects multipart/form-data (a file), accept a FormData and post it like api.photos.upload / api.drawings.upload already do (read those to copy the exact req() multipart usage — headers, body). If it expects JSON (a pdf_url + fields), accept an object. Report which it is.
- insurance.request(body) -> POST /insurance/request with { projectId/project_id, sub_id/subcontractor_id, ... } as the handler expects.
Keep insurance.list exactly as-is. Cast bodies as any if needed. Report the exact path, method, and content-type for upload + request. Run npx tsc --noEmit; report clean.`, { label: 'api-insurance', phase: 'Foundation', schema: SCHEMA })

// ---- Phase 2: UI (3 parallel, no file overlap) ----
phase('UI')
const UNITS = {
  'drawings-pdf': `Primary file: ${R}app/project/[id]/drawings.tsx
The drawing upload picker is hard-locked to ImagePicker.launchImageLibraryAsync({mediaTypes:['images']}) so PDF sheets (the dominant real drawing format) can't be uploaded. expo-document-picker is now INSTALLED.
BUILD: In the upload flow, let the user choose a PDF or an image. Use DocumentPicker.getDocumentAsync({ type: ['application/pdf','image/*'], copyToCacheDirectory: true }) — read the existing image-upload code first and mirror exactly how it builds FormData and calls api.drawings.upload(fd) (filename, mime type, the {uri,name,type} append shape). For a PDF asset set the FormData file name to *.pdf and type 'application/pdf'; preserve the existing image path too (you may keep the ImagePicker option as an 'Image' choice and add a 'PDF / document' choice, OR switch the single picker to DocumentPicker that accepts both — pick the cleanest given the current code). Keep the metadata sheet (title/sheet_number/discipline) and all success/error/haptic handling. Verify api.drawings.upload already posts multipart (it does) — no api.ts change.`,
  'lien-pdf-view': `Primary file: ${R}app/lien-waivers.tsx
Beta-blocker: a user is asked to 'Mark signed' with NO way to read the waiver document. The lien_waivers row already includes pdf_url and signed_pdf_url (the list route does select('*')).
BUILD: In the detail bottom sheet, add a 'View document' button (gold-outline secondary, AppIcon 'file-text' or 'eye') shown when pdf_url || signed_pdf_url exists, that opens the doc with React Native's built-in Linking.openURL(signed_pdf_url || pdf_url) (import { Linking } from 'react-native' — NO new package). Wrap in try/catch -> error Toast if it can't open. Place it above the existing 'Mark signed' CTA so the user can read before signing. Keep everything else. No api.ts change.`,
  'insurance-view-upload': `Primary file: ${R}app/insurance.tsx
Two beta-blockers: (1) no way to view the certificate PDF, (2) read-only — a field user with an expired/missing COI has no action to upload one.
BUILD:
(1) In the certificate detail sheet add a 'View certificate' button (gold-outline, AppIcon 'file-text'/'eye') when the row's pdf_url exists -> Linking.openURL(pdf_url) (import { Linking } from 'react-native'; try/catch -> error Toast).
(2) Add an 'Upload COI' action (header button or a CTA above the list) that lets the user pick a PDF/image via expo-document-picker (DocumentPicker.getDocumentAsync({ type:['application/pdf','image/*'], copyToCacheDirectory:true })) and calls api.insurance.upload(projectId, <as the api method added this wave expects> ) — READ the new api.insurance.upload signature in ${R}src/lib/api.ts (added this wave) and call it exactly as defined (FormData vs JSON). On success: Haptics + Toast + reload the list. On error: error Toast. Keep the read-only detail view, expiring-soon highlighting, and all states. Resolve projectId the same way the screen already does.`,
}
const ui = await parallel(Object.entries(UNITS).map(([k, build]) =>
  () => agent(`${COMMON}\n\n=== UNIT: ${k} ===\n${build}`, { label: k, phase: 'UI', schema: SCHEMA })))

return { foundation: apiResult, ui: ui.filter(Boolean) }
