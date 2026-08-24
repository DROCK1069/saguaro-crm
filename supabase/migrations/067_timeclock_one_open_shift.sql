-- 067_timeclock_one_open_shift.sql — the time clock's structural guarantee.
--
-- APPLIED LIVE 2026-08-24 alongside a data repair.
--
-- Background: before the canonical timeclock API landed, four surfaces wrote
-- clock events three different ways with no server-side open-shift detection.
-- Production damage this caused, all verified in the live tables:
--   * time_entries held five shifts left open since June — two of them created
--     FIVE SECONDS APART for the same employee (an unguarded double-tap).
--   * clock_punches held five consecutive 'out' punches with no 'in' between.
-- The three rows belonging to a real user were repaired by closing them with
-- ZERO hours (never invented hours) and an explanatory note on each row.
--
-- Application code now detects the open shift server-side and makes clock-in
-- idempotent. This index is the belt-and-suspenders: even if a future client
-- regresses, the database itself refuses a second open shift per employee.
-- Partial so that closed shifts (the overwhelming majority) are unconstrained,
-- and employee_id-scoped because that is the identity every surface resolves to.

create unique index if not exists time_entries_one_open_shift
  on time_entries (employee_id)
  where clock_in is not null and clock_out is null and employee_id is not null;
