-- Learning loop: let completed AI blueprint takeoffs feed the GC's learned cost_rates.
--
-- The measured takeoff path stores each line's engine costKey on takeoff_line_items.cost_key,
-- which lib/takeoff-learn.learnTenantRates() reads to compute quantity-weighted learned rates.
-- The AI analyze path writes to takeoff_materials, which had no costKey — so AI takeoffs could
-- CONSUME learned rates but never CONTRIBUTE to them. This column lets analyze/route.ts persist
-- the resolved costKey (lib/takeoff.costKeyForCsiLine) so those lines also feed learning.
--
-- Idempotent + non-destructive. Safe to run multiple times. Application code already tolerates
-- this column being absent (it retries the insert without it), so applying this is purely additive.

ALTER TABLE public.takeoff_materials
  ADD COLUMN IF NOT EXISTS cost_key text;

COMMENT ON COLUMN public.takeoff_materials.cost_key IS
  'Engine costKey resolved from the AI line''s CSI code + unit (lib/takeoff.costKeyForCsiLine). '
  'Feeds the learning loop (lib/takeoff-learn.learnTenantRates). NULL when no confident mapping.';

-- Speeds the tenant-scoped learning read (WHERE tenant_id = $1 AND cost_key IS NOT NULL).
CREATE INDEX IF NOT EXISTS takeoff_materials_tenant_costkey_idx
  ON public.takeoff_materials (tenant_id, cost_key)
  WHERE cost_key IS NOT NULL;
