/* SAGUARO ROUTING PROOF — proves the crew-routing wave against the LIVE stack:
 * work_assignments lifecycle (unique tuple, end, reactivate), my-work matching
 * semantics across all five assignment sources (todo token match, RFI email,
 * punch in both tables, field-issue uuid) with done-row exclusion, T&M ticket
 * draft->submitted->approved->billed ladder with cent-exact money math, crew
 * roster archive counts, and the daily-log prefill sources (two-system
 * clocked-in headcount union + manpower-by-trade rollup). Fixture fully
 * cleaned up. Run: npx tsx scripts/proof-routing.ts */
import { createClient } from '@supabase/supabase-js';
import * as fs from 'node:fs';

const env = fs.readFileSync('D:/saguaro-web/.env.local', 'utf8');
const get = (k: string) => (env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim();
const db = createClient(get('NEXT_PUBLIC_SUPABASE_URL')!, get('SUPABASE_SERVICE_ROLE_KEY')!);

const MARK = 'CLAUDE-PROOF-' + Math.floor(Math.random() * 1e6);
let pass = 0, fail = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} — ${detail}`);
  ok ? pass++ : fail++;
};

// tables that hang off the fixture project, children-before-parents order
const PROJECT_CHILD_TABLES = [
  'crew_members_via_crews', // placeholder handled explicitly (no project_id on crew_members)
  'crews', 'work_assignments', 'project_todos', 'rfis', 'punch_list',
  'punch_list_items', 'field_issues', 'tm_tickets', 'time_entries', 'timesheet_entries',
];

async function purgeProjects(ids: string[]) {
  const { data: crews } = await db.from('crews').select('id').in('project_id', ids);
  if (crews?.length) await db.from('crew_members').delete().in('crew_id', crews.map((c: any) => c.id));
  for (const t of PROJECT_CHILD_TABLES) {
    if (t === 'crew_members_via_crews') continue;
    await db.from(t).delete().in('project_id', ids);
  }
  await db.from('projects').delete().in('id', ids);
}

async function main() {
  // ── stranded-fixture purge (a previous crashed run must not poison checks) ──
  const { data: staleP } = await db.from('projects').select('id').like('name', 'CLAUDE-PROOF%');
  if (staleP?.length) await purgeProjects(staleP.map((p: any) => p.id));
  const { data: staleE } = await db.from('employees').select('id').like('first_name', 'CLAUDE-PROOF%');
  if (staleE?.length) {
    // time_entries.employee_id FK blocks employee delete — children first
    await db.from('time_entries').delete().in('employee_id', staleE.map((e: any) => e.id));
    await db.from('employees').delete().in('id', staleE.map((e: any) => e.id));
  }

  // tenant must exist in tenants AND auth.users (legacy FK: rfis/punch_list
  // tenant_id references auth.users) — any live project's tenant satisfies both
  const { data: anyProject } = await db.from('projects').select('tenant_id').limit(1).single();
  const tenantId = (anyProject as any).tenant_id;
  const { data: proj } = await db.from('projects').insert({ tenant_id: tenantId, name: MARK + ' project', status: 'active' } as never).select().single();
  const projectId = (proj as any).id;

  // ── W1: work_assignments — unique tuple, duplicate rejected, end, reactivate ──
  const assigneeId = '00000000-0000-4000-8000-00000000d001';
  const mkAssign = () => db.from('work_assignments').insert({
    tenant_id: tenantId, project_id: projectId, assignee_user_id: assigneeId,
    assignee_name: MARK + ' Foreman', role: 'foreman', scope: 'east wing',
    status: 'active', assigned_by_name: MARK + ' PM',
  } as never).select().maybeSingle();
  const first = await mkAssign();
  const second = await mkAssign();
  const { data: waRows } = await db.from('work_assignments').select('id, status').eq('project_id', projectId);
  check('W1a: assignment insert + duplicate tuple rejected by unique constraint',
    !!(first as any).data && !!(second as any).error && ((second as any).error.code === '23505') && (waRows || []).length === 1,
    `${(waRows || []).length} row(s); dup error code ${(second as any).error?.code}`);
  const waId = ((first as any).data as any).id;
  await db.from('work_assignments').update({ status: 'ended', ended_at: new Date().toISOString() } as never).eq('id', waId);
  const { data: ended } = await db.from('work_assignments').select('status, ended_at').eq('id', waId).single();
  check('W1b: assignment ends (status ended + ended_at stamp)',
    (ended as any)?.status === 'ended' && !!(ended as any)?.ended_at,
    `status ${(ended as any)?.status}, ended_at ${(ended as any)?.ended_at ? 'set' : 'MISSING'}`);
  // reactivate = flip the SAME row back (unique tuple means no second insert path)
  await db.from('work_assignments').update({ status: 'active', ended_at: null } as never).eq('id', waId);
  const { data: react } = await db.from('work_assignments').select('status, ended_at').eq('id', waId).single();
  check('W1c: reactivate same row (active again, ended_at cleared)',
    (react as any)?.status === 'active' && (react as any)?.ended_at === null,
    `status ${(react as any)?.status}, ended_at ${(react as any)?.ended_at}`);

  // ── W2: my-work matching semantics across all five assignment sources ──
  // These queries replicate app/api/my-work/route.ts filter-for-filter:
  // uid/email token eq-match (assigned_to columns are TEXT holding uuid OR
  // email), open-status allowlists, closed-status denylists.
  const email = `claude-proof-${Math.floor(Math.random() * 1e6)}@proof.local`;
  const workerUuid = '00000000-0000-4000-8000-00000000c001';
  const { data: todo } = await db.from('project_todos').insert({ tenant_id: tenantId, project_id: projectId, title: MARK + ' todo', assigned_to: email, status: 'pending' } as never).select().single();
  const { data: rfi } = await db.from('rfis').insert({ tenant_id: tenantId, project_id: projectId, subject: MARK + ' rfi', question: 'Routing proof question', assigned_to_email: email, status: 'open' } as never).select().single();
  const { data: punch } = await db.from('punch_list').insert({ tenant_id: tenantId, project_id: projectId, title: MARK + ' punch', assigned_to: email, status: 'open' } as never).select().single();
  const { data: punchItem } = await db.from('punch_list_items').insert({ tenant_id: tenantId, project_id: projectId, title: MARK + ' punch item', assigned_to: workerUuid, status: 'open' } as never).select().single();
  const { data: issue } = await db.from('field_issues').insert({ tenant_id: tenantId, project_id: projectId, title: MARK + ' issue', assigned_to: workerUuid, status: 'open' } as never).select().single();

  const findTodos = () => db.from('project_todos').select('id').eq('project_id', projectId)
    .or(`assigned_to.eq.${workerUuid},assigned_to.eq.${email},assigned_to_id.eq.${workerUuid},assigned_to_id.eq.${email}`)
    .or('status.is.null,status.not.in.(done,complete,completed)');
  const findRfis = () => db.from('rfis').select('id').eq('project_id', projectId)
    .or(`assigned_to.eq.${workerUuid},assigned_to.eq.${email},assigned_to_email.eq.${email}`)
    .in('status', ['open', 'submitted', 'under_review', 'pending', 'draft']);
  const findPunch = () => db.from('punch_list').select('id').eq('project_id', projectId)
    .in('assigned_to', [workerUuid, email])
    .not('status', 'in', '(closed,complete,completed)');
  const findPunchItems = () => db.from('punch_list_items').select('id').eq('project_id', projectId)
    .eq('assigned_to', workerUuid)
    .in('status', ['open', 'in_progress', 'ready_for_review']);
  const findIssues = () => db.from('field_issues').select('id').eq('project_id', projectId)
    .eq('assigned_to', workerUuid)
    .in('status', ['open', 'in_progress']);

  const [fTodo, fRfi, fPunch, fPunchItem, fIssue] = await Promise.all([findTodos(), findRfis(), findPunch(), findPunchItems(), findIssues()]);
  check('W2a: todo found by assignee token eq-match (email in TEXT column)',
    ((fTodo as any).data || []).length === 1 && ((fTodo as any).data || [])[0]?.id === (todo as any).id, `${((fTodo as any).data || []).length} todo`);
  check('W2b: RFI found by assigned_to_email',
    ((fRfi as any).data || []).length === 1 && ((fRfi as any).data || [])[0]?.id === (rfi as any).id, `${((fRfi as any).data || []).length} rfi`);
  check('W2c: punch found in BOTH tables (punch_list email + punch_list_items uuid)',
    ((fPunch as any).data || []).length === 1 && ((fPunch as any).data || [])[0]?.id === (punch as any).id
      && ((fPunchItem as any).data || []).length === 1 && ((fPunchItem as any).data || [])[0]?.id === (punchItem as any).id,
    `${((fPunch as any).data || []).length} punch_list, ${((fPunchItem as any).data || []).length} punch_list_items`);
  check('W2d: field issue found by assignee uuid',
    ((fIssue as any).data || []).length === 1 && ((fIssue as any).data || [])[0]?.id === (issue as any).id, `${((fIssue as any).data || []).length} issue`);

  // done rows must drop out of my-work: flip the todo to completed and re-check
  await db.from('project_todos').update({ status: 'completed', completed_at: new Date().toISOString() } as never).eq('id', (todo as any).id);
  const { data: doneTodos } = await findTodos();
  check('W2e: completed todo excluded by the same filter', (doneTodos || []).length === 0, `${(doneTodos || []).length} todo after completion`);

  // ── W3: tm_tickets lifecycle + totals ladder to the cent ──
  const labor = [{ name: 'Foreman', hours: 6, rate: 85 }, { name: 'Laborer', hours: 8, rate: 45 }];
  const materials = [{ description: 'Conduit', qty: 40, unit_cost: 3.25, total: 130 }, { description: 'Fittings', qty: 12, unit_cost: 5.5, total: 66 }];
  const equipment = [{ description: 'Scissor lift', hours: 4, rate: 60, total: 240 }];
  const laborTotal = 870, materialsTotal = 196, equipmentTotal = 240, markupPct = 15, taxPct = 8.6;
  const expectedTotal = Math.round((laborTotal + materialsTotal + equipmentTotal) * (1 + markupPct / 100) * (1 + taxPct / 100) * 100) / 100;
  const { data: ticket, error: tErr } = await db.from('tm_tickets').insert({
    tenant_id: tenantId, project_id: projectId, ticket_number: MARK + '-TM-1', description: MARK + ' extra work',
    work_date: new Date().toISOString().split('T')[0],
    labor, materials, equipment,
    labor_total: laborTotal, materials_total: materialsTotal, equipment_total: equipmentTotal,
    markup_pct: markupPct, tax_pct: taxPct, total: expectedTotal, status: 'draft',
  } as never).select().single();
  check('W3a: T&M draft with labor/materials/equipment jsonb', !tErr && (ticket as any)?.status === 'draft' && Array.isArray((ticket as any)?.labor) && (ticket as any).labor.length === 2, tErr ? tErr.message : `draft, ${(ticket as any)?.labor?.length} labor lines`);
  const tmId = (ticket as any).id;
  await db.from('tm_tickets').update({ status: 'submitted' } as never).eq('id', tmId);
  await db.from('tm_tickets').update({ status: 'approved', approved_by: MARK + ' PM', approved_at: new Date().toISOString() } as never).eq('id', tmId);
  await db.from('tm_tickets').update({ status: 'billed' } as never).eq('id', tmId);
  const { data: billed } = await db.from('tm_tickets').select('status, approved_by, approved_at, labor_total, materials_total, equipment_total, markup_pct, tax_pct, total').eq('id', tmId).single();
  check('W3b: draft -> submitted -> approved (stamped) -> billed',
    (billed as any)?.status === 'billed' && (billed as any)?.approved_by === MARK + ' PM' && !!(billed as any)?.approved_at,
    `status ${(billed as any)?.status}, approved_by ${(billed as any)?.approved_by ? 'set' : 'MISSING'}`);
  // money columns can come back as strings — Number() before math, always
  const b = billed as any;
  const nums = [b.labor_total, b.materials_total, b.equipment_total, b.markup_pct, b.tax_pct, b.total].map((v) => Number(v));
  const ladder = Math.round((nums[0] + nums[1] + nums[2]) * (1 + nums[3] / 100) * (1 + nums[4] / 100) * 100) / 100;
  check('W3c: Number() money read-back + totals ladder recomputes to the cent',
    nums.every((n) => Number.isFinite(n)) && Math.abs(ladder - nums[5]) <= 0.01 && Math.abs(nums[5] - expectedTotal) <= 0.01,
    `(870+196+240) * 1.15 * 1.086 = ${ladder} vs stored ${nums[5]}`);

  // ── W4: crews roster — member count, archive drops the count ──
  const { data: crewA } = await db.from('crews').insert({ tenant_id: tenantId, project_id: projectId, name: MARK + ' crew A', trade: 'Electrical', status: 'active' } as never).select().single();
  const crewAId = (crewA as any).id;
  await db.from('crew_members').insert([
    { tenant_id: tenantId, crew_id: crewAId, person_name: MARK + ' M1', trade: 'Electrical' },
    { tenant_id: tenantId, crew_id: crewAId, person_name: MARK + ' M2', trade: 'Electrical' },
  ] as never);
  const activeCount = async (crewId: string) => (((await db.from('crew_members').select('id').eq('crew_id', crewId).is('deleted_at', null)) as any).data || []).length;
  const before = await activeCount(crewAId);
  const { data: m2 } = await db.from('crew_members').select('id').eq('crew_id', crewAId).eq('person_name', MARK + ' M2').single();
  // archive = soft delete (deleted_at), never a hard row delete
  await db.from('crew_members').update({ deleted_at: new Date().toISOString() } as never).eq('id', (m2 as any).id);
  const after = await activeCount(crewAId);
  check('W4: crew of 2 -> archive member -> active count drops to 1', before === 2 && after === 1, `count ${before} -> ${after}`);

  // ── W5: daily prefill sources — headcount union + manpower by trade ──
  const today = new Date().toISOString().split('T')[0];
  const nowISO = new Date().toISOString();
  // time_entries.employee_id has a hard FK to employees — fixture employee required
  const { data: emp } = await db.from('employees').insert({ tenant_id: tenantId, first_name: MARK, last_name: 'Employee', trade: 'Electrical', is_active: true } as never).select().single();
  const empId = (emp as any).id;
  const { error: teErr } = await db.from('time_entries').insert({ tenant_id: tenantId, project_id: projectId, employee_id: empId, work_date: today, clock_in: nowISO, status: 'clocked_in' } as never);
  check('W5a: time_entries open shift (status clocked_in) inserts', !teErr, teErr ? teErr.message : 'open shift row');
  // web clock system stores clock events as timesheet_entries with JSON notes;
  // two rows for the same person prove the union is DISTINCT, not row-count
  const tsName = MARK + ' TS Worker';
  await db.from('timesheet_entries').insert([
    { tenant_id: tenantId, project_id: projectId, employee_name: tsName, work_date: today, clock_in: nowISO, notes: JSON.stringify({ type: 'clock_in', clock_in_time: nowISO }), status: 'pending' },
    { tenant_id: tenantId, project_id: projectId, employee_name: tsName, work_date: today, clock_in: nowISO, notes: JSON.stringify({ type: 'clock_in', clock_in_time: nowISO }), status: 'pending' },
  ] as never);
  // two-system headcount union, exactly as the prefill aggregates it
  const { data: teOpen } = await db.from('time_entries').select('employee_id').eq('project_id', projectId).eq('work_date', today).eq('status', 'clocked_in');
  const teEmpIds = [...new Set(((teOpen || []) as any[]).map((r) => r.employee_id))];
  const { data: teEmps } = await db.from('employees').select('id, first_name, last_name').in('id', teEmpIds.length ? teEmpIds : ['00000000-0000-4000-8000-000000000000']);
  const people = new Set<string>();
  for (const e of (teEmps || []) as any[]) people.add(`${e.first_name} ${e.last_name}`.trim().toLowerCase());
  const { data: tsRows } = await db.from('timesheet_entries').select('employee_name, notes').eq('project_id', projectId).eq('work_date', today);
  for (const r of (tsRows || []) as any[]) {
    let parsed: any = null;
    try { parsed = JSON.parse(r.notes || ''); } catch { /* non-clock timesheet rows carry free-text notes */ }
    if (parsed?.type === 'clock_in') people.add(String(r.employee_name).trim().toLowerCase());
  }
  check('W5b: two-system headcount union counts 2 distinct people (3 rows)',
    people.size === 2 && (tsRows || []).length === 2, `${people.size} people from ${1 + (tsRows || []).length} clock rows`);

  // manpower by trade across the project's crews (archived members excluded)
  const { data: crewB } = await db.from('crews').insert({ tenant_id: tenantId, project_id: projectId, name: MARK + ' crew B', trade: 'Plumbing', status: 'active' } as never).select().single();
  const crewBId = (crewB as any).id;
  await db.from('crew_members').insert([
    { tenant_id: tenantId, crew_id: crewBId, person_name: MARK + ' M3', trade: 'Electrical' },
    { tenant_id: tenantId, crew_id: crewBId, person_name: MARK + ' M4', trade: 'Electrical' },
    { tenant_id: tenantId, crew_id: crewBId, person_name: MARK + ' M5', trade: 'Plumbing' },
  ] as never);
  const { data: projCrews } = await db.from('crews').select('id').eq('project_id', projectId).is('deleted_at', null);
  const crewIds = ((projCrews || []) as any[]).map((c) => c.id);
  const { data: members } = await db.from('crew_members').select('trade').in('crew_id', crewIds).is('deleted_at', null);
  const byTrade: Record<string, number> = {};
  for (const m of (members || []) as any[]) { const t = m.trade || 'General'; byTrade[t] = (byTrade[t] || 0) + 1; }
  const manpower = Object.entries(byTrade).map(([trade, count]) => ({ trade, count })).sort((a, b) => a.trade.localeCompare(b.trade));
  // crew A: M1 active (M2 archived in W4) + crew B: M3, M4 electrical, M5 plumbing
  check('W5c: manpower-by-trade rollup [{trade,count}] matches (archived excluded)',
    JSON.stringify(manpower) === JSON.stringify([{ trade: 'Electrical', count: 3 }, { trade: 'Plumbing', count: 1 }]),
    JSON.stringify(manpower));

  // ── Z: cleanup — children before parents, then verify zero remain ──
  await db.from('crew_members').delete().in('crew_id', [crewAId, crewBId]);
  await db.from('crews').delete().in('id', [crewAId, crewBId]);
  await db.from('time_entries').delete().eq('project_id', projectId);
  await db.from('timesheet_entries').delete().eq('project_id', projectId);
  await db.from('employees').delete().eq('id', empId);
  for (const t of ['work_assignments', 'project_todos', 'rfis', 'punch_list', 'punch_list_items', 'field_issues', 'tm_tickets']) {
    await db.from(t).delete().eq('project_id', projectId);
  }
  await db.from('projects').delete().eq('id', projectId);

  let leftovers = 0;
  for (const t of ['work_assignments', 'project_todos', 'rfis', 'punch_list', 'punch_list_items', 'field_issues', 'tm_tickets', 'time_entries', 'timesheet_entries', 'crews']) {
    const { data: left } = await db.from(t).select('id').eq('project_id', projectId);
    leftovers += (left || []).length;
  }
  const { data: leftProj } = await db.from('projects').select('id').eq('id', projectId);
  const { data: leftEmp } = await db.from('employees').select('id').eq('id', empId);
  const { data: leftCm } = await db.from('crew_members').select('id').in('crew_id', [crewAId, crewBId]);
  check('Z: fixture fully cleaned up',
    leftovers === 0 && (leftProj || []).length === 0 && (leftEmp || []).length === 0 && (leftCm || []).length === 0,
    `${leftovers + (leftProj || []).length + (leftEmp || []).length + (leftCm || []).length} row(s) remain`);

  console.log(`\n${fail === 0 ? 'ROUTING PROOF PASSED' : 'ROUTING PROOF FAILED'} — ${pass} ok, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
