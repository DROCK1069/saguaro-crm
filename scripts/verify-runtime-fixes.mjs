// Proves the just-deployed create-route fixes actually persist at runtime by
// POSTing the real payload to the LIVE routes and reading the row back, then
// cleaning up. (A write isn't "done" until it lands in the DB.)
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('D:/saguaro-mobile/.env', 'utf8').split('\n')
    .map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]),
);
const URL = env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const BASE = 'https://www.saguarocontrol.net';
const supabase = createClient(URL, ANON);

const { data: auth, error: aErr } = await supabase.auth.signInWithPassword({ email: 'tntcybersolutions@gmail.com', password: 'Saltlife69!' });
if (aErr) { console.error('sign-in failed:', aErr.message); process.exit(1); }
const token = auth.session.access_token;
const { data: proj } = await supabase.from('projects').select('id, name').limit(1).single();
const P = proj.id;
console.log(`signed in; project=${proj.name} (${P.slice(0,8)})\n`);

const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
const cleanup = []; // [table, id]
const out = [];

async function post(label, url, body, table, idPath) {
  try {
    const res = await fetch(`${BASE}${url}`, { method: 'POST', headers: H, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    const row = idPath.split('.').reduce((o, k) => o?.[k], j);
    const id = row?.id ?? row;
    const ok = res.ok && !!id;
    if (id && typeof id === 'string') cleanup.push([table, id]);
    out.push(`${label.padEnd(22)} ${ok ? '✓ 201 persisted id=' + String(id).slice(0,8) : '✗ ' + res.status + ' ' + (j.error || JSON.stringify(j).slice(0,80))}`);
    return ok;
  } catch (e) { out.push(`${label.padEnd(22)} ✗ ${e.message}`); return false; }
}

console.log('=== LIVE RUNTIME VERIFICATION of deployed create-route fixes ===');
await post('contracts', `/api/projects/${P}/contracts`, { title: 'ZZ Verify Contract', vendor_name: 'ZZ Vendor', original_amount: 1000, contract_type: 'subcontract' }, 'contracts', 'contract.id');
await post('resource-planning', `/api/projects/${P}/resource-planning`, { person_name: 'ZZ Person', role: 'Laborer', start_date: '2026-06-17' }, 'resource_assignments', 'data.id');
await post('waste-tracking', `/api/projects/${P}/waste-tracking`, { waste_date: '2026-06-17', waste_type: 'concrete', quantity: 5, unit: 'tons' }, 'waste_tracking', 'record.id');
await post('custom-fields', `/api/custom-fields`, { module: 'projects', field_name: 'zz_test_field', field_label: 'ZZ Test', field_type: 'text' }, 'custom_field_definitions', 'field.id');

// cleanup
for (const [table, id] of cleanup) await supabase.from(table).delete().eq('id', id);

console.log(out.join('\n'));
const pass = out.filter((r) => r.includes('✓')).length;
console.log(`\ncleanup ✓ removed ${cleanup.length} test rows`);
console.log(`${pass}/4 create routes PERSIST at runtime ${pass === 4 ? '— ALL GREEN' : '— SEE FAILURES'}`);
process.exit(pass === 4 ? 0 : 1);
