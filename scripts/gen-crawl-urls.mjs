import fs from 'node:fs'
import path from 'node:path'
const PID = '11111111-1111-1111-1111-111111111104'
const roots = ['app/app', 'app/field']
const urls = new Set()
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else if (/^page\.(t|j)sx?$/.test(e.name)) {
      let rel = dir.replace(/\\/g, '/').replace(/^app\//, '/')
      rel = rel.split('/').filter(s => !/^\(.*\)$/.test(s)).join('/')
      if (!rel.startsWith('/')) rel = '/' + rel
      rel = rel.replace(/\[projectId\]/g, PID).replace(/\[id\]/g, PID)
      if (/\[/.test(rel)) continue // skip unfillable dynamic routes
      urls.add(rel)
    }
  }
}
roots.forEach(r => { try { walk(r) } catch (e) {} })
const list = [...urls].sort()
fs.writeFileSync('C:/Users/Public/saguaro-deploy/_crawl_urls.txt', list.join('\n'))
console.log('Generated ' + list.length + ' URLs')
