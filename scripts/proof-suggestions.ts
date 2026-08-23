/* SUGGESTION-ENGINE PROOF — proves lib/suggestions.ts (the rule engine behind
 * /api/suggestions, the ticker, and every NudgeRing) against the LIVE stack:
 * fixture rows trip invoice-overdue, payapp-uncollected, and
 * insurance-expiring on an isolated fixture tenant; dollar figures must be
 * the exact honest numbers from the rows (never invented); a dismissal
 * recorded in learning_events (kind 'suggestion_dismissed') must survive
 * recompute. Fixture fully cleaned up. */
import { createClient } from '@supabase/supabase-js';
import * as fs from 'node:fs';
import { computeSuggestions } from '../lib/suggestions';

const env = fs.readFileSync('D:/saguaro-web/.env.local', 'utf8');
const get = (k: string) => (env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim();
const db = createClient(get('NEXT_PUBLIC_SUPABASE_URL')!, get('SUPABASE_SERVICE_ROLE_KEY')!);

const MARK = 'CLAUDE-PROOF-SUG-' + Math.floor(Math.random() * 1e6);
let pass = 0, fail = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} — ${detail}`);
  ok ? pass++ : fail++;
};

/* Same local date-only math as lib/suggestions.ts, so the expected day counts
 * are computed the way the engine computes them (never UTC-shifted). */
const todayYmd = () => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() }; };
const ymdDaysAhead = (days: number) => {
  const b = todayYmd();
  const t = new Date(Date.UTC(b.y, b.m - 1, b.d + days));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
};

/** Purge every fixture row a tenant owns, then the tenant + its auth user
 * (tenant ids double as auth.users ids — the legacy FK projects.tenant_id
 * references auth.users, so the fixture tenant lives in both). */
async function purgeTenants(tenantIds: string[]) {
  for (const t of ['learning_events', 'insurance_certificates', 'pay_applications', 'invoices', 'projects']) {
    await db.from(t).delete().in('tenant_id', tenantIds);
  }
  await db.from('tenants').delete().in('id', tenantIds);
  for (const id of tenantIds) {
    try { await db.auth.admin.deleteUser(id); } catch { /* already gone */ }
  }
}

async function main() {
  // ── stranded-fixture purge (a previous crashed run must not poison checks) ──
  const { data: staleT } = await db.from('tenants').select('id').like('name', 'CLAUDE-PROOF-SUG%');
  if (staleT?.length) await purgeTenants(staleT.map((t: any) => t.id));

  // ── fixture tenant: the engine scans a whole tenant, so isolation makes
  //    every expected suggestion the ONLY suggestion of its rule. The legacy
  //    FK (projects.tenant_id → auth.users) means the tenant id must exist as
  //    an auth user too — create the user first, reuse its id. ──
  const { data: authUser, error: uErr } = await db.auth.admin.createUser({
    email: `${MARK.toLowerCase()}@proof.invalid`, email_confirm: true,
  });
  if (uErr || !authUser?.user) { console.error('FATAL: could not create fixture auth user:', uErr?.message); process.exit(1); }
  const tenantId = authUser.user.id;
  const { data: tenant, error: tErr } = await db.from('tenants').insert({
    id: tenantId, name: MARK + ' tenant', slug: MARK.toLowerCase(),
  } as never).select().single();
  if (tErr || !tenant) { await purgeTenants([tenantId]); console.error('FATAL: could not create fixture tenant:', tErr?.message); process.exit(1); }

  const { data: proj, error: pErr } = await db.from('projects').insert({
    tenant_id: tenantId, name: MARK + ' project', status: 'active',
  } as never).select().single();
  if (pErr || !proj) { await purgeTenants([tenantId]); console.error('FATAL: could not create fixture project:', pErr?.message); process.exit(1); }
  const projectId = (proj as any).id;

  // ── fixture rows that trip exactly three rules with honest dollar figures ──
  // invoice-overdue: 21 days past due, billed $123,456 total, $23,456 paid
  //   → outstanding = exactly $100,000, red (≥14 days over).
  const { data: inv } = await db.from('invoices').insert({
    tenant_id: tenantId, project_id: projectId, vendor_name: MARK + ' Vendor',
    invoice_number: MARK + '-INV-1', amount: 120000, tax: 3456, total: 123456,
    paid_amount: 23456, due_date: ymdDaysAhead(-21), status: 'sent',
  } as never).select().single();
  const invoiceId = (inv as any)?.id;

  // payapp-uncollected: approved 21 days ago, $87,654.32 certified and
  //   uncollected → amber (red starts at 30), dollars = 87654.32.
  const { data: pa } = await db.from('pay_applications').insert({
    tenant_id: tenantId, project_id: projectId, app_number: 7, status: 'approved',
    current_payment_due: 87654.32,
    approved_at: new Date(Date.now() - 21 * 86400000).toISOString(),
  } as never).select().single();
  const payAppId = (pa as any)?.id;

  // insurance-expiring: active cert expiring 10 days out → amber, no dollars.
  const { data: cert } = await db.from('insurance_certificates').insert({
    tenant_id: tenantId, project_id: projectId, sub_name: MARK + ' Sub',
    policy_type: 'General Liability', carrier: 'Proof Mutual',
    expiry_date: ymdDaysAhead(10), status: 'active',
  } as never).select().single();
  const certId = (cert as any)?.id;

  // ── run the REAL engine against the live DB ──
  const feed = await computeSuggestions(db as any, tenantId);
  const byId = new Map(feed.suggestions.map((s) => [s.id, s]));

  // ── S1: overdue invoice fires with the exact outstanding balance ──
  const s1 = byId.get(`invoice-overdue:${invoiceId}`);
  check('S1: invoice-overdue fires with exact $100,000 outstanding',
    !!s1 && s1.dollars === 100000 && s1.finding.includes('$100,000') && s1.severity === 'red',
    s1 ? `dollars ${s1.dollars}, severity ${s1.severity}: "${s1.finding}"` : `suggestion missing (feed has ${feed.suggestions.length}, degraded: [${feed.degradedSources.join(', ')}])`);

  // ── S2: uncollected pay app fires with the exact certified amount ──
  const s2 = byId.get(`payapp-uncollected:${payAppId}`);
  check('S2: payapp-uncollected fires with exact $87,654.32 due',
    !!s2 && s2.dollars === 87654.32 && s2.finding.includes('$87,654') && s2.severity === 'amber',
    s2 ? `dollars ${s2.dollars}, severity ${s2.severity}: "${s2.finding}"` : 'suggestion missing');

  // ── S3: expiring insurance fires with the day count (no invented dollars) ──
  const s3 = byId.get(`insurance-expiring:${certId}`);
  check('S3: insurance-expiring fires at 10 days out, dollars null',
    !!s3 && s3.dollars === null && s3.finding.includes('expires in 10 days') && s3.severity === 'amber',
    s3 ? `dollars ${s3.dollars}: "${s3.finding}"` : 'suggestion missing');

  // ── S4: dismissal — a learning_events row (kind suggestion_dismissed,
  //    meta.suggestionId = the STABLE id) excludes it on recompute while the
  //    other suggestions keep flowing ──
  await db.from('learning_events').insert({
    tenant_id: tenantId, kind: 'suggestion_dismissed', seconds_saved: 0, dollars_surfaced: 0,
    meta: { suggestionId: `payapp-uncollected:${payAppId}` },
  } as never);
  const feed2 = await computeSuggestions(db as any, tenantId);
  const gone = !feed2.suggestions.some((s) => s.id === `payapp-uncollected:${payAppId}`);
  const kept = feed2.suggestions.some((s) => s.id === `invoice-overdue:${invoiceId}`);
  check('S4: dismissed suggestion excluded on recompute (others kept)',
    gone && kept,
    `dismissed payapp ${gone ? 'excluded' : 'STILL PRESENT'}, invoice ${kept ? 'still fires' : 'MISSING'}`);

  // ── cleanup ──
  await purgeTenants([tenantId]);
  const { data: leftT } = await db.from('tenants').select('id').eq('id', tenantId);
  const { data: leftRows } = await db.from('invoices').select('id').eq('tenant_id', tenantId);
  check('Z: fixture fully cleaned up', (leftT || []).length === 0 && (leftRows || []).length === 0, 'no test rows remain');

  console.log(`\n${fail === 0 ? 'SUGGESTIONS PROOF PASSED' : 'SUGGESTIONS PROOF FAILED'} — ${pass} ok, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
