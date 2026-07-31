import fs from 'node:fs'
import crypto from 'node:crypto'

const KEY_PATH = 'D:/saguaro-mobile/asc-key.p8'
const KID = '5K68FJU2Y4'
const ISS = '5e02d4b3-9be8-4773-8c11-8018b7973dd8'
const APP_ID = '6775089200'
const AVERY = 'avery@tntcyber.com'

const key = fs.readFileSync(KEY_PATH, 'utf8')
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const signingInput = `${b64({ alg: 'ES256', kid: KID, typ: 'JWT' })}.${b64({ iss: ISS, iat: now, exp: now + 1100, aud: 'appstoreconnect-v1' })}`
const sig = crypto.sign('SHA256', Buffer.from(signingInput), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')
const JWT = `${signingInput}.${sig}`

const api = async (path) => {
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, { headers: { Authorization: `Bearer ${JWT}` } })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) return { error: res.status, detail: JSON.stringify(body).slice(0, 300) }
  return body
}

try {
  console.log('=== APPS this key can see ===')
  const apps = await api('/v1/apps?limit=50&fields[apps]=name,bundleId,sku')
  if (apps.error) { console.log('apps error', apps.error, apps.detail) }
  else for (const a of apps.data || []) console.log(`  ${a.id}  ${a.attributes.name}  (${a.attributes.bundleId})`)

  console.log('\n=== TARGET APP', APP_ID, '===')
  const app = await api(`/v1/apps/${APP_ID}?fields[apps]=name,bundleId`)
  if (app.error) console.log('  app error', app.error, app.detail)
  else console.log(`  ${app.data.attributes.name}  (${app.data.attributes.bundleId})`)

  console.log('\n=== RECENT BUILDS (newest first) ===')
  const builds = await api(`/v1/builds?filter[app]=${APP_ID}&limit=8&sort=-uploadedDate&include=betaAppReviewSubmission,preReleaseVersion&fields[builds]=version,processingState,expired,uploadedDate,usesNonExemptEncryption,betaAppReviewSubmission,preReleaseVersion&fields[betaAppReviewSubmissions]=betaReviewState&fields[preReleaseVersions]=version,platform`)
  const inc = {}
  for (const i of builds.included || []) inc[`${i.type}:${i.id}`] = i
  if (builds.error) console.log('  builds error', builds.error, builds.detail)
  else for (const b of builds.data || []) {
    const at = b.attributes
    const pr = b.relationships?.preReleaseVersion?.data
    const prv = pr ? inc[`preReleaseVersions:${pr.id}`]?.attributes : null
    const rev = b.relationships?.betaAppReviewSubmission?.data
    const revState = rev ? inc[`betaAppReviewSubmissions:${rev.id}`]?.attributes?.betaReviewState : '(none submitted)'
    console.log(`  v${prv?.version || '?'} (${at.version})  proc=${at.processingState}  expired=${at.expired}  betaReview=${revState}  enc=${at.usesNonExemptEncryption}  uploaded=${at.uploadedDate}`)
  }

  console.log('\n=== BETA GROUPS ===')
  const groups = await api(`/v1/betaGroups?filter[app]=${APP_ID}&limit=50&fields[betaGroups]=name,isInternalGroup,publicLinkEnabled,publicLink,publicLinkLimit,createdDate`)
  if (groups.error) console.log('  groups error', groups.error, groups.detail)
  else for (const g of groups.data || []) {
    const a = g.attributes
    console.log(`  [${g.id}] "${a.name}"  internal=${a.isInternalGroup}  publicLink=${a.publicLinkEnabled ? a.publicLink : 'disabled'}`)
  }

  console.log('\n=== AVERY TESTER RECORD ===')
  const t = await api(`/v1/betaTesters?filter[email]=${encodeURIComponent(AVERY)}&include=betaGroups,builds&limit=10&fields[betaTesters]=firstName,lastName,email,inviteType,state&fields[betaGroups]=name,isInternalGroup&fields[builds]=version`)
  if (t.error) { console.log('  tester error', t.error, t.detail) }
  else if (!(t.data || []).length) { console.log('  NOT FOUND — avery@tntcyber.com is NOT a beta tester on any app for this key') }
  else {
    const binc = {}
    for (const i of t.included || []) binc[`${i.type}:${i.id}`] = i
    for (const rec of t.data) {
      const a = rec.attributes
      console.log(`  ${a.firstName || ''} ${a.lastName || ''} <${a.email}>  state=${a.state}  invite=${a.inviteType}`)
      const gs = (rec.relationships?.betaGroups?.data || []).map(g => binc[`betaGroups:${g.id}`]?.attributes).filter(Boolean)
      console.log('    groups:', gs.length ? gs.map(g => `${g.name}${g.isInternalGroup ? '(internal)' : '(external)'}`).join(', ') : '(none)')
      const bs = (rec.relationships?.builds?.data || []).map(b => binc[`builds:${b.id}`]?.attributes?.version).filter(Boolean)
      console.log('    individually-assigned builds:', bs.length ? bs.join(', ') : '(none)')
    }
  }
} catch (e) {
  console.log('SCRIPT ERROR:', e.message)
}
