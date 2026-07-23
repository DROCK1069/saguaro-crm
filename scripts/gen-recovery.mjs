import fs from 'node:fs'
// Read service-role creds from the pulled Vercel env (never printed).
const env = Object.fromEntries(fs.readFileSync('.env.vercel.tmp', 'utf8').split('\n')
  .map(l => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean)
  .map(m => [m[1], m[2].replace(/^"|"$/g, '')]))
const URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY
const EMAIL = 'tntcybersolutions@gmail.com'
const REDIRECT = 'https://www.saguarocontrol.net/reset-password'

const r = await fetch(`${URL}/auth/v1/admin/generate_link`, {
  method: 'POST',
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'recovery', email: EMAIL, redirect_to: REDIRECT }),
})
const j = await r.json()
if (!r.ok) { console.log('ERROR', r.status, JSON.stringify(j).slice(0, 400)); process.exit(1) }
const link = j.action_link || j.properties?.action_link
console.log('RECOVERY_LINK:')
console.log(link)
