/* Proof: time-clock engine — timezone-correct days, weekly + daily OT, PTO, rounding. */
const { execSync } = require('child_process');
const path = require('path'), fs = require('fs');
const tmp = path.join(__dirname, '_tc');
execSync(`npx tsc lib/timeclock/index.ts --outDir "${tmp}" --module commonjs --target es2020 --moduleResolution node --skipLibCheck --declaration false`, { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
const { computeTimesheet, entryHours, dayKey, weekKey, liveElapsed, fmtHours } = require(path.join(tmp, 'index.js'));

const TZ = 'America/Phoenix'; // no DST, -07:00
let pass = 0, fail = 0;
const eq = (n, g, e) => { const ok = g === e; ok ? pass++ : fail++; console.log(`  ${ok ? 'PASS' : 'FAIL'} ${n}: ${g}${ok ? '' : ' (exp ' + e + ')'}`); };
const ok = (n, c, d) => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'} ${n}${d ? ' · ' + d : ''}`); };
const work = (id, day, inH, outH, brk = 0, extra = {}) => ({ id, employeeId: 'e1', type: 'regular', timezone: TZ, breakMinutes: brk, clockIn: `2026-05-${day}T${String(inH).padStart(2, '0')}:00:00-07:00`, clockOut: `2026-05-${day}T${String(outH).padStart(2, '0')}:00:00-07:00`, ...extra });

console.log('=== entryHours ===');
eq('8h span (07:00–15:00) − 30m break = 7.5', entryHours(work('a', '04', 7, 15, 30)), 7.5);
// 07:00 to 15:30 with 30m break: build explicitly
const e830 = { id: 'x', employeeId: 'e1', type: 'regular', timezone: TZ, breakMinutes: 30, clockIn: '2026-05-04T07:00:00-07:00', clockOut: '2026-05-04T15:30:00-07:00' };
eq('07:00–15:30 − 30m = 8.0h', entryHours(e830), 8);
const e758 = { id: 'y', employeeId: 'e1', type: 'regular', timezone: TZ, clockIn: '2026-05-04T07:00:00-07:00', clockOut: '2026-05-04T14:58:00-07:00' };
eq('7h58m rounded to 15m = 8.0h', entryHours(e758, 15), 8);
eq('open entry (no clockOut) = 0', entryHours({ id: 'o', employeeId: 'e1', type: 'regular', timezone: TZ, clockIn: '2026-05-04T07:00:00-07:00' }), 0);
eq('PTO uses explicit hours', entryHours({ id: 'p', employeeId: 'e1', type: 'pto', timezone: TZ, hours: 8 }), 8);

console.log('\n=== timezone day/week bucketing ===');
eq('19:00 Phoenix = 2026-05-04', dayKey('2026-05-05T02:00:00Z', TZ), '2026-05-04'); // 02:00 UTC = 19:00 prev day Phoenix
eq('same instant UTC = 2026-05-05', dayKey('2026-05-05T02:00:00Z', 'UTC'), '2026-05-05');
eq('week of Thu 05-07 (Sun start) = 05-03', weekKey('2026-05-07T12:00:00-07:00', TZ, 0), '2026-05-03');

console.log('\n=== weekly OT (Mon–Thu 8h + Fri 10h = 42 → 40 reg + 2 OT) ===');
const week = [
  { id: 'm', employeeId: 'e1', type: 'regular', timezone: TZ, clockIn: '2026-05-04T07:00:00-07:00', clockOut: '2026-05-04T15:00:00-07:00' },
  { id: 't', employeeId: 'e1', type: 'regular', timezone: TZ, clockIn: '2026-05-05T07:00:00-07:00', clockOut: '2026-05-05T15:00:00-07:00' },
  { id: 'w', employeeId: 'e1', type: 'regular', timezone: TZ, clockIn: '2026-05-06T07:00:00-07:00', clockOut: '2026-05-06T15:00:00-07:00' },
  { id: 'th', employeeId: 'e1', type: 'regular', timezone: TZ, clockIn: '2026-05-07T07:00:00-07:00', clockOut: '2026-05-07T15:00:00-07:00' },
  { id: 'f', employeeId: 'e1', type: 'regular', timezone: TZ, clockIn: '2026-05-08T07:00:00-07:00', clockOut: '2026-05-08T17:00:00-07:00' },
  { id: 'pto', employeeId: 'e1', type: 'pto', timezone: TZ, clockIn: '2026-05-09T12:00:00-07:00', hours: 8 },
];
const ts = computeTimesheet(week);
const wk = ts.weeks[0];
eq('worked hours', wk.workedHours, 42);
eq('regular hours', wk.regularHours, 40);
eq('overtime hours', wk.overtimeHours, 2);
eq('paid hours (42 worked + 8 pto)', wk.paidHours, 50);
eq('byType.pto', wk.byType.pto, 8);
eq('one week bucket', ts.weeks.length, 1);
eq('6 day rows', wk.days.length, 6);

console.log('\n=== daily OT (Mon 12h, dailyOt=8 → 4 OT, 8 reg) ===');
const oneDay = computeTimesheet([{ id: 'big', employeeId: 'e1', type: 'regular', timezone: TZ, clockIn: '2026-05-04T06:00:00-07:00', clockOut: '2026-05-04T18:00:00-07:00' }], { dailyOtThreshold: 8 });
eq('daily OT', oneDay.weeks[0].overtimeHours, 4);
eq('daily reg', oneDay.weeks[0].regularHours, 8);
const noDailyOt = computeTimesheet([{ id: 'big2', employeeId: 'e1', type: 'regular', timezone: TZ, clockIn: '2026-05-04T06:00:00-07:00', clockOut: '2026-05-04T18:00:00-07:00' }]);
eq('no daily OT by default (12<40 wk)', noDailyOt.weeks[0].overtimeHours, 0);

console.log('\n=== open entries + live + determinism ===');
eq('open entry counted', computeTimesheet([{ id: 'op', employeeId: 'e1', type: 'regular', timezone: TZ, clockIn: '2026-05-04T07:00:00-07:00' }]).openEntries, 1);
eq('liveElapsed 2.5h', liveElapsed('2026-05-04T07:00:00-07:00', '2026-05-04T09:30:00-07:00'), 2.5);
ok('fmtHours 8.5 → 8h 30m', fmtHours(8.5) === '8h 30m');
ok('deterministic', JSON.stringify(computeTimesheet(week)) === JSON.stringify(computeTimesheet(week)));

console.log(`\n${pass}/${pass + fail} passed`);
fs.rmSync(tmp, { recursive: true, force: true });
process.exitCode = fail ? 1 : 0;
