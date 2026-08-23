-- Measured/AI takeoff headers persist the full markup-stack breakdown. total_overhead and
-- total_profit already exist; total_contingency completes the trio so the header carries the
-- engine's contingencyCents (as dollars) instead of losing it between save and export.
-- Applied live 2026-08-22 (Supabase project jddfvugsaosvgllbkzch) via MCP apply_migration.
alter table public.takeoffs add column if not exists total_contingency numeric;
comment on column public.takeoffs.total_contingency is 'Contingency amount (dollars) from the shared markup stack — engine contingencyCents / 100';
