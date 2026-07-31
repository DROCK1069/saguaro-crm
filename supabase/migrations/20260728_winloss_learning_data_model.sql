-- Win/Loss bid learning — data model (Wave 0). Applied via Supabase MCP 2026-07-28.
-- Mirrors the VERIFIED bid_history RLS pattern: authenticated CRUD scoped to
-- get_tenant_id(); service_role gets an unrestricted ALL policy (service_role ONLY,
-- never public, or tenants would leak into each other).

alter table public.bid_history
  add column if not exists winning_bid_amount numeric,
  add column if not exists won_at   timestamptz,
  add column if not exists lost_at  timestamptz,
  add column if not exists source   text,
  add column if not exists source_id uuid;

create table if not exists public.bid_outcome_lines (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null,
  bid_history_id     uuid references public.bid_history(id) on delete cascade,
  csi_division       text not null,
  trade              text,
  our_cost_cents     integer,
  our_sell_cents     integer,
  winning_sell_cents integer,
  outcome            text not null,
  created_at         timestamptz not null default now()
);
create index if not exists bol_tenant_div_idx on public.bid_outcome_lines(tenant_id, csi_division);

create table if not exists public.trade_win_factors (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null,
  csi_division         text not null,
  trade                text,
  win_count            integer not null default 0,
  loss_count           integer not null default 0,
  win_rate             numeric,
  avg_win_margin_pct   numeric,
  avg_loss_margin_pct  numeric,
  avg_over_winner_pct  numeric,
  suggested_multiplier numeric not null default 1.0,
  confidence           numeric not null default 0,
  sample_count         integer not null default 0,
  source               text not null default 'learned',
  updated_at           timestamptz not null default now(),
  unique (tenant_id, csi_division)
);
create index if not exists twf_tenant_div_idx on public.trade_win_factors(tenant_id, csi_division);

alter table public.bid_outcome_lines enable row level security;
drop policy if exists bol_sel on public.bid_outcome_lines;
drop policy if exists bol_ins on public.bid_outcome_lines;
drop policy if exists bol_upd on public.bid_outcome_lines;
drop policy if exists bol_del on public.bid_outcome_lines;
drop policy if exists bol_svc on public.bid_outcome_lines;
create policy bol_sel on public.bid_outcome_lines for select to authenticated using (tenant_id = get_tenant_id());
create policy bol_ins on public.bid_outcome_lines for insert to authenticated with check (tenant_id = get_tenant_id());
create policy bol_upd on public.bid_outcome_lines for update to authenticated using (tenant_id = get_tenant_id()) with check (tenant_id = get_tenant_id());
create policy bol_del on public.bid_outcome_lines for delete to authenticated using (tenant_id = get_tenant_id());
create policy bol_svc on public.bid_outcome_lines for all to service_role using (true) with check (true);

alter table public.trade_win_factors enable row level security;
drop policy if exists twf_sel on public.trade_win_factors;
drop policy if exists twf_ins on public.trade_win_factors;
drop policy if exists twf_upd on public.trade_win_factors;
drop policy if exists twf_del on public.trade_win_factors;
drop policy if exists twf_svc on public.trade_win_factors;
create policy twf_sel on public.trade_win_factors for select to authenticated using (tenant_id = get_tenant_id());
create policy twf_ins on public.trade_win_factors for insert to authenticated with check (tenant_id = get_tenant_id());
create policy twf_upd on public.trade_win_factors for update to authenticated using (tenant_id = get_tenant_id()) with check (tenant_id = get_tenant_id());
create policy twf_del on public.trade_win_factors for delete to authenticated using (tenant_id = get_tenant_id());
create policy twf_svc on public.trade_win_factors for all to service_role using (true) with check (true);
