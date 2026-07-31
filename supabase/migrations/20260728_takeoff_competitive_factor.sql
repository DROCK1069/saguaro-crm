-- Isolate the win/loss competitive multiplier from the cost-learning loop.
-- Applied via Supabase MCP 2026-07-28.
-- The factor is a SELL-side move; persisting it per line lets learnTenantRates
-- divide it out and learn TRUE cost, so a competitive discount never compounds
-- into the cost basis. Default 1 → all existing rows + every off-tenant line
-- are unaffected (true cost).
alter table public.takeoff_line_items add column if not exists competitive_factor numeric not null default 1;
alter table public.takeoff_materials  add column if not exists competitive_factor numeric not null default 1;
