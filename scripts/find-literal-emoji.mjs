import fs from 'node:fs'
import path from 'node:path'
// Reliable Unicode emoji sweep across field pages.
const root = 'app/field'
// Emoji ranges (pictographic). Excludes plain typographic symbols we keep.
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}\u{2190}-\u{21FF}]/u
// Keep-list of typographic symbols (arrows/carets/checks/x/star/box) that are legit UI, by code point.
const KEEP = new Set([0x2190, 0x2192, 0x2197, 0x21bb, 0x2039, 0x203a, 0x25be, 0x25bc, 0x25b2, 0x25b4, 0x25b6, 0x2713, 0x2715, 0x2610, 0x25a2, 0x2605, 0x2606, 0x270e, 0x00b0])
const files = []
function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.tsx?$/.test(e.name)) files.push(p) } }
walk(root)
let total = 0
for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split('\n')
  const hits = []
  lines.forEach((ln, i) => {
    for (const ch of ln) {
      const cp = ch.codePointAt(0)
      if (KEEP.has(cp)) continue
      if (EMOJI.test(ch)) { hits.push(`${i + 1}: ${ch} (U+${cp.toString(16).toUpperCase()})  ${ln.trim().slice(0, 70)}`); break }
    }
  })
  if (hits.length) { total += hits.length; console.log(`\n${f}  (${hits.length})`); hits.forEach(h => console.log('   ' + h)) }
}
console.log(`\n=== ${total} literal-emoji lines across ${files.length} field files ===`)
