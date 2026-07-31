export const meta = {
  name: 'design-pass',
  description: 'App-wide enterprise visual upgrade: tinted icon chips, full labels, refined type, restrained palette',
  phases: [{ title: 'Restyle' }],
}

const SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    screens: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      properties: {
        file: { type: 'string' },
        changes: { type: 'array', items: { type: 'string' } },
        compiles: { type: 'boolean' },
      }, required: ['file', 'changes', 'compiles'],
    } },
  }, required: ['screens'],
}

const R = 'D:/saguaro-mobile/'

const SYSTEM = `Apply this ENTERPRISE design system (think Procore/Autodesk — restrained, premium) to the assigned React Native screens. The app is Apple-light; theme tokens are imported as \`C\` from the src/theme path already used in each file (C.gold #C8881C, C.goldXL #A66E10, C.t1 text, C.t2 muted, C.t3 hint, C.bg0 page, C.bg1/bg2 white card, C.bg3 fill, C.b1 #E5E5EA hairline, C.blue/green/red/amber/purple iOS system colors). Do NOT change data wiring, navigation, or behavior — visual/layout only. Keep it compiling.

RULES (the user said the app "looks cheap like not Procore"):
1) **Kill the candy-bright solid icon chips.** Anywhere an icon sits in a solid full-color rounded square with a white glyph (e.g. \`backgroundColor: item.color\` + white icon), convert to a TINTED chip: background = the color at ~12-14% opacity (e.g. \`\${color}1F\` hex-alpha or an rgba), and the ICON rendered in the FULL color (not white). Keep the chip ~36-40px, radius ~10-11. This instantly reads enterprise instead of toy.
2) **Gold is the ONE brand accent.** Primary CTAs/active states use C.gold. Reserve blue/green/red/amber/purple for STATUS meaning only (success/warning/danger/info), not decoration.
3) **Full labels, no truncation.** Remove \`numberOfLines={1}\` where it truncates action/nav labels (e.g. "Daily Rep…" → "Daily report"). If space is tight, allow 2 lines or shorten the WORD, never clip mid-word.
4) **Quick Actions grid (home screen index.tsx):** replace the cramped single-row of solid tiles with a 2-column grid of clean white cards (white bg, 0.5px C.b1 border, radius ~14, padding ~13) each = a tinted icon chip + a full single-line label. Keep the same actions/handlers/order.
5) **Typography:** section headers in sentence case (not Title Case, not ALL CAPS) — e.g. "Quick actions", "Needs attention", "Active projects". Use weight 600-700 max but reduce shouty sizes; muted labels in C.t2 at 13px. Keep numbers tabular (fontVariant tabular-nums) where present.
6) **Hairlines & spacing:** use 0.5px C.b1 separators (not heavy borders), generous consistent padding, soft existing shadows. Don't add gradients or heavy shadows.
7) Keep all existing functionality, onPress handlers, and the PressScale sizing-forwarding fix intact.

Be surgical. After editing, verify imports are intact, JSX balanced, no behavior changed. Report per file the visual changes made and compiles=true only if confident it parses.`

const BATCHES = [
  ['app/(tabs)/index.tsx'],
  ['app/(tabs)/more.tsx', 'app/(tabs)/projects.tsx'],
  ['app/(tabs)/field.tsx', 'app/(tabs)/sage.tsx'],
  ['app/project/[id]/index.tsx', 'app/project/[id]/financials.tsx'],
  ['app/project/[id]/punch.tsx', 'app/project/[id]/rfis.tsx'],
  ['app/project/[id]/safety.tsx', 'app/project/[id]/inspection.tsx'],
  ['app/project/[id]/photos.tsx', 'app/project/[id]/drawings.tsx', 'app/project/[id]/schedule.tsx'],
  ['app/project/[id]/daily.tsx', 'app/(auth)/login.tsx'],
]

log(`Enterprise design pass across ${BATCHES.flat().length} screens`)

const results = await parallel(BATCHES.map((b, i) =>
  () => agent(
    `${SYSTEM}\n\nAssigned screens (Read then Edit, absolute paths under ${R}):\n${b.map(f => '- ' + R + f).join('\n')}`,
    { label: `style:${i + 1}`, phase: 'Restyle', schema: SCHEMA }
  )))

const all = []
for (const r of results.filter(Boolean)) for (const s of (r.screens || [])) all.push(s)
log(`Restyled ${all.length} screens`)
return { screens: all }
