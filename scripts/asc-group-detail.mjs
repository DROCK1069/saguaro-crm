import fs from 'node:fs'
import crypto from 'node:crypto'
const key = fs.readFileSync('D:/saguaro-mobile/asc-key.p8', 'utf8')
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const si = `${b64({ alg: 'ES256', kid: '5K68FJU2Y4', typ: 'JWT' })}.${b64({ iss: '5e02d4b3-9be8-4773-8c11-8018b7973dd8', iat: now, exp: now + 1100, aud: 'appstoreconnect-v1' })}`
const JWT = `${si}.${crypto.sign('SHA256', Buffer.from(si), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`
const api = async (p) => { const r = await fetch(`https://api.appstoreconnect.apple.com${p}`, { headers: { Authorization: `Bearer ${JWT}` } }); const b = await r.json().catch(() => ({})); return r.ok ? b : { error: r.status, detail: JSON.stringify(b).slice(0, 300) } }

const PUBLIC_BETA = '74bfacd1-9b90-4b1d-ab1b-47a8e3150461'
const INTERNAL = '2d1d68e8-4a08-4cee-8366-6609ce8d7887'

console.log('=== Builds served by PUBLIC BETA (external) group ===')
const gb = await api(`/v1/betaGroups/${PUBLIC_BETA}/builds?limit=10&sort=-uploadedDate&fields[builds]=version,processingState,expired`)
if (gb.error) console.log('  err', gb.error, gb.detail)
else if (!(gb.data || []).length) console.log('  (NO builds attached — public link will show "no builds available")')
else for (const b of gb.data) console.log(`  build ${b.attributes.version}  proc=${b.attributes.processingState} expired=${b.attributes.expired}`)

console.log('\n=== Testers in PUBLIC BETA group ===')
const gt = await api(`/v1/betaGroups/${PUBLIC_BETA}/betaTesters?limit=50&fields[betaTesters]=email,state`)
if (gt.error) console.log('  err', gt.error, gt.detail)
else console.log('  count:', (gt.data || []).length, '->', (gt.data || []).map(t => t.attributes.email).join(', ') || '(none)')

console.log('\n=== Builds served by INTERNAL group ===')
const ib = await api(`/v1/betaGroups/${INTERNAL}/builds?limit=5&sort=-uploadedDate&fields[builds]=version,processingState,expired`)
if (ib.error) console.log('  err', ib.error, ib.detail)
else for (const b of ib.data || []) console.log(`  build ${b.attributes.version}  proc=${b.attributes.processingState} expired=${b.attributes.expired}`)
console.log('\n=== Testers in INTERNAL group ===')
const it = await api(`/v1/betaGroups/${INTERNAL}/betaTesters?limit=50&fields[betaTesters]=email,state`)
if (it.error) console.log('  err', it.error, it.detail)
else console.log('  ', (it.data || []).map(t => t.attributes.email).join(', ') || '(none)')
