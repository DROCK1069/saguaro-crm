-- Backfill: correct the WASTE double-count on engine-written takeoff_line_items rows.
--
-- Root cause: takeoff_line_items.total_material / total_labor / total_equipment /
-- total_sub / adjusted_quantity are GENERATED columns defined as
--     quantity * (1 + waste_factor_pct/100) * unit_*_cost
-- The deterministic lib/takeoff engine ALREADY bakes waste into the quantity it emits
-- (qty = baseQty * (1 + waste%), and materialCents = qty * unitRate). The measured /
-- analyze-full / versions writers persisted that already-waste-included qty AND a non-zero
-- waste_factor_pct, so the generated columns re-applied waste a second time — inflating
-- persisted material AND labor totals by ~waste% (5–15%).
--
-- Fix (writers, already changed in code): persist waste_factor_pct = 0 on engine rows, with
-- the waste-included qty and full-precision per-unit costs, so the generated totals equal the
-- engine's cents exactly. This migration corrects any rows written before that fix.
--
-- Scope: ONLY engine-written rows (takeoff_id set, takeoff_project_id NULL). Manual
-- estimate-builder rows (takeoff_project_id set) legitimately store NET quantity + waste and
-- MUST keep their waste_factor_pct — they are deliberately excluded.
--
-- Idempotent: after the first run the affected rows have waste_factor_pct = 0, so the WHERE
-- clause matches nothing on subsequent runs. Safe to run repeatedly.
--
-- NOTE: total_material/total_labor/adjusted_quantity are GENERATED — they recompute
-- automatically when waste_factor_pct is updated; they are not (and cannot be) written directly.
-- Equipment/sub extended costs that were previously dropped entirely cannot be reconstructed
-- from row data; re-saving or re-analyzing the affected takeoff regenerates them correctly.

UPDATE public.takeoff_line_items
SET    waste_factor_pct = 0
WHERE  takeoff_id IS NOT NULL
  AND  takeoff_project_id IS NULL
  AND  COALESCE(waste_factor_pct, 0) <> 0;
