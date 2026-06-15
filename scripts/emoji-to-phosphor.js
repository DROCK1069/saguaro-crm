export const meta = {
  name: 'emoji-to-phosphor',
  description: 'Replace pictographic emoji with phosphor icons across 7 field pages',
  phases: [{ title: 'Replace' }],
}

const SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    files: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      properties: {
        file: { type: 'string' },
        iconsReplaced: { type: 'array', items: { type: 'string' } },
        importAdded: { type: 'string' },
        compiles: { type: 'boolean' },
        notes: { type: 'string' },
      }, required: ['file', 'iconsReplaced', 'compiles'],
    } },
  }, required: ['files'],
}

const R = 'C:/Users/Public/saguaro-deploy/'

// code point -> phosphor icon name (verified-common names)
const MAP = `
128101 (👥 people)        -> UsersThree
128119 (👷 worker)        -> HardHat
128221 (📝 memo)          -> NotePencil
128247 (📷 camera)        -> Camera
128295 (🔧 wrench)        -> Wrench
128668 (🚜 tractor)       -> Tractor
9729  (☁ cloud)          -> Cloud
9888  (⚠ warning)        -> Warning
128172 (💬 chat)          -> ChatCircle
128196 (📄 page)          -> FileText
128220 (📜 scroll)        -> Scroll
128222 (📞 phone)         -> Phone
128269 (🔍 magnifier)     -> MagnifyingGlass
9993  (✉ envelope)       -> Envelope
127959 (🏗 construction)  -> Crane
128197 (📅 calendar)      -> CalendarBlank
128296 (🔨 hammer)        -> Hammer
9742  (☎ phone)          -> Phone
127937 (🏁 flag)          -> FlagCheckered
128214 (📖 book)          -> BookOpen
128339 (🕓 clock)         -> Clock
128205 (📍 pin)           -> MapPin
128736 (🛠 tools)         -> Toolbox
128172 (💬)               -> ChatCircle
`

const FILES = [
  ['app/field/daily-log/page.tsx'],
  ['app/field/prequalification/page.tsx', 'app/field/specs/page.tsx'],
  ['app/field/resource-planning/page.tsx', 'app/field/room-progress/page.tsx'],
  ['app/field/schedule/page.tsx', 'app/field/warranty-claims/page.tsx'],
]

log(`Replacing emoji with phosphor icons across ${FILES.flat().length} files`)

function prompt(files) {
  return `You are aligning field pages in a Next.js construction PWA (saguaro-deploy) to its documented design system: NO emoji — use @phosphor-icons/react vector icons (the field bottom-nav already imports e.g. \`import { House, Warning, NotePencil, Camera } from '@phosphor-icons/react'\`).

Edit these files (Read then Edit, absolute paths under ${R}):
${files.map(f => '- ' + R + f).join('\n')}

TASK: Replace every GENUINE PICTOGRAPHIC EMOJI (written as numeric HTML entities like \`&#128119;\`) with the matching phosphor icon component. Use this exact code-point -> icon map:
${MAP}

RULES — be surgical and keep the build green:
1. KEEP these typographic/UI symbols AS-IS (do NOT touch): arrows \`&#8592;\` ← \`&#8594;\` → \`&#8599;\` ↗ \`&#8635;\` ↻ \`&#8250;\` ›, carets \`&#9662;\` ▾ \`&#9660;\` ▼ \`&#9650;\` ▲ \`&#9654;\` ▶, check \`&#10003;\` ✓, close \`&#10005;\` ✕, checkbox \`&#9744;\` ☐ \`&#9634;\` ▢, star \`&#9733;\` ★, pencil-edit \`&#9998;\` ✎. These are legitimate UI glyphs, not emoji.
2. For each emoji span, replace it with the phosphor icon at a size/color that matches the surrounding context. Typical existing pattern is \`<span style={{ fontSize: 18 }}>&#128119;</span> Crew on Site\`. Replace with \`<HardHat size={18} weight="duotone" /> Crew on Site\` (use the icon's CURRENT inline style intent — match the fontSize as the icon \`size\`, and if the span had a color use that as \`color\`). Keep it inline so layout/flex is preserved; if the label relies on vertical alignment, wrap or set \`style={{ verticalAlign: 'middle' }}\` only if clearly needed.
3. Add the icons you use to the file's import from '@phosphor-icons/react'. If the file already imports from it, MERGE names into that import (no duplicate import statements). If not, add \`import { IconA, IconB } from '@phosphor-icons/react';\` near the other imports (after the 'use client' directive and other imports). Import ONLY icons you actually use, each exactly once.
4. Use weight="duotone" for section-header icons and weight="regular" or "bold" for small inline/list icons — pick what matches the visual weight of nearby phosphor icons. Be consistent within a file.
5. Verify after editing: every phosphor component you reference is imported; no leftover GENUINE emoji entity remains in the file; JSX is balanced; you did not alter any text labels, logic, or the kept UI symbols. If an emoji has no good map entry, pick the closest sensible phosphor icon and note it.

Report per file: which icons you replaced (e.g. "👷→HardHat"), the final import line you added/merged, and compiles=true only if you are confident the file still parses.`
}

const results = await parallel(FILES.map((batch, i) =>
  () => agent(prompt(batch), { label: `emoji:${i + 1}`, phase: 'Replace', schema: SCHEMA })))

const all = []
for (const r of results.filter(Boolean)) for (const f of (r.files || [])) all.push(f)
log(`Updated ${all.length} files`)
return { files: all }
