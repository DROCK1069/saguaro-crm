import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// public anon creds (same ones shipped in the app bundle)
const env = Object.fromEntries(fs.readFileSync('D:/saguaro-mobile/.env', 'utf8').split('\n')
  .map(l => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map(m => [m[1], m[2]]))
const URL = env.EXPO_PUBLIC_SUPABASE_URL, ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY
const API = 'https://www.saguarocontrol.net/api'
const supa = createClient(URL, ANON)
const { data: s, error: se } = await supa.auth.signInWithPassword({ email: 'tntcybersolutions@gmail.com', password: 'Saltlife69!' })
if (se) { console.log('AUTH FAIL', se.message); process.exit(1) }
const token = s.session.access_token
const hdr = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

// EXACT payload the mobile Create Project form sends (snake_case)
const payload = { name: 'ZZWIRECHECK Tower', address: '123 Verify Ave, Phoenix, AZ', project_type: 'industrial', status: 'precon', contract_value: 7654321, start_date: '2026-03-15' }
const res = await fetch(`${API}/projects/create`, { method: 'POST', headers: hdr, body: JSON.stringify(payload) })
const txt = await res.text()
console.log('POST /projects/create ->', res.status)
let body = {}; try { body = JSON.parse(txt) } catch {}
const id = body?.project?.id || body?.projectId
console.log('created id:', id || '(none)', '| resp:', txt.slice(0, 160))
fs.writeFileSync('C:/Users/Public/saguaro-deploy/_verify_pid.txt', id || '')
