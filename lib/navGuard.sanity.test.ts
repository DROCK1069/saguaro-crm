/**
 * Nav-guard sanity — the router-level half of the unsaved-work guard.
 * Run: npx -y tsx lib/navGuard.sanity.test.ts   (exit 0 = every assertion held)
 *
 * Exists because of the owner's report: "if a GC is entering data into any
 * module, how do we know if they click on a different icon it just navigates
 * without asking to save work?" The answer was that it did. The guard only
 * intercepted `<a href>` clicks, and the whole field shell (app/field/layout.tsx
 * rail, bottom nav, module drawer, breadcrumb, hardware back) navigates with
 * `router.push()` from button onClick handlers — no anchor, no interception.
 *
 * These assertions pin the replacement contract: nav surfaces call
 * `useGuardedRouter()`, which asks every mounted dirty form before it moves.
 */
import { registerNavGuard, requestNavigation, runUnguarded, isNavGuarded } from './navGuard';
import { formValuesEqual } from './useUnsavedGuard';

let failures = 0;
const check = (name: string, cond: boolean, detail: string) => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${name} — ${detail}`);
  if (!cond) failures++;
};

/* ── 1. Clean form: navigation is untouched ─────────────────────────────── */
{
  let went = 0;
  const intercepted = requestNavigation(() => { went++; }, '/app/rfis');
  check('clean form navigates', intercepted === false && went === 0,
    `intercepted=${intercepted}, pushes=${went}`);
  check('clean form reports unguarded', isNavGuarded() === false, 'isNavGuarded()=false');
}

/* ── 2. Dirty form: the module-icon tap is stopped, then resumed on confirm ─ */
{
  let resume: (() => void) | null = null;
  const unregister = registerNavGuard({
    isDirty: () => true,
    intercept: (proceed) => { resume = proceed; },
  });
  let went = 0;
  const intercepted = requestNavigation(() => { went++; }, '/field/punch');
  check('dirty form stops the push', intercepted === true && went === 0,
    `intercepted=${intercepted}, pushes=${went}`);
  check('dirty form reports guarded', isNavGuarded() === true, 'isNavGuarded()=true');

  (resume as unknown as () => void)();  // user chose "Discard & leave"
  check('confirm resumes the push', went === 1, `pushes=${went}`);

  unregister();
  check('unmounted form stops guarding', requestNavigation(() => {}, '/field/punch') === false,
    'interception released on unregister');
}

/* ── 3. Resuming must not re-enter the guard (no infinite prompt loop) ───── */
{
  const unregister = registerNavGuard({ isDirty: () => true, intercept: (proceed) => proceed() });
  let pushes = 0;
  const go = () => { pushes++; requestNavigation(go, '/x'); };
  requestNavigation(go, '/x');
  check('no re-entry loop on resume', pushes === 1, `pushes=${pushes}`);
  unregister();
}

/* ── 4. runUnguarded is scoped to its own call ──────────────────────────── */
{
  const unregister = registerNavGuard({ isDirty: () => true, intercept: () => {} });
  const inside = runUnguarded(() => requestNavigation(() => {}));
  const after = requestNavigation(() => {});
  check('runUnguarded bypasses, then re-arms', inside === false && after === true,
    `inside=${inside}, after=${after}`);
  unregister();
}

/* ── 5. A broken dirty predicate must never wedge navigation ────────────── */
{
  const unregister = registerNavGuard({
    isDirty: () => { throw new Error('boom'); },
    intercept: () => {},
  });
  check('broken predicate fails open', requestNavigation(() => {}, '/app') === false,
    'a throwing isDirty() does not trap the user');
  unregister();
}

/* ── 6. Dirty detection: blank-vs-absent is not "typing" ────────────────── */
{
  check('blank fields are untouched',
    formValuesEqual({ a: '', b: null }, { a: undefined, c: [] }) === true, "'' / null / [] / {}");
  check('typing is seen',
    formValuesEqual({ notes: '' }, { notes: 'poured slab' }) === false, 'notes changed');
  check('nested line-item edits are seen',
    formValuesEqual({ lines: [{ qty: 1 }] }, { lines: [{ qty: 2 }] }) === false, 'qty 1 -> 2');
  check('equal numbers are not dirty',
    formValuesEqual({ hours: 8 }, { hours: 8 }) === true, 'hours 8 == 8');
  check('added array entries are seen',
    formValuesEqual([1, 2], [1]) === false, 'length 2 vs 1');
}

console.log(failures === 0 ? '\nALL NAV-GUARD SANITY CHECKS PASSED' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
