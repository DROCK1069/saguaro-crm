import fs from 'node:fs'
import path from 'node:path'

const API_TS = 'D:/saguaro-mobile/src/lib/api.ts'
const API_DIR = 'C:/Users/Public/saguaro-deploy/app/api'

// 1) Index every backend route: normalized path ('*' for [param]) -> { file, methods }
const routes = new Map()
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else if (e.name === 'route.ts' || e.name === 'route.js') {
      const rel = path.dirname(p).slice(API_DIR.length).replace(/\\/g, '/') // e.g. /rfis/[id]/answer
      const norm = rel.replace(/\[[^/]+\]/g, '*')
      const src = fs.readFileSync(p, 'utf8')
      const methods = new Set()
      for (const m of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
        if (new RegExp(`export\\s+(async\\s+)?function\\s+${m}\\b`).test(src) ||
            new RegExp(`export\\s+const\\s+${m}\\b`).test(src)) methods.add(m)
      }
      routes.set(norm, { file: rel, methods })
    }
  }
}
walk(API_DIR)

// 2) Extract every endpoint call from api.ts: path + method (window heuristic for method)
const lines = fs.readFileSync(API_TS, 'utf8').split('\n')
const calls = []
const callRe = /\breq(?:Raw)?\s*(?:<[^>]*>)?\s*\(\s*[`'"]([^`'"]+)[`'"]/
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(callRe)
  if (!m) continue
  let method = 'GET'
  for (let j = i; j < Math.min(i + 7, lines.length); j++) {
    const mm = lines[j].match(/method:\s*'([A-Z]+)'/)
    if (mm) { method = mm[1]; break }
  }
  calls.push({ line: i + 1, rawPath: m[1], method })
}

// 3) Cross-check
const norm = p => p.replace(/\$\{[^}]+\}/g, '*').replace(/\?.*$/, '').replace(/\/$/, '')
const rows = []
for (const c of calls) {
  const np = norm(c.rawPath)
  const route = routes.get(np)
  let verdict
  if (!route) verdict = 'MISSING ROUTE'
  else if (!route.methods.has(c.method)) verdict = `NO ${c.method} (has ${[...route.methods].join(',') || 'none'})`
  else verdict = 'ok'
  rows.push({ ...c, np, verdict })
}

const bad = rows.filter(r => r.verdict !== 'ok')
console.log(`=== ${rows.length} app->backend calls checked ===`)
console.log(`OK: ${rows.length - bad.length}   PROBLEMS: ${bad.length}\n`)
if (bad.length) {
  console.log('--- PROBLEMS ---')
  for (const r of bad) console.log(`  [${r.method}] ${r.rawPath}  ->  ${r.verdict}  (api.ts:${r.line})`)
}
console.log('\n--- ALL (method  path  verdict) ---')
for (const r of rows) console.log(`  ${r.method.padEnd(6)} ${r.rawPath.padEnd(42)} ${r.verdict}`)
