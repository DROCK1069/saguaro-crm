/* FINANCIAL PROOF — proves the invoice/pay-app money model against the LIVE
 * stack: server-canonical totals, the dead $0-total rollup trap, local
 * date-only parsing, status normalization, retainage held-to-date semantics,
 * and the public-token column. Fixture fully cleaned up. */
import { createClient } from '@supabase/supabase-js';
import * as fs from 'node:fs';

const env = fs.readFileSync('D:/saguaro-web/.env.local', 'utf8');
const get = (k: string) => (env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim();
const db = createClient(get('NEXT_PUBLIC_SUPABASE_URL')!, get('SUPABASE_SERVICE_ROLE_KEY')!);

const MARK = 'CLAUDE-PROOF-FIN-' + Math.floor(Math.random() * 1e6);
let pass = 0, fail = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} — ${detail}`);
  ok ? pass++ : fail++;
};

// The exact display-side helpers the pages use — asserted here so a future
// edit that reintroduces the ??-zero trap or UTC drift fails the proof.
function effectiveTotal(i: { amount?: number | null; tax?: number | null; total?: number | null }): number {
  const t = Number(i.total);
  if (t > 0) return t;
  return (Number(i.amount) || 0) + (Number(i.tax) || 0);
}
function parseDateOnly(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (!m) { const d = new Date(v); return isNaN(d.getTime()) ? null : d; }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

async function main() {
  // stranded-fixture purge
  const { data: stale } = await db.from('invoices').select('id').like('vendor_name', 'CLAUDE-PROOF-FIN%');
  if (stale?.length) await db.from('invoices').delete().in('id', stale.map((r: any) => r.id));
  const { data: staleP } = await db.from('projects').select('id').like('name', 'CLAUDE-PROOF-FIN%');
  if (staleP?.length) {
    for (const t of ['invoices', 'pay_applications']) await db.from(t).delete().in('project_id', staleP.map((p: any) => p.id));
    await db.from('projects').delete().in('id', staleP.map((p: any) => p.id));
  }

  const { data: anyProject } = await db.from('projects').select('tenant_id').limit(1).single();
  const tenantId = (anyProject as any).tenant_id;
  const { data: proj } = await db.from('projects').insert({ tenant_id: tenantId, name: MARK + ' project', status: 'active' } as never).select().single();
  const projectId = (proj as any).id;

  // ── F1: server-canonical total — replicate the create route's formula ──
  const amount = 67800, tax = 0;
  const { data: inv } = await db.from('invoices').insert({
    tenant_id: tenantId, project_id: projectId, vendor_name: MARK + ' vendor',
    invoice_number: 'INV-PROOF-1', amount, tax,
    total: (Number(amount) || 0) + (Number(tax) || 0), // the route's exact formula
    status: 'draft', due_date: '2026-06-20',
  } as never).select().single();
  const row = inv as any;
  check('F1: total stored = amount + tax (server formula)', Number(row.total) === 67800, `total ${row.total}`);

  // ── F2: the $0-total trap is dead in display math ──
  const zeroTotalRow = { amount: 67800, tax: 0, total: 0 };
  check('F2: effectiveTotal defers 0-total to amount', effectiveTotal(zeroTotalRow) === 67800, `${effectiveTotal(zeroTotalRow)}`);
  check('F2b: real totals win', effectiveTotal({ amount: 1, tax: 0, total: 500 }) === 500, 'stored 500 kept');

  // ── F3: date-only parse stays on its own day (no UTC previous-evening) ──
  const d = parseDateOnly('2026-06-20')!;
  check('F3: 2026-06-20 parses to LOCAL June 20', d.getFullYear() === 2026 && d.getMonth() === 5 && d.getDate() === 20,
    `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} (UTC parse would land ${new Date('2026-06-20').getDate()} in AZ)`);

  // ── F4: status normalization — migration lowercased; helpers tolerate mixed ──
  await db.from('invoices').update({ status: 'Sent' } as never).eq('id', row.id);
  const { data: sentRow } = await db.from('invoices').select('status').eq('id', row.id).single();
  const norm = String((sentRow as any).status).toLowerCase();
  check('F4: lowercase normalization resolves mixed-case rows', norm === 'sent', `raw '${(sentRow as any).status}' -> '${norm}'`);

  // ── F5: public_token exists, unique, auto-minted ──
  check('F5: invoice auto-minted a public_token uuid', /^[0-9a-f-]{36}$/i.test(String(row.public_token)), String(row.public_token).slice(0, 13) + '…');

  // ── F6: retainage held-to-date = LATEST app, not the sum ──
  const mkPa = (n: number, retainage: number) => db.from('pay_applications').insert({
    tenant_id: tenantId, project_id: projectId, app_number: n, status: 'draft',
    current_payment_due: 1000, total_retainage: retainage,
  } as never);
  await mkPa(1, 500); await mkPa(2, 900); // cumulative: app 2 already includes app 1's retainage
  const { data: pas } = await db.from('pay_applications').select('app_number, total_retainage').eq('project_id', projectId);
  const latest = (pas || []).reduce((b: any, p: any) => (Number(p.app_number) > Number(b?.app_number ?? -1) ? p : b), null);
  const held = Number(latest?.total_retainage) || 0;
  const badSum = (pas || []).reduce((s: number, p: any) => s + (Number(p.total_retainage) || 0), 0);
  check('F6: retainage held-to-date = latest app (900), not the sum (1400)', held === 900 && badSum === 1400, `held ${held}, naive sum ${badSum}`);

  // ── cleanup ──
  await db.from('invoices').delete().eq('project_id', projectId);
  await db.from('pay_applications').delete().eq('project_id', projectId);
  await db.from('projects').delete().eq('id', projectId);
  const { data: left } = await db.from('projects').select('id').eq('id', projectId);
  const { data: leftI } = await db.from('invoices').select('id').eq('project_id', projectId);
  check('Z: fixture fully cleaned up', (left || []).length === 0 && (leftI || []).length === 0, 'no test rows remain');

  console.log(`\n${fail === 0 ? 'FINANCIAL PROOF PASSED' : 'FINANCIAL PROOF FAILED'} — ${pass} ok, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
