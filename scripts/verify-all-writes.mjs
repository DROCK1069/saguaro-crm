import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(fs.readFileSync('D:/saguaro-mobile/.env', 'utf8').split('\n')
  .map(l => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map(m => [m[1], m[2]]))
const supa = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY)
const API = 'https://www.saguarocontrol.net/api'
const { data: s } = await supa.auth.signInWithPassword({ email: 'tntcybersolutions@gmail.com', password: 'Saltlife69!' })
const hdr = { Authorization: `Bearer ${s.session.access_token}`, 'Content-Type': 'application/json' }
const PID = '11111111-1111-1111-1111-111111111104'
const post = async (path, body) => { const r = await fetch(`${API}${path}`, { method: 'POST', headers: hdr, body: JSON.stringify(body) }); const t = await r.text(); let j = {}; try { j = JSON.parse(t) } catch {} return { status: r.status, j, t } }
const cleanup = []  // [table, id]
const rows = []

// each: [label, post-result-promise-fn, table, idPath, checkSql(id)->expected]
const tests = [
  ['punch create (trade+assignee)', () => post('/punch-list/create', { project_id: PID, title: 'ZZTEST punch', description: 'd', location: 'L1', trade: 'Electrical', priority: 'high', assigned_to: 'Sunstate', due_date: '2026-05-01', notes: 'n' }), 'punch_list', j => j.item?.id ?? j.punchItem?.id ?? j.data?.id, 'trade,priority,assigned_to'],
  ['schedule create (trade+pct)', () => post('/schedule/create', { project_id: PID, name: 'ZZTEST task', start_date: '2026-04-01', end_date: '2026-04-10', phase: 'Framing', trade: 'Plumbing', percent_complete: 25 }), 'schedule_tasks', j => j.task?.id ?? j.data?.id, 'trade,pct_complete'],
  ['change-order create (amount)', () => post('/change-orders/create', { project_id: PID, title: 'ZZTEST CO', description: 'd', amount: 12345, cost_impact: 12345, schedule_impact_days: 3 }), 'change_orders', j => j.changeOrder?.id ?? j.data?.id, 'amount,schedule_impact_days'],
  ['pay-app create (period+work)', () => post('/pay-apps/create', { project_id: PID, period_to: '2026-04-30', work_completed: 50000 }), 'pay_applications', j => j.payApp?.id ?? j.data?.id, 'period_to,work_completed'],
  ['inspection create (type+result)', () => post('/inspections/create', { project_id: PID, inspection_type: 'Framing', inspector_name: 'ZZTEST insp', result: 'passed', scheduled_date: '2026-04-15' }), 'inspections', j => j.inspection?.id ?? j.data?.id, 'inspection_type,result'],
  ['safety incident create', () => post('/safety/incidents', { project_id: PID, description: 'ZZTEST incident', severity: 'high', incident_type: 'injury', location: 'L', incident_date: '2026-04-01' }), 'safety_incidents', j => j.incident?.id ?? j.data?.id, 'severity,incident_type'],
  ['rfi create (full)', () => post('/rfis/create', { project_id: PID, subject: 'ZZTEST rfi', question: 'q?', priority: 'high', due_date: '2026-05-01', spec_section: '09 91 00' }), 'rfis', j => j.rfi?.id ?? j.data?.id, 'priority,spec_section'],
]

for (const [label, fn, table, idGet, cols] of tests) {
  try {
    const { status, j, t } = await fn()
    const id = idGet(j)
    let dbOk = 'n/a'
    if (id) {
      cleanup.push([table, id])
      const { data } = await supa.from(table).select(cols).eq('id', id).maybeSingle()
      dbOk = data ? JSON.stringify(data) : 'ROW NOT FOUND'
    }
    rows.push(`${status === 200 || status === 201 ? 'PASS' : 'FAIL'} [${status}] ${label} | id=${id ? 'yes' : 'NO'} | db=${dbOk}${status >= 400 ? ' | ' + t.slice(0, 90) : ''}`)
  } catch (e) { rows.push(`ERR  ${label} | ${e.message.slice(0, 80)}`) }
}
console.log('=== WRITE TESTS ===')
rows.forEach(r => console.log(r))
// cleanup
for (const [table, id] of cleanup) await supa.from(table).delete().eq('id', id)
console.log(`\ncleaned up ${cleanup.length} test rows`)
