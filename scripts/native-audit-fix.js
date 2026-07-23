export const meta = {
  name: 'native-audit-fix',
  description: 'Audit + fix every native iOS screen (layout collapse, raw enums, dead buttons, truncation)',
  phases: [{ title: 'Audit+Fix' }],
}

const SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    screens: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      properties: {
        file: { type: 'string' },
        bugsFound: { type: 'array', items: { type: 'string' } },
        fixesApplied: { type: 'array', items: { type: 'string' } },
        compiles: { type: 'boolean' },
      }, required: ['file', 'bugsFound', 'fixesApplied', 'compiles'],
    } },
  }, required: ['screens'],
}

const R = 'D:/saguaro-mobile/'
const BATCHES = [
  ['app/(auth)/login.tsx', 'app/(auth)/forgot.tsx', 'app/(tabs)/index.tsx'],
  ['app/(tabs)/projects.tsx', 'app/(tabs)/field.tsx', 'app/(tabs)/sage.tsx'],
  ['app/(tabs)/more.tsx', 'app/project/[id]/index.tsx'],
  ['app/project/[id]/daily.tsx', 'app/project/[id]/drawings.tsx', 'app/project/[id]/financials.tsx'],
  ['app/project/[id]/inspection.tsx', 'app/project/[id]/photos.tsx', 'app/project/[id]/punch.tsx'],
  ['app/project/[id]/rfis.tsx', 'app/project/[id]/safety.tsx', 'app/project/[id]/schedule.tsx'],
]

log(`Auditing + fixing ${BATCHES.flat().length} native screens`)

const SYSTEMIC = `
KNOWN SYSTEMIC BUGS — check for and FIX these in every file:

1) **PressScale collapses percentage/flex-width grid cards** (THE big one — it makes metric cards render as one-character-wide columns with text wrapping vertically). Most screens define a local \`PressScale\` that renders \`<Pressable><Animated.View style={[{transform},style]}>\`. Because the caller's \`style\` (e.g. \`width:'48%'\` or \`flex:1\`) lands on the INNER Animated.View, the percentage resolves against the touchable's content width and collapses. FIX: forward sizing/layout props to the OUTER Pressable. Replace the PressScale render with:
\`\`\`
const _f = StyleSheet.flatten(style) || {}
const { width, height, flexBasis, flexGrow, flexShrink, flex, alignSelf, margin, marginTop, marginBottom, marginLeft, marginRight, marginHorizontal, marginVertical, ..._rest } = _f
return (
  <Pressable onPressIn=... onPressOut=... onPress=... disabled=... accessibilityRole=... accessibilityLabel=... hitSlop=...
    style={{ width, height, flexBasis, flexGrow, flexShrink, flex, alignSelf, margin, marginTop, marginBottom, marginLeft, marginRight, marginHorizontal, marginVertical }}>
    <Animated.View style={[{ transform: [{ scale }] }, _rest]}>{children}</Animated.View>
  </Pressable>
)
\`\`\`
Add \`StyleSheet\` to the react-native import if missing. This keeps visual styles (bg/padding/radius) + the press-scale on the inner view, and sizing on the touchable. (The inner view stretches to fill because View default alignItems is 'stretch'.) Apply to EVERY local PressScale/animated tap-wrapper in the file.

2) **Invalid percentage gap** — \`gap: '4%'\`/\`gap:'X%' as any\` is INVALID in React Native (gap takes a NUMBER). It breaks row layouts. FIX: remove the percentage gap; give grid cards \`width:'48%'\` with the row using \`justifyContent:'space-between'\` and \`rowGap:<number>\`, OR use a numeric \`gap\`. Make 2-up grids actually 2 columns that fill the width.

3) **Raw DB enum/snake_case shown to users** — values like \`conditional_progress\`, \`First_Aid\`, \`in_use\`, \`on_hold\` rendered verbatim. FIX: humanize at render — replace underscores with spaces and Title-Case (e.g. \`s.replace(/_/g,' ').replace(/\\b\\w/g, c=>c.toUpperCase())\`). Apply to every status/type/category string shown in the UI.

4) **Truncated values / cut-off text** — numbers like "$2…", "3." cut off because a card is too narrow or has numberOfLines clipping. Once (1) and (2) are fixed the cards are wide enough; also ensure value Text has enough room (drop overly-aggressive numberOfLines={1} on metric values, or use adjustsFontSizeToFit).
`

function prompt(batch) {
  return `You are fixing REAL rendering bugs in a React Native (Expo) iOS app. The user is furious because these screens render broken on a real phone (metric cards collapsed to vertical single letters, values cut off, raw database strings shown). Read each file with Read, then FIX it with Edit. Absolute paths under ${R}.

${SYSTEMIC}

ALSO audit each screen for and fix: dead buttons (onPress missing or no-op where a navigation/action is clearly intended), \`.map\`/\`.filter\` on possibly-undefined data without a guard, text that overflows its container, hardcoded widths that clip content, and any obviously broken layout. Do NOT change working behavior or data wiring — these are presentation/layout fixes. Keep the existing Apple-light visual style.

Files to fix:
${batch.map(f => '- ' + R + f).join('\n')}

Be thorough and surgical. Verify after each edit that imports are complete (e.g. StyleSheet), JSX is balanced, and you introduced no new errors. Report per file: bugsFound (what was wrong), fixesApplied (what you changed), compiles (true only if confident it still parses).`
}

const results = await parallel(BATCHES.map((b, i) =>
  () => agent(prompt(b), { label: `fix:${i + 1}`, phase: 'Audit+Fix', schema: SCHEMA })))

const all = []
for (const r of results.filter(Boolean)) for (const s of (r.screens || [])) all.push(s)
const totalBugs = all.reduce((n, s) => n + (s.bugsFound?.length || 0), 0)
log(`Fixed ${all.length} screens, ${totalBugs} bugs total`)
return { screens: all }
