/* Proof: bid-leveling engine. The apparent low bidder ($95k) EXCLUDES scope;
   after leveling with allowances, a different bidder is truly low. */
const { execSync } = require('child_process');
const path = require('path'), fs = require('fs');
const tmp = path.join(__dirname, '_bl');
execSync(`npx tsc lib/bidleveling/index.ts --outDir "${tmp}" --module commonjs --target es2020 --moduleResolution node --skipLibCheck --declaration false`, { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
const { levelBids, usd, TRADE_TEMPLATES } = require(path.join(tmp, 'index.js'));

const c = (d) => d * 100;
const scope = [
  { id: 'S1', description: 'Hang GWB', required: true },
  { id: 'S2', description: 'Metal framing', required: true },
  { id: 'S3', description: 'Insulation', required: true },
  { id: 'S4', description: 'Corner bead', required: true },
  { id: 'S5', description: 'Level-5 finish (lobby)', required: true },
];
const inc = (id, v) => ({ scopeLineId: id, status: 'included', valueCents: c(v) });
const exc = (id) => ({ scopeLineId: id, status: 'excluded' });
const bidders = [
  { id: 'A', name: 'Apex Drywall', baseBidCents: c(100000),
    scope: [inc('S1', 40000), inc('S2', 25000), inc('S3', 15000), inc('S4', 8000), inc('S5', 12000)],
    alternates: [{ key: 'ALT-1', description: 'Skylight framing', valueCents: c(8000), kind: 'add' }] },
  { id: 'B', name: 'Budget Wall', baseBidCents: c(95000),
    scope: [inc('S1', 42000), inc('S2', 28000), inc('S3', 25000), exc('S4'), exc('S5')],
    alternates: [{ key: 'ALT-1', description: 'Skylight framing', valueCents: c(9000), kind: 'add' }] },
  { id: 'C', name: 'Ceiling Co', baseBidCents: c(110000),
    scope: [inc('S1', 41000), inc('S2', 26000), inc('S3', 18000), inc('S4', 9000), inc('S5', 16000)],
    alternates: [{ key: 'ALT-1', description: 'Skylight framing', valueCents: c(7000), kind: 'add' }] },
];

let pass = 0, fail = 0;
const eq = (name, got, exp) => { const ok = got === exp; ok ? pass++ : fail++; console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}: got ${got}${ok ? '' : ' expected ' + exp}`); };
const ok = (name, cond, detail) => { cond ? pass++ : fail++; console.log(`  ${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' · ' + detail : ''}`); };

console.log('=== Scenario 1: ALT-1 selected, benchmark allowances ===');
const R = levelBids(scope, bidders, { selectedAlternateKeys: ['ALT-1'] });
const bid = (id) => R.bidders.find((b) => b.id === id);
console.log('  leveled:', R.bidders.map((b) => `${b.name} ${usd(b.leveledTotalCents)}${b.isLow ? ' [LOW]' : ''}`).join(' | '));
// A: 100k + 0 + 8k = 108k ; B: 95k + (S4 bench 8k? median of A8k,C9k = 8500) + (S5 median A12k,C16k=14000) + 9k
// benchmark S4 = median(8000,9000)=8500 ; S5 = median(12000,16000)=14000 → B gap = 22500 ; B = 95k+22.5k+9k = 126.5k
eq('A leveled', bid('A').leveledTotalCents, c(108000));
eq('B leveled', bid('B').leveledTotalCents, c(95000) + c(22500) + c(9000));
eq('C leveled', bid('C').leveledTotalCents, c(117000));
eq('low bidder', R.lowBidderId, 'A');
eq('B gap count', bid('B').gapCount, 2);
eq('B gap allowance', bid('B').gapAllowanceCents, c(22500));
ok('B gaps name corner bead + level-5', bid('B').gaps.includes('Corner bead') && bid('B').gaps.includes('Level-5 finish (lobby)'));
ok('low flipped B→A flag present', R.flags.some((f) => /low bidder changed/i.test(f.message)), R.flags.map((f) => f.message).join('; '));
eq('median base', R.medianBaseCents, c(100000));
const s4 = R.scopeCoverage.find((s) => s.scopeLineId === 'S4');
eq('S4 includedBy', s4.includedBy, 2); eq('S4 excludedBy', s4.excludedBy, 1);
eq('S4 benchmark', s4.benchmarkCents, c(8500));

console.log('\n=== Scenario 2: explicit allowance for S4 overrides benchmark ===');
const R2 = levelBids(scope, bidders, { selectedAlternateKeys: ['ALT-1'], gapAllowanceCents: { S4: c(10000) } });
// B gap = S4 explicit 10k + S5 benchmark 14k = 24k → B = 95k+24k+9k = 128k
eq('B leveled w/ explicit S4', R2.bidders.find((b) => b.id === 'B').leveledTotalCents, c(95000) + c(24000) + c(9000));

console.log('\n=== Scenario 3: no alternates selected ===');
const R3 = levelBids(scope, bidders, {});
eq('A leveled (no alt)', R3.bidders.find((b) => b.id === 'A').leveledTotalCents, c(100000));
eq('low still A', R3.lowBidderId, 'A');

console.log('\n=== Scenario 4: outlier flag ===');
const R4 = levelBids(scope, [...bidders, { id: 'D', name: 'Gold Plated', baseBidCents: c(200000), scope: scope.map((s) => inc(s.id, 40000)) }], {});
ok('D flagged as high outlier', R4.bidders.find((b) => b.id === 'D').flags.some((f) => /above median/i.test(f.message)));

console.log('\n=== Scenario 5: determinism ===');
ok('identical inputs → identical output', JSON.stringify(levelBids(scope, bidders, { selectedAlternateKeys: ['ALT-1'] })) === JSON.stringify(R));

console.log('\n=== Scenario 6: budget compare ===');
const R6 = levelBids(scope, bidders, { selectedAlternateKeys: ['ALT-1'], budgetCents: c(110000) });
const a6 = R6.bidders.find((b) => b.id === 'A');
eq('A vsBudget cents (108k-110k)', a6.vsBudgetCents, c(108000) - c(110000));
ok('A vsBudgetPct ~ -1.8%', Math.abs(a6.vsBudgetPct - (-1.8)) < 0.2, `${a6.vsBudgetPct}%`);
ok('B flagged over budget', R6.bidders.find((b) => b.id === 'B').flags.some((f) => /over your budget/i.test(f.message)));

console.log('\n=== Scenario 7: award recommendation (clean low) ===');
eq('recommends A (low + clean)', R6.recommendation.bidderId, 'A');
ok('rationale mentions A', /Apex/i.test(R6.recommendation.rationale), R6.recommendation.rationale);

console.log('\n=== Scenario 8: risky low → recommend cleaner within 3% ===');
const risky = { id: 'E', name: 'Risky Low', baseBidCents: c(105000),
  scope: [inc('S1', 42000), inc('S2', 28000), inc('S3', 25000), exc('S4'), exc('S5')], insuranceMeets: false,
  alternates: [{ key: 'ALT-1', description: 'x', valueCents: 0, kind: 'add' }] };
// E leveled: 105k + gaps(S4 8500 + S5 14000 = 22500) = 127.5k — not actually low. Use a cleaner scenario:
const twoBidders = [
  { id: 'CLEAN', name: 'Clean Co', baseBidCents: c(108000), scope: scope.map((s) => inc(s.id, 20000)), bondIncluded: true, insuranceMeets: true },
  { id: 'RISK', name: 'Risky Co', baseBidCents: c(106000), scope: scope.map((s) => inc(s.id, 20000)), bondIncluded: false, insuranceMeets: false },
];
const R8 = levelBids(scope, twoBidders, {});
// RISK is low (106k) but riskScore = bond2+ins3 = 5 ; CLEAN 108k within 3% (106k*1.03=109.18k) & riskScore 0 → recommend CLEAN
ok('low is RISK', R8.lowBidderId === 'RISK');
eq('recommends CLEAN (risky low, cleaner within 3%)', R8.recommendation.bidderId, 'CLEAN');

console.log('\n=== Scenario 9: adjustments (bond) add to leveled ===');
const withBond = bidders.map((b) => b.id === 'A' ? { ...b, adjustments: { bondCents: c(3000) } } : b);
const R9 = levelBids(scope, withBond, { selectedAlternateKeys: ['ALT-1'] });
eq('A leveled +$3k bond', R9.bidders.find((b) => b.id === 'A').leveledTotalCents, c(108000) + c(3000));
eq('A coverage 100%', R9.bidders.find((b) => b.id === 'A').requiredCoveragePct, 100);
eq('B coverage 60% (3 of 5)', R9.bidders.find((b) => b.id === 'B').requiredCoveragePct, 60);

console.log('\n=== Scenario 10: templates ===');
ok('9 trade templates present', TRADE_TEMPLATES.length === 9, `${TRADE_TEMPLATES.length}`);
ok('drywall template has scope lines', TRADE_TEMPLATES[0].lines.length >= 6);

console.log(`\n${pass}/${pass + fail} passed`);
fs.rmSync(tmp, { recursive: true, force: true });
process.exitCode = fail ? 1 : 0;
