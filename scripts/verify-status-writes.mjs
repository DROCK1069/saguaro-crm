import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(fs.readFileSync('D:/saguaro-mobile/.env', 'utf8').split('\n')
  .map(l => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map(m => [m[1], m[2]]))
const supa = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY)
const API = 'https://www.saguarocontrol.net/api'
const { data: s } = await supa.auth.signInWithPassword({ email: 'tntcybersolutions@gmail.com', password: 'Saltlife69!' })
const hdr = { Authorization: `Bearer ${s.session.access_token}`, 'Content-Type': 'application/json' }
const PID = '11111111-1111-1111-1111-111111111104'
const call = async (m, p, b) => { const r = await fetch(`${API}${p}`, { method: m, headers: hdr, body: b ? JSON.stringify(b) : undefined }); let j = {}; try { j = JSON.parse(await r.text()) } catch {}; return { status: r.status, j } }
const dbstatus = async (table, id) => { const { data } = await supa.from(table).select('status').eq('id', id).maybeSingle(); return data ? data.status : '__GONE__' }
const out = []

// Pay-app status chain
{
  const c = await call('POST', '/pay-apps/create', { project_id: PID, period_to: '2026-04-30', work_completed: 1000 })
  const id = c.j.payApp?.id
  if (id) {
    const steps = []
    for (const [act, want] of [['submit', 'submitted'], ['certify', 'certified'], ['approve', 'approved'], ['paid', 'paid']]) {
      const r = await call('POST', `/pay-apps/${id}/${act}`)
      const st = await dbstatus('pay_applications', id)
      steps.push(`${act}[${r.status}]->${st}${st === want ? '✓' : '✗(want ' + want + ')'}`)
    }
    out.push(`Pay-app chain: ${steps.join(' ')}`)
    await supa.from('pay_applications').delete().eq('id', id)
  } else out.push(`Pay-app create failed [${c.status}]`)
}
// Change order approve
{
  const c = await call('POST', '/change-orders/create', { project_id: PID, title: 'ZZCO approve', amount: 500 })
  const id = c.j.changeOrder?.id ?? c.j.data?.id
  if (id) { const r = await call('POST', `/change-orders/${id}/approve`); const st = await dbstatus('change_orders', id); out.push(`CO approve[${r.status}]->${st}${st === 'approved' ? '✓' : '✗'}`); await supa.from('change_orders').delete().eq('id', id) }
  else out.push(`CO create failed [${c.status}]`)
}
// Change order reject
{
  const c = await call('POST', '/change-orders/create', { project_id: PID, title: 'ZZCO reject', amount: 500 })
  const id = c.j.changeOrder?.id ?? c.j.data?.id
  if (id) { const r = await call('PUT', `/change-orders/${id}/reject`, { reason: 'test' }); const st = await dbstatus('change_orders', id); out.push(`CO reject[${r.status}]->${st}${st === 'rejected' ? '✓' : '✗'}`); await supa.from('change_orders').delete().eq('id', id) }
  else out.push(`CO create failed [${c.status}]`)
}
console.log('=== STATUS WRITES ===')
out.forEach(r => console.log(r))
