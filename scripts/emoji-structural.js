export const meta = {
  name: 'emoji-structural',
  description: 'Convert structural/decorative emoji to phosphor icons; keep semantic color-coded ones',
  phases: [{ title: 'Convert' }],
}

const SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    file: { type: 'string' },
    converted: { type: 'array', items: { type: 'string' } },
    kept: { type: 'array', items: { type: 'string' } },
    importLine: { type: 'string' },
    compiles: { type: 'boolean' },
    notes: { type: 'string' },
  }, required: ['file', 'converted', 'kept', 'compiles'],
}

const R = 'C:/Users/Public/saguaro-deploy/'
const COMMON = `You are aligning the WEB field PWA (saguaro-deploy) to a "structural emoji become vector icons, semantic color-coded emoji stay" policy. Icons come from @phosphor-icons/react (already used in app/field/layout.tsx). Read the file first (absolute path), then make surgical Edits.

GENERAL RULES:
- Replace each CONVERT-listed emoji with the mapped phosphor icon component at a size/color matching its context (a fontSize:40 empty-state glyph -> size={40} weight="duotone" color={DIM if available}; a small inline/button glyph -> size matching the adjacent text, weight="bold" or "regular").
- Merge needed icons into the file's existing @phosphor-icons/react import if present; otherwise add ONE new import line near the other imports (after 'use client'). Import each icon exactly once; only import what you use.
- DO NOT TOUCH anything in the KEEP list — those are semantic/color-coded (weather, safety hazard categories, pass/fail status) and must stay as emoji.
- DO NOT alter text labels, logic, data, or typographic UI symbols (arrows ← → ↑ ↻, carets ▼ ▾ ▲, checks ✓, ✕, ›, ·, °).
- Keep JSX balanced. After editing, confirm no CONVERT emoji remain and every phosphor component you wrote is imported. Report converted[], kept[], the final import line, and compiles=true only if confident the file still parses.
`

const TASKS = {
  'app/field/more/page.tsx': `CONVERT — the 8 navigation menu section TITLES (each is a string like \`title: '📋 Daily Operations'\` in a sections array, then rendered as a section header). Strip the leading emoji from each title string, and in the section-header render add the mapped phosphor icon before the title text (read the render to see how titles display; if a clean icon injection isn't feasible, fall back to a plain text-only title — professional is fine). Map: 📋 Daily Operations->ClipboardText; 🏗 Quality & Punch->Ruler; 📄 Documents & Plans->FileText; 💰 Financial->CurrencyDollar; ⚠️ Safety->Warning; 👥 People & Comms->UsersThree; 🏗️ Spatial Intelligence->Cube; 🔧 Tools->Wrench.
KEEP — nothing else to keep here (no semantic emoji in this file).`,

  'app/field/trade-guide/page.tsx': `CONVERT — the 🤖 robot glyph at the two spots (~lines 255 and 431) -> phosphor Robot, sized to match the surrounding text/heading.
KEEP — any non-emoji symbols.`,

  'app/field/photos/page.tsx': `CONVERT — the two action-button glyphs: ✏️ Edit (~line 497) -> PencilSimple; 🗑 Delete (~line 510) -> Trash. Render the icon inline before the label at a size matching the button text (e.g. size={14}).
KEEP — any non-emoji symbols.`,

  'app/field/forms/page.tsx': `CONVERT — the 📋 empty-state glyph (~line 415, inside a div with fontSize:40) -> ClipboardText size={40} weight="duotone" (use a muted color if one is in scope). Replace the emoji; you may drop the now-unused fontSize but keep the div's margin.
KEEP — any non-emoji symbols.`,

  'app/field/observations/page.tsx': `This file mixes structural and SEMANTIC emoji — be precise.
CONVERT (structural only): 🔍 empty-state glyph (~line 978, fontSize:40) -> MagnifyingGlass; inline META label icons -> 📋 template (~lines 1004 and 1354) -> ClipboardText; 📍 location (~line 1005) -> MapPin; 🔧 trade (~line 1006) -> Wrench; 📷 photo button (~line 1169) -> Camera; 🕐 datetime (~line 1353) -> Clock. These inline ones are small (size ~12-14, weight regular, verticalAlign middle).
KEEP (semantic — DO NOT TOUCH): the sentiment icons in the config arrays (~lines 32-33: ✗, ⚠), ALL safety category icons in the templates array (~lines 95-189: 🧹 🦺 🪢 🏗 ⚡ 🕳 🔥 🔧 🚪), the stat-card icons (~lines 380-399: 📂 🦺 📅 ⚡), the checklist pass count ✅ (~line 1008), and the status config glyphs (~line 1395: ✓/✗, ~line 1448: ⚡). Leave every one of those as the literal emoji.`,

  'app/field/incidents/page.tsx': `This file mixes structural and SEMANTIC emoji — be precise.
CONVERT (structural only): 🛡️ empty-state glyph (~line 604, fontSize:40) -> ShieldCheck; 📍 "Capture GPS" button glyph (~line 704) -> MapPin; 📍 location inline (~line 627) -> MapPin (small, size ~12).
KEEP (semantic — DO NOT TOUCH): the incident TYPE_ICONS map (~lines 28-29: 🩹 injury, 🤒 illness, ⚠️ near_miss, 🏗️ property_damage, 🌿 environmental, 🚗 vehicle, 🔥 fire, 📋 other), the 📋 fallback in the type badge render (~line 613), and the recordable status glyphs (~line 771: ⚠ / ✓). Leave those as literal emoji.`,

  'app/field/layout.tsx': `CONVERT — the ⚠ glyph in the dead-letter alert banner (~line 477, \`<span ...>⚠ {deadCount} item...\`) -> phosphor Warning. NOTE: this file ALREADY imports Warning from '@phosphor-icons/react' (line 10) — do not add a duplicate import; just use <Warning size={14} weight="fill" /> inline before the text, matching the GOLD color context.
KEEP — everything else.`,
}

const entries = Object.entries(TASKS)
log(`Converting structural emoji across ${entries.length} files (keeping semantic icons)`)

const results = await parallel(entries.map(([file, task]) =>
  () => agent(`${COMMON}\nFILE: ${R}${file}\n\n${task}`, { label: file.split('/').slice(-2)[0], phase: 'Convert', schema: SCHEMA })))

const ok = results.filter(Boolean)
log(`Updated ${ok.length}/${entries.length} files`)
return { files: ok }
