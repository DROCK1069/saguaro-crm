/* Proof: fleet engine — maintenance-due, expiries, GPS trip stats, rollups. */
const { execSync } = require('child_process');
const path = require('path'), fs = require('fs');
const tmp = path.join(__dirname, '_fl');
execSync(`npx tsc lib/fleet/index.ts --outDir "${tmp}" --module commonjs --target es2020 --moduleResolution node --skipLibCheck --declaration false`, { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
const { dueStatus, expiryStatus, haversineMiles, tripStats, assetHealth, fleetSummary } = require(path.join(tmp, 'index.js'));

const NOW = '2026-05-01T12:00:00Z';
let pass = 0, fail = 0;
const eq = (n, g, e) => { const ok = g === e; ok ? pass++ : fail++; console.log(`  ${ok ? 'PASS' : 'FAIL'} ${n}: ${g}${ok ? '' : ' (exp ' + e + ')'}`); };
const ok = (n, c, d) => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'} ${n}${d ? ' · ' + d : ''}`); };

console.log('=== dueStatus (mileage) ===');
eq('2000 mi out = ok', dueStatus(48000, NOW, 50000).status, 'ok');
eq('200 mi out = soon', dueStatus(49800, NOW, 50000).status, 'soon');
eq('past = overdue', dueStatus(50500, NOW, 50000).status, 'overdue');
eq('remaining miles', dueStatus(49800, NOW, 50000).remainingMiles, 200);
console.log('=== dueStatus (date) ===');
eq('40 days = ok', dueStatus(undefined, NOW, null, '2026-06-10').status, 'ok');
eq('10 days = soon', dueStatus(undefined, NOW, null, '2026-05-11').status, 'soon');
eq('past date = overdue', dueStatus(undefined, NOW, null, '2026-04-20').status, 'overdue');
console.log('=== dueStatus (worst of two) ===');
eq('miles ok but date overdue → overdue', dueStatus(48000, NOW, 50000, '2026-04-01').status, 'overdue');

console.log('=== expiryStatus ===');
eq('20 days → soon', expiryStatus('2026-05-21', NOW).status, 'soon');
eq('60 days → ok', expiryStatus('2026-06-30', NOW).status, 'ok');
eq('expired', expiryStatus('2026-04-15', NOW).status, 'expired');
eq('none', expiryStatus(null, NOW).status, 'none');

console.log('=== haversine + trips ===');
const d = haversineMiles({ lat: 33.4, lng: -112.0 }, { lat: 33.5, lng: -112.0 });
ok('0.1° lat ≈ 6.9 mi', Math.abs(d - 6.9) < 0.2, `${d} mi`);
const pings = [
  { lat: 33.40, lng: -112.00, speed_mph: 0, at: '2026-05-01T08:00:00Z' },
  { lat: 33.45, lng: -112.00, speed_mph: 45, at: '2026-05-01T08:05:00Z' },
  { lat: 33.50, lng: -112.00, speed_mph: 62, at: '2026-05-01T08:12:00Z' },
];
const t = tripStats(pings);
ok('trip distance ~6.9 mi', Math.abs(t.distanceMiles - 6.9) < 0.3, `${t.distanceMiles}`);
eq('max speed 62', t.maxSpeedMph, 62);
eq('duration 12 min', t.durationMin, 12);
ok('avg speed computed', t.avgSpeedMph > 0);

console.log('=== assetHealth + fleetSummary ===');
const assets = [
  { id: 'v1', type: 'vehicle', name: 'Truck 12', status: 'active', odometer: 49900 },
  { id: 'v2', type: 'vehicle', name: 'Van 3', status: 'active', odometer: 30000 },
  { id: 'e1', type: 'equipment', name: 'Excavator', status: 'in_shop', odometer: 1200 },
];
const records = [
  { id: 'm1', asset_id: 'v1', description: 'Oil change', next_due_odometer: 50000 }, // 100 mi → soon
  { id: 'm2', asset_id: 'v2', description: 'Oil change', next_due_odometer: 35000 }, // 5000 mi → ok
];
const docs = [
  { id: 'd1', asset_id: 'v1', category: 'registration', expires_at: '2026-04-01' }, // expired
  { id: 'd2', asset_id: 'v2', category: 'insurance', expires_at: '2026-05-20' },     // soon
];
const h1 = assetHealth(assets[0], records, docs, NOW);
eq('v1 maintenance soon', h1.maintenance.status, 'soon');
eq('v1 overall overdue (expired reg)', h1.overall, 'overdue');
const sum = fleetSummary(assets, records, docs, NOW);
eq('total 3', sum.total, 3);
eq('vehicles 2', sum.byType.vehicle, 2);
eq('in_shop 1', sum.byStatus.in_shop, 1);
eq('docs expired 1', sum.docsExpired, 1);
eq('docs soon 1', sum.docsExpiringSoon, 1);
ok('v1 needs attention', sum.needsAttention.includes('Truck 12'));

console.log('=== determinism ===');
ok('stable', JSON.stringify(fleetSummary(assets, records, docs, NOW)) === JSON.stringify(fleetSummary(assets, records, docs, NOW)));

console.log(`\n${pass}/${pass + fail} passed`);
fs.rmSync(tmp, { recursive: true, force: true });
process.exitCode = fail ? 1 : 0;
