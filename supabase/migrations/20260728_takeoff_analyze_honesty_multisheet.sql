-- ============================================================================
-- Honest speed + large multi-sheet handling for AI blueprint takeoffs
--
-- Adds:
--   1) takeoffs.analyze_elapsed_ms — the MEASURED wall-clock of the analyze run,
--      so the product can report real time instead of a marketing "under 2 min".
--   2) takeoff_analysis_sheets — a per-page sheet register for the AI-analyze
--      `takeoffs` row. NOTE: the existing `drawing_sheets` (project drawing
--      management, keyed by drawing_set_id) and `takeoff_sheets` (measured tracer,
--      keyed by takeoff_project_id, name NOT NULL) tables are owned by OTHER
--      modules with incompatible NOT-NULL shapes and are NOT keyed to takeoffs.id,
--      so this register is its own table keyed by takeoff_id.
--
-- Idempotent. Safe to run more than once. Do NOT auto-apply — review first.
-- ============================================================================

-- 1) Measured analyze elapsed on the takeoff row -----------------------------
ALTER TABLE public.takeoffs
  ADD COLUMN IF NOT EXISTS analyze_elapsed_ms integer;

COMMENT ON COLUMN public.takeoffs.analyze_elapsed_ms IS
  'Measured wall-clock (ms) of the last AI analyze run. Source of truth for honest speed reporting.';

-- (page_count, pages_processed, extraction_notes, ai_model_used already exist on
--  takeoffs and are populated by the analyze route — no DDL needed for those.)

-- 2) Per-page sheet register for AI-analyze takeoffs -------------------------
CREATE TABLE IF NOT EXISTS public.takeoff_analysis_sheets (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  takeoff_id     uuid        NOT NULL REFERENCES public.takeoffs(id) ON DELETE CASCADE,
  tenant_id      uuid        NOT NULL,
  page_index     integer     NOT NULL,             -- 1-based page number in the source PDF/image
  sheet_number   text,                             -- e.g. 'A-101' (from the title block)
  sheet_title    text,
  discipline     text        NOT NULL DEFAULT 'general', -- architectural|structural|civil|mechanical|electrical|plumbing|fire_protection|landscape|general
  analyzed       boolean     NOT NULL DEFAULT false,     -- true if this sheet went through a deep extraction pass
  skipped_reason text,                             -- null if analyzed; else why (page/pass/time budget, etc.)
  item_count     integer     NOT NULL DEFAULT 0,   -- line items attributed to this sheet's discipline pass
  ai_confidence  numeric,
  sort_order     integer     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS takeoff_analysis_sheets_takeoff_idx
  ON public.takeoff_analysis_sheets (takeoff_id);
CREATE INDEX IF NOT EXISTS takeoff_analysis_sheets_tenant_idx
  ON public.takeoff_analysis_sheets (tenant_id);

-- RLS: mirror the takeoff_materials pattern (service role blanket + tenant isolation)
ALTER TABLE public.takeoff_analysis_sheets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tas_service ON public.takeoff_analysis_sheets;
CREATE POLICY tas_service ON public.takeoff_analysis_sheets
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS tas_tenant ON public.takeoff_analysis_sheets;
CREATE POLICY tas_tenant ON public.takeoff_analysis_sheets
  FOR ALL TO authenticated
  USING (tenant_id = get_tenant_id())
  WITH CHECK (tenant_id = get_tenant_id());
