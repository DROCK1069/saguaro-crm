/* AUTO-BUILD PROOF — proves the in-app claim: "when the first bid is awarded,
 * Saguaro automatically creates 24 schedule tasks, a CSI-coded budget, sub
 * packages, a safety plan, QC checkpoints and the contact directory."
 * Runs the REAL award trigger on a clearly-marked fixture against the LIVE
 * stack, counts every artifact, proves second awards do NOT double-build,
 * then deletes the fixture completely. */
import { createClient } from '@supabase/supabase-js';
import * as fs from 'node:fs';

const env = fs.readFileSync('D:/saguaro-web/.env.local', 'utf8');
const get = (k: string) => (env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim();
process.env.NEXT_PUBLIC_SUPABASE_URL = get('NEXT_PUBLIC_SUPABASE_URL');
process.env.SUPABASE_SERVICE_ROLE_KEY = get('SUPABASE_SERVICE_ROLE_KEY');
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = get('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const db = createClient(get('NEXT_PUBLIC_SUPABASE_URL')!, get('SUPABASE_SERVICE_ROLE_KEY')!);

const MARK = 'CLAUDE-PROOF-' + Math.floor(Math.random() * 1e6);
let pass = 0, fail = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} — ${detail}`);
  ok ? pass++ : fail++;
};

const CHILD_TABLES = ['lien_waivers', 'schedule_of_values', 'pay_applications', 'change_orders',
  'bid_analytics', 'commitments', 'contracts', 'budget_lines', 'project_subcontractors', 'schedule_tasks', 'cost_entries',
  'inspections', 'safety_plans', 'project_contacts', 'w9_requests', 'purchase_orders',
  'notifications', 'bid_submissions', 'bid_packages'];

async function purgeProjects(ids: string[]) {
  if (!ids.length) return;
  for (const t of CHILD_TABLES) await db.from(t).delete().in('project_id', ids);
  await db.from('projects').delete().in('id', ids);
}

async function purgeStranded() {
  const { data: stale } = await db.from('projects').select('id').like('name', 'CLAUDE-PROOF%');
  const ids = (stale || []).map((p: any) => p.id);
  if (ids.length) { await purgeProjects(ids); console.log(`purged ${ids.length} stranded fixture project(s)`); }
  const { data: ss } = await db.from('subcontractors').select('id').like('company_name', 'CLAUDE-PROOF%');
  const sids = (ss || []).map((s: any) => s.id);
  if (sids.length) {
    await db.from('project_subcontractors').delete().in('subcontractor_id', sids);
    await db.from('subcontractors').delete().in('id', sids);
  }
}

async function main() {
  await purgeStranded();
  const { data: anyProject } = await db.from('projects').select('tenant_id').limit(1).single();
  const tenantId = (anyProject as any).tenant_id;

  // ── fixture ──
  const { data: proj } = await db.from('projects').insert({
    tenant_id: tenantId, name: MARK + ' project', status: 'active',
    start_date: '2026-09-01', owner_name: MARK + ' Owner', owner_email: 'owner@example.invalid',
    pm_name: MARK + ' PM', architect_name: MARK + ' Architect',
  } as never).select().single();
  const projectId = (proj as any).id;

  const { data: subCo } = await db.from('subcontractors').insert({
    tenant_id: tenantId, company_name: MARK + ' Electric LLC',
    email: 'proof@example.invalid', trade: 'Electrical', status: 'active', w9_on_file: false,
  } as never).select().single();
  const subId = (subCo as any).id;

  const { data: pkg } = await db.from('bid_packages').insert({
    tenant_id: tenantId, project_id: projectId, name: MARK + ' Electrical Package',
    trade: 'Electrical', csi_division: '26', csi_codes: ['26 00 00'], status: 'open',
  } as never).select().single();
  const pkgId = (pkg as any).id;

  const { data: sub1 } = await db.from('bid_submissions').insert({
    tenant_id: tenantId, project_id: projectId, bid_package_id: pkgId,
    sub_id: subId, sub_name: MARK + ' Electric LLC', amount: 45000, status: 'submitted',
  } as never).select().single();
  const submissionId = (sub1 as any).id;

  // simulate the award route's package update, then fire the REAL trigger
  await db.from('bid_packages').update({ status: 'awarded', awarded_at: new Date().toISOString(), awarded_to: MARK + ' Electric LLC', awarded_to_id: subId, awarded_amount: 45000 } as never).eq('id', pkgId);
  const { onBidAwarded } = await import('../lib/triggers');
  await onBidAwarded(submissionId);

  // ── K1-K3: 24 predecessor-linked schedule tasks with a critical spine ──
  const { data: tasks } = await db.from('schedule_tasks').select('external_id, predecessor_id, is_critical, start_date, end_date, trade, phase').eq('project_id', projectId).like('external_id', 'KICKOFF-%');
  const tk = (tasks || []) as any[];
  check('K1: exactly 24 schedule tasks created', tk.length === 24, `${tk.length} tasks`);
  const linked = tk.filter((x) => x.predecessor_id).length;
  check('K2: tasks are predecessor-linked', linked >= 20, `${linked} with predecessors`);
  const crit = tk.filter((x) => x.is_critical).length;
  const t1 = tk.find((x) => x.external_id === 'KICKOFF-1');
  const t24 = tk.find((x) => x.external_id === 'KICKOFF-24');
  check('K3: critical spine + dates flow forward', crit >= 12 && !!t1 && !!t24 && t24.end_date > t1.start_date, `${crit} critical, ${t1?.start_date} -> ${t24?.end_date}`);

  // ── K4: CSI-coded budget ──
  const { data: bl } = await db.from('budget_lines').select('cost_code, division').eq('project_id', projectId);
  const coded = (bl || []).filter((b: any) => /^\d{2} 00 00$/.test(b.cost_code || ''));
  check('K4: CSI-coded budget skeleton', coded.length >= 16, `${coded.length} coded lines`);

  // ── K5: draft sub packages for core trades ──
  const { data: pkgs } = await db.from('bid_packages').select('id, status, trade').eq('project_id', projectId);
  const drafts = (pkgs || []).filter((x: any) => x.status === 'draft');
  check('K5: draft sub packages created', drafts.length >= 8, `${drafts.length} drafts (+1 awarded)`);

  // ── K6: safety plan ──
  const { data: sp } = await db.from('safety_plans').select('status, sections').eq('project_id', projectId).maybeSingle();
  check('K6: safety plan active with real sections', !!sp && (sp as any).status === 'active' && ((sp as any).sections || []).length >= 8, `${((sp as any)?.sections || []).length} sections`);

  // ── K7: QC checkpoints ──
  const { data: qc } = await db.from('inspections').select('inspection_type, checklist, status').eq('project_id', projectId).eq('agency', 'Internal QC');
  const qcOk = (qc || []).length === 7 && (qc || []).every((q: any) => Array.isArray(q.checklist) && q.checklist.length >= 3);
  check('K7: 7 QC checkpoints with checklists', qcOk, `${(qc || []).length} checkpoints`);

  // ── K8: contact directory ──
  const { data: pc } = await db.from('project_contacts').select('name, role, contact_type').eq('project_id', projectId);
  const types = new Set((pc || []).map((c: any) => c.contact_type));
  check('K8: contact directory built', (pc || []).length >= 4 && types.has('owner') && types.has('subcontractor'), `${(pc || []).length} contacts (${Array.from(types).join(',')})`);

  // ── K9: contract from the award chain still fires ──
  const { data: ct } = await db.from('contracts').select('id, contract_type, original_amount').eq('project_id', projectId);
  check('K9: award still drafts the subcontract', (ct || []).length === 1 && (ct as any)[0].original_amount === '45000', `${(ct || []).length} contract(s)`);

  // ── K10: second award does NOT double-build ──
  const secondPkg = drafts[0];
  if (secondPkg) {
    const { data: sub2 } = await db.from('bid_submissions').insert({
      tenant_id: tenantId, project_id: projectId, bid_package_id: (secondPkg as any).id,
      sub_id: subId, sub_name: MARK + ' Electric LLC', amount: 12000, status: 'submitted',
    } as never).select().single();
    await db.from('bid_packages').update({ status: 'awarded', awarded_at: new Date().toISOString() } as never).eq('id', (secondPkg as any).id);
    await onBidAwarded((sub2 as any).id);
  }
  const { data: tasks2 } = await db.from('schedule_tasks').select('id').eq('project_id', projectId).like('external_id', 'KICKOFF-%');
  const { data: sp2 } = await db.from('safety_plans').select('id').eq('project_id', projectId);
  check('K10: second award does not double-build', (tasks2 || []).length === 24 && (sp2 || []).length === 1, `${(tasks2 || []).length} tasks, ${(sp2 || []).length} safety plan(s) after 2nd award`);

  // ── cleanup ──
  await purgeProjects([projectId]);
  await db.from('project_subcontractors').delete().eq('subcontractor_id', subId);
  await db.from('subcontractors').delete().eq('id', subId);
  const { data: leftovers } = await db.from('projects').select('id').eq('id', projectId);
  check('Z: fixture fully cleaned up', (leftovers || []).length === 0, 'no test rows remain');

  console.log(`\n${fail === 0 ? 'AUTO-BUILD PROOF PASSED' : 'AUTO-BUILD PROOF FAILED'} — ${pass} ok, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch(async (e) => { console.error(e); process.exit(1); });
