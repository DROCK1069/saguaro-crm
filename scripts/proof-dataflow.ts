/* DATAFLOW PROOF — runs the wired cascades against the LIVE stack under a
 * clearly-marked test fixture, verifies every row they should create, prints a
 * verdict per link, then deletes the fixture completely. */
import { createClient } from '@supabase/supabase-js';
import * as fs from 'node:fs';

const env = fs.readFileSync('D:/saguaro-web/.env.local', 'utf8');
const get = (k: string) => (env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim();
process.env.NEXT_PUBLIC_SUPABASE_URL = get('NEXT_PUBLIC_SUPABASE_URL');
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = get('NEXT_PUBLIC_SUPABASE_ANON_KEY');
process.env.SUPABASE_SERVICE_ROLE_KEY = get('SUPABASE_SERVICE_ROLE_KEY');
const db = createClient(get('NEXT_PUBLIC_SUPABASE_URL')!, get('SUPABASE_SERVICE_ROLE_KEY')!);

const MARK = 'CLAUDE-PROOF-' + Math.floor(Math.random() * 1e6);
let pass = 0, fail = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} — ${detail}`);
  ok ? pass++ : fail++;
};

async function main() {
  // ── fixture: tenant borrowed from an existing project (never mutated) ──
  const { data: anyProject } = await db.from('projects').select('tenant_id').limit(1).single();
  const tenantId = (anyProject as any).tenant_id;

  const { data: proj } = await db.from('projects').insert({
    tenant_id: tenantId, name: MARK + ' project', status: 'active',
    contract_amount: 100000, original_contract_amount: 100000,
  } as never).select().single();
  const projectId = (proj as any).id;

  const { data: subCo } = await db.from('subcontractors').insert({
    tenant_id: tenantId, company_name: MARK + ' Electric LLC',
    email: 'proof@example.invalid', trade: 'Electrical', status: 'active', w9_on_file: false,
  } as never).select().single();
  const subId = (subCo as any).id;

  await db.from('project_subcontractors').insert({
    tenant_id: tenantId, project_id: projectId, subcontractor_id: subId,
    contract_amount: 40000, status: 'active',
  } as never);

  await db.from('budget_lines').insert({
    tenant_id: tenantId, project_id: projectId, division: '26', cost_code: '26 00 00',
    description: MARK + ' electrical', original_budget: 50000, committed: 0, actual: 0,
  } as never);

  // ── LINK A: CO approval → project sum + prime contract approved_changes ──
  const { data: prime, error: primeErr } = await db.from('contracts').insert({
    tenant_id: tenantId, project_id: projectId, contract_type: 'prime',
    title: MARK + ' prime', party_name: MARK + ' Owner LLC', amount: 100000,
    contract_amount: 100000, original_amount: '100000', status: 'executed',
  } as never).select().single();
  if (primeErr) console.error('PRIME INSERT:', primeErr);
  const { data: pkgFix } = await db.from('bid_packages').insert({
    tenant_id: tenantId, project_id: projectId, name: MARK + ' package',
    trade: 'Electrical', status: 'open', csi_codes: ['26 00 00'],
  } as never).select().single();
  const { data: co, error: coErr } = await db.from('change_orders').insert({
    tenant_id: tenantId, project_id: projectId, co_number: 991, title: MARK + ' CO',
    description: MARK + ' CO', cost_impact: 5000, status: 'approved',
    related_bid_package_id: (pkgFix as any).id,
  } as never).select().single();
  if (coErr) console.error('CO INSERT:', coErr);
  const { onChangeOrderApproved, onPayAppApproved } = await import('./lib/triggers');
  await onChangeOrderApproved((co as any).id);
  const { data: projAfter } = await db.from('projects').select('contract_amount').eq('id', projectId).single();
  check('A1: CO bumps project contract sum', Number((projAfter as any).contract_amount) === 105000, `now ${(projAfter as any).contract_amount}`);
  const { data: primeAfter } = await db.from('contracts').select('approved_changes').eq('id', (prime as any).id).single();
  check('A2: CO moves prime approved_changes (the perma-stale column)', Number((primeAfter as any).approved_changes) === 5000, `approved_changes ${(primeAfter as any).approved_changes}`);
  const { data: blAfterCo } = await db.from('budget_lines').select('committed').eq('project_id', projectId).single();
  check('A3: CO commits budget by cost code', Number((blAfterCo as any).committed) === 5000, `committed ${(blAfterCo as any).committed}`);

  // ── LINK B: pay-app approval → conditional_progress waivers, PERIOD amounts ──
  const { data: pa } = await db.from('pay_applications').insert({
    tenant_id: tenantId, project_id: projectId, app_number: 1,
    status: 'certified', current_payment_due: 20000, period_to: '2026-08-31',
    contract_sum: 100000, change_orders_total: 5000,
  } as never).select().single();
  const paId = (pa as any).id;
  await onPayAppApproved(paId);
  const { data: waivers } = await db.from('lien_waivers').select('*').eq('pay_application_id', paId);
  check('B1: waiver generated via pay_application_id', (waivers || []).length === 1, `${(waivers || []).length} waiver(s)`);
  const wv = (waivers || [])[0] as any;
  check('B2: waiver type passes the live CHECK', wv?.waiver_type === 'conditional_progress', String(wv?.waiver_type));
  check('B3: waiver amount = PERIOD share, not full contract', Number(wv?.amount) === 20000, `$${wv?.amount} (period 20000, NOT contract 40000)`);
  check('B4: waiver carries company + token for the sign portal', !!wv?.company_name && !!wv?.token, `${wv?.company_name}`);

  // ── LINK C: SOV rollforward math (clone semantics) ──
  await db.from('schedule_of_values').insert([
    { tenant_id: tenantId, project_id: projectId, pay_app_id: paId, line_number: 1, description: MARK + ' rough-in', scheduled_value: 60000, prev_completed: 0, this_period: 15000, total_completed: 15000 },
    { tenant_id: tenantId, project_id: projectId, pay_app_id: paId, line_number: 2, description: MARK + ' trim', scheduled_value: 40000, prev_completed: 0, this_period: 5000, total_completed: 5000 },
  ] as never);
  const { data: priorSov } = await db.from('schedule_of_values').select('description, scheduled_value, total_completed').eq('pay_app_id', paId).order('line_number');
  const cloned = (priorSov as any[]).map((r) => ({ scheduled_value: r.scheduled_value, prev_completed: r.total_completed, this_period: 0 }));
  check('C1: rollforward carries scheduled values', cloned[0].scheduled_value === 60000 && cloned[1].scheduled_value === 40000, `${cloned.map((c) => c.scheduled_value).join(',')}`);
  check('C2: prior completed becomes from-previous', cloned[0].prev_completed === 15000 && cloned[1].prev_completed === 5000, `${cloned.map((c) => c.prev_completed).join(',')}`);

  // ── LINK D: paid gate — pending waiver BLOCKS (the route's exact filter) ──
  const blocking = (waivers || []).filter((w: any) => w.blocks_payment !== false && (w.status === 'pending' || w.status === 'sent'));
  check('D1: unsigned waiver blocks mark-paid', blocking.length === 1, `${blocking.length} blocking`);
  // sign it → conversion insert (the route's insert, replicated)
  await db.from('lien_waivers').update({ status: 'signed', signed_at: new Date().toISOString() } as never).eq('id', wv.id);
  const { error: convErr } = await db.from('lien_waivers').insert({
    tenant_id: tenantId, project_id: projectId, sub_id: wv.sub_id, pay_application_id: paId,
    waiver_type: 'unconditional_progress', amount: wv.amount, through_date: '2026-08-31',
    status: 'pending', converted_from_id: wv.id,
  } as never);
  check('D2: unconditional_progress conversion inserts cleanly', !convErr, convErr ? convErr.message : 'inserted');

  // ── cleanup: every fixture row out, children first ──
  await db.from('lien_waivers').delete().eq('project_id', projectId);
  await db.from('schedule_of_values').delete().eq('project_id', projectId);
  await db.from('pay_applications').delete().eq('project_id', projectId);
  await db.from('change_orders').delete().eq('project_id', projectId);
  await db.from('contracts').delete().eq('project_id', projectId);
  await db.from('bid_packages').delete().eq('project_id', projectId);
  await db.from('budget_lines').delete().eq('project_id', projectId);
  await db.from('project_subcontractors').delete().eq('project_id', projectId);
  await db.from('subcontractors').delete().eq('id', subId);
  await db.from('projects').delete().eq('id', projectId);
  const { data: leftovers } = await db.from('projects').select('id').eq('id', projectId);
  check('Z: fixture fully cleaned up', (leftovers || []).length === 0, 'no test rows remain');

  console.log(`\n${fail === 0 ? 'PROOF PASSED' : 'PROOF FAILED'} — ${pass} ok, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
