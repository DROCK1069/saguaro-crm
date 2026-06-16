/* Runnable proof for the calc engine. Run: npx tsx lib/calc/calc.test.ts */
import { toCents, addCents, percentOf, extend, roundHalfUp, formatUSD } from './money';
import { computePayApp } from './payapp';
import { convert, isConvertible } from './units';
import { summarizeContract } from './changeOrder';
import { normalizeTakeoff } from './takeoff';
import { checkTakeoffSanity, checkPayAppSanity } from './sanity';

let pass = 0, fail = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}  ${detail}`); }
};

console.log('MONEY — exactness & float-safety');
check('0.10 + 0.20 === 0.30 (cents, no float error)', addCents(toCents(0.1), toCents(0.2)) === toCents(0.3), `got ${addCents(toCents(0.1), toCents(0.2))}`);
check('10% of $1,234.56 === $123.46', percentOf(toCents(1234.56), 10) === toCents(123.46), `got ${percentOf(toCents(1234.56), 10)}`);
check('263 CY × $165.00 === $43,395.00', extend(263, toCents(165)) === toCents(43395));
check('roundHalfUp(2.5)=3 and (-2.5)=-3', roundHalfUp(2.5) === 3 && roundHalfUp(-2.5) === -3);
check('1¢ summed 10,000× === $100.00', addCents(...Array(10000).fill(1)) === toCents(100));

console.log('\nPAY APP — G702/G703 cross-footing (hand-verified)');
const r = computePayApp({
  retainagePercent: 10,
  previousPaymentsLessRetainage: toCents(90000),
  lines: [
    { id: '1', description: 'Concrete', scheduledValue: toCents(100000), fromPrevious: toCents(80000), thisPeriod: toCents(10000), storedMaterials: 0 },
    { id: '2', description: 'Steel',    scheduledValue: toCents(200000), fromPrevious: toCents(20000), thisPeriod: toCents(30000), storedMaterials: toCents(10000) },
    { id: '3', description: 'Finishes', scheduledValue: toCents(50000),  fromPrevious: 0,              thisPeriod: toCents(5000),  storedMaterials: 0 },
  ],
});
check('scheduled total === $350,000', r.scheduledTotal === toCents(350000), formatUSD(r.scheduledTotal));
check('completed+stored === $155,000', r.completedAndStoredTotal === toCents(155000), formatUSD(r.completedAndStoredTotal));
check('retainage === $15,500', r.retainageTotal === toCents(15500), formatUSD(r.retainageTotal));
check('earned less retainage === $139,500', r.totalEarnedLessRetainage === toCents(139500), formatUSD(r.totalEarnedLessRetainage));
check('current payment due === $49,500', r.currentPaymentDue === toCents(49500), formatUSD(r.currentPaymentDue));
check('balance to finish === $210,500', r.balanceToFinishIncludingRetainage === toCents(210500), formatUSD(r.balanceToFinishIncludingRetainage));
check('document RECONCILES (all cross-foots pass)', r.reconciles === true, r.errors.join('; '));

const bad = computePayApp({
  retainagePercent: 10, previousPaymentsLessRetainage: 0,
  lines: [{ id: '1', description: 'X', scheduledValue: toCents(1000), fromPrevious: toCents(900), thisPeriod: toCents(500), storedMaterials: 0 }],
});
check('flags over-billing (completed > scheduled)', bad.reconciles === false && bad.errors.some((e) => /over-billing/.test(e)), bad.errors.join('; '));

console.log('\nUNITS — dimensional safety');
check('1 CY === 27 CF', convert(1, 'CY', 'CF') === 27);
check('100 SY === 900 SF', convert(100, 'SY', 'SF') === 900);
check('1 TON === 2000 LB', convert(1, 'TON', 'LB') === 2000);
check('SF→LF throws (incompatible dims)', (() => { try { convert(1, 'SF', 'LF'); return false; } catch { return true; } })());
check('isConvertible(CY,CF)=true, (SF,LB)=false', isConvertible('CY', 'CF') && !isConvertible('SF', 'LB'));

console.log('\nCHANGE ORDERS — revised contract');
const cs = summarizeContract(toCents(1000000), [
  { id: '1', description: 'add',     amount: toCents(50000), status: 'approved' },
  { id: '2', description: 'add2',    amount: toCents(25000), status: 'approved' },
  { id: '3', description: 'pending', amount: toCents(10000), status: 'pending' },
  { id: '4', description: 'rejected',amount: toCents(99999), status: 'rejected' },
]);
check('approved COs === $75,000', cs.approvedChangeOrders === toCents(75000));
check('revised contract === $1,075,000 (excludes pending+rejected)', cs.revisedContract === toCents(1075000));
check('pending tracked separately === $10,000', cs.pendingChangeOrders === toCents(10000));

console.log('\nTAKEOFF — validation & derived totals');
const tk = normalizeTakeoff([
  { description: 'Concrete',   quantity: 263, unit: 'CY', unitCostCents: toCents(165), totalCents: toCents(43395), laborHours: 53 },
  { description: 'Bad total',  quantity: 100, unit: 'EA', unitCostCents: toCents(10), totalCents: toCents(9999), laborHours: 0 },
  { description: 'Zero qty',   quantity: 0,   unit: 'EA', unitCostCents: toCents(5) },
], { contingencyPercent: 10 });
check('drops invalid (qty=0) items → 2 valid', tk.items.length === 2);
check('recomputes bad total to qty×rate ($1,000)', tk.items[1].totalCents === toCents(1000));
check('material total === $44,395', tk.materialCents === toCents(44395));
check('labor === $3,445 (53hr × $65)', tk.laborCents === toCents(3445));
check('project total === $52,624 (subtotal × 1.10)', tk.projectTotalCents === toCents(52624));

console.log('\nSANITY — flags implausible numbers (never mutates)');
check('clean takeoff → 0 flags', checkTakeoffSanity(normalizeTakeoff([{ description: 'Concrete', quantity: 263, unit: 'CY', unitCostCents: toCents(165) }]).items).length === 0);
check('flags absurd $2/CY unit cost', checkTakeoffSanity(normalizeTakeoff([{ description: 'Concrete', quantity: 10, unit: 'CY', unitCostCents: toCents(2) }]).items).some((f) => f.code === 'RATE_OUT_OF_BAND'));
check('flags duplicate line item', checkTakeoffSanity(normalizeTakeoff([{ description: 'Door', quantity: 1, unit: 'EA', unitCostCents: toCents(500) }, { description: 'Door', quantity: 1, unit: 'EA', unitCostCents: toCents(500) }]).items).some((f) => f.code === 'DUPLICATE_LINE'));
check('pay-app over-bill → sanity error', checkPayAppSanity(bad, 10).some((f) => f.code === 'OVERBILL' || f.code === 'NO_RECONCILE'));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAILURES'} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
