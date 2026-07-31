import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(fs.readFileSync('D:/saguaro-mobile/.env', 'utf8').split('\n')
  .map(l => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map(m => [m[1], m[2]]))
const supa = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY)
const API = 'https://www.saguarocontrol.net/api'
const { data: s } = await supa.auth.signInWithPassword({ email: 'tntcybersolutions@gmail.com', password: 'Saltlife69!' })
const hdr = { Authorization: `Bearer ${s.session.access_token}`, 'Content-Type': 'application/json' }
const PID = '11111111-1111-1111-1111-111111111104'
const call = async (m, path, body) => { const r = await fetch(`${API}${path}`, { method: m, headers: hdr, body: body ? JSON.stringify(body) : undefined }); const t = await r.text(); let j = {}; try { j = JSON.parse(t) } catch {}; return { status: r.status, j, t } }
const out = []
const dbget = async (table, id, col) => { const { data } = await supa.from(table).select(col).eq('id', id).maybeSingle(); return data ? data[col] : '__GONE__' }

async function cycle(label, table, createPath, createBody, idGet, updatePath, updateBody, updField, updExpect, delPath) {
  try {
    const c = await call('POST', createPath, createBody)
    const id = idGet(c.j)
    if (!id) { out.push(`FAIL ${label} CREATE [${c.status}] no id | ${c.t.slice(0, 70)}`); return }
    const u = await call('PUT', updatePath(id), updateBody); const um = u.status >= 400 ? await call('PATCH', updatePath(id), updateBody) : u
    const after = await dbget(table, id, updField)
    const updOk = String(after) === String(updExpect)
    const d = await call('DELETE', delPath(id))
    const gone = (await dbget(table, id, 'id')) === '__GONE__'
    out.push(`${updOk && gone ? 'PASS' : 'PARTIAL'} ${label} | create[${c.status}] update[${um.status}]->${updField}=${after}(want ${updExpect}) delete[${d.status}]->${gone ? 'gone' : 'STILL THERE'}`)
  } catch (e) { out.push(`ERR ${label} | ${e.message.slice(0, 70)}`) }
}

await cycle('RFI', 'rfis',
  '/rfis/create', { project_id: PID, subject: 'ZZUPD rfi', question: 'q' }, j => j.rfi?.id,
  id => `/rfis/${id}`, { subject: 'ZZUPD rfi EDITED', priority: 'critical' }, 'priority', 'critical',
  id => `/rfis/${id}`)
await cycle('Punch', 'punch_list',
  '/punch-list/create', { project_id: PID, title: 'ZZUPD punch', priority: 'low' }, j => j.item?.id,
  id => `/punch-list/${id}`, { priority: 'high', location: 'EDITED' }, 'priority', 'high',
  id => `/punch-list/${id}`)
await cycle('Schedule', 'schedule_tasks',
  '/schedule/create', { project_id: PID, name: 'ZZUPD task' }, j => j.task?.id,
  id => `/schedule/${id}`, { name: 'ZZUPD task EDITED', percent_complete: 80 }, 'pct_complete', '80',
  id => `/schedule/${id}`)
await cycle('Safety', 'safety_incidents',
  '/safety/incidents', { project_id: PID, description: 'ZZUPD inc', severity: 'low' }, j => j.incident?.id,
  id => `/safety/incidents/${id}`, { severity: 'critical' }, 'severity', 'critical',
  id => `/safety/incidents/${id}`)
await cycle('Inspection', 'inspections',
  '/inspections/create', { project_id: PID, inspection_type: 'Framing', result: 'pending' }, j => j.inspection?.id,
  id => `/inspections/${id}`, { result: 'passed' }, 'result', 'passed',
  id => `/inspections/${id}`)

console.log('=== UPDATE/DELETE CYCLES ===')
out.forEach(r => console.log(r))
