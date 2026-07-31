import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(fs.readFileSync('D:/saguaro-mobile/.env', 'utf8').split('\n').map(l => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map(m => [m[1], m[2]]))
const supa = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY)
const API = 'https://www.saguarocontrol.net/api'
const { data: s } = await supa.auth.signInWithPassword({ email: 'tntcybersolutions@gmail.com', password: 'Saltlife69!' })
const hdr = { Authorization: `Bearer ${s.session.access_token}`, 'Content-Type': 'application/json' }
const PID = '11111111-1111-1111-1111-111111111104'
const call = async (m, p, b) => { const r = await fetch(`${API}${p}`, { method: m, headers: hdr, body: b ? JSON.stringify(b) : undefined }); let j = {}; try { j = JSON.parse(await r.text()) } catch {}; return { status: r.status, j } }
const dbg = async (t, id, c) => { const { data } = await supa.from(t).select(c).eq('id', id).maybeSingle(); return data ? data[c] : '__GONE__' }
const out = []

// Toolbox talk CRUD
{
  const c = await call('POST', '/safety/talks', { project_id: PID, topic: 'ZZTALK', presenter: 'P', talk_date: '2026-04-01' })
  const id = c.j.talk?.id ?? c.j.data?.id ?? c.j.id
  if (id) {
    const u = await call('PATCH', `/safety/talks/${id}`, { topic: 'ZZTALK EDITED' })
    const after = await dbg('toolbox_talks', id, 'topic')
    const d = await call('DELETE', `/safety/talks/${id}`)
    const gone = (await dbg('toolbox_talks', id, 'id')) === '__GONE__'
    out.push(`Toolbox talk: create[${c.status}] edit[${u.status}]->${after} delete[${d.status}]->${gone ? 'gone' : 'STILL'}`)
  } else out.push(`Toolbox talk create [${c.status}] no id`)
}
// Milestone CRUD
{
  const c = await call('POST', '/schedule/milestones', { project_id: PID, title: 'ZZMILE', date: '2026-05-01' })
  const id = c.j.milestone?.id ?? c.j.data?.id ?? c.j.id
  if (id) {
    const u = await call('PUT', `/schedule/milestone/${id}`, { title: 'ZZMILE EDITED' })
    const after = await dbg('schedule_milestones', id, 'title')
    const d = await call('DELETE', `/schedule/milestone/${id}`)
    const gone = (await dbg('schedule_milestones', id, 'id')) === '__GONE__'
    out.push(`Milestone: create[${c.status}] edit[${u.status}]->${after} delete[${d.status}]->${gone ? 'gone' : 'STILL'}`)
  } else out.push(`Milestone create [${c.status}] no id`)
}
// Pay-app edit
{
  const c = await call('POST', '/pay-apps/create', { project_id: PID, period_to: '2026-04-30', work_completed: 100 })
  const id = c.j.payApp?.id
  if (id) { const u = await call('PUT', `/pay-apps/${id}`, { status: 'submitted' }); const after = await dbg('pay_applications', id, 'status'); out.push(`Pay-app edit: create[${c.status}] edit[${u.status}]->status=${after}`); await supa.from('pay_applications').delete().eq('id', id) }
  else out.push(`Pay-app create [${c.status}]`)
}
// CO edit
{
  const c = await call('POST', '/change-orders/create', { project_id: PID, title: 'ZZCO edit', amount: 100 })
  const id = c.j.changeOrder?.id ?? c.j.data?.id
  if (id) { const u = await call('PATCH', `/change-orders/${id}/update`, { title: 'ZZCO EDITED' }); const after = await dbg('change_orders', id, 'title'); out.push(`CO edit: create[${c.status}] edit[${u.status}]->${after}`); await supa.from('change_orders').delete().eq('id', id) }
  else out.push(`CO create [${c.status}]`)
}
console.log('=== WAVE 4 WRITES ==='); out.forEach(r => console.log(r))
