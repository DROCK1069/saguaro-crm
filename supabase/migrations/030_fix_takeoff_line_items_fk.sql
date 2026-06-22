-- 030_fix_takeoff_line_items_fk.sql
--
-- BUG: takeoff_line_items.takeoff_id had a foreign key to `takeoffs(id)`
-- (the AI-takeoff table), but the manual estimate workspace and the
-- AI->estimate bridge key line items to a `takeoff_projects.id`. The AI
-- takeoff system stores its rows in `takeoff_materials`, not this table, so
-- nothing legitimately points takeoff_id at `takeoffs`. The mismatched FK
-- made EVERY estimate-workspace line-item insert fail with a foreign-key
-- violation (verified by live integration test; table has 0 rows).
--
-- Fix: repoint the FK to takeoff_projects(id). Safe — takeoff_line_items is
-- empty, so there is no data to migrate.

ALTER TABLE public.takeoff_line_items
  DROP CONSTRAINT IF EXISTS takeoff_line_items_takeoff_id_fkey;

ALTER TABLE public.takeoff_line_items
  ADD CONSTRAINT takeoff_line_items_takeoff_id_fkey
  FOREIGN KEY (takeoff_id) REFERENCES public.takeoff_projects(id) ON DELETE CASCADE;
