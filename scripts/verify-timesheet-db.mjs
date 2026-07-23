import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(fs.readFileSync('D:/saguaro-mobile/.env', 'utf8').split('\n')
  .map(l => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map(m => [m[1], m[2]]))
const supa = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY)
const API = 'https://www.saguarocontrol.net/api'
const { data: s } = await supa.auth.signInWithPassword({ email: 'tntcybersolutions@gmail.com', password: 'Saltlife69!' })
const hdr = { Authorization: `Bearer ${s.session.access_token}`, 'Content-Type': 'application/json' }
const PID = '11111111-1111-1111-1111-111111111104'

// CLOCK IN — exact payload the field app sends
const clockIn = new Date().toISOString()
const r1 = await fetch(`${API}/timesheets/create`, { method: 'POST', headers: hdr, body: JSON.stringify({ project_id: PID, clock_in: clockIn, gps_clock_in: '33.4484,-112.0740' }) })
const j1 = await r1.json().catch(() => ({}))
const eid = j1?.entry?.id
console.log('clock-in POST ->', r1.status, '| entry id:', eid || '(none)')

// CLOCK OUT — PATCH status (the part that was hitting the wrong table)
let r2status = 'n/a'
if (eid) {
  const r2 = await fetch(`${API}/timesheets/${eid}/status`, { method: 'PATCH', headers: hdr, body: JSON.stringify({ status: 'submitted' }) })
  r2status = r2.status
  console.log('clock-out PATCH ->', r2.status)
}
fs.writeFileSync('C:/Users/Public/saguaro-deploy/_verify_eid.txt', eid || '')
console.log('DONE eid=' + (eid || '') + ' patch=' + r2status)
