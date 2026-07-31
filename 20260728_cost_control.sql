-- ============================================================================
-- Cost Control  (page: /app/billing/cost-control)
-- ----------------------------------------------------------------------------
-- Saved cost-report snapshots. The live cost report itself is COMPUTED on the
-- fly by GET /api/cost-control (budget from budget_lines, committed from
-- purchase_orders, actual from approved/paid invoices) — nothing to store there.
-- This table persists a point-in-time snapshot (the monthly CM cost report) plus
-- any per-line manual overrides, so the numbers survive a refresh and history is
-- auditable.
--
-- Money in `lines` / `totals` is stored in INTEGER CENTS (matches lib/finance).
-- Apply in the Supabase SQL editor / migration runner. Idempotent.
-- ============================================================================

create table if not exists public.cost_reports (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null,
  project_id   uuid not null references public.projects(id) on delete cascade,
  report_date  date not null default current_date,
  title        text,
  lines        jsonb not null default '[]'::jsonb,   -- per-cost-code snapshot (cents + overrides)
  totals       jsonb not null default '{}'::jsonb,   -- CostReport summary (cents)
  notes        text,
  created_by   uuid,
  created_at   timestamptz not null default now()
);

create index if not exists idx_cost_reports_project on public.cost_reports (project_id, report_date desc);
create index if not exists idx_cost_reports_tenant  on public.cost_reports (tenant_id);

-- ── Row Level Security (mirrors budget_lines / invoices: get_tenant_id() + svc) ──
alter table public.cost_reports enable row level security;

drop policy if exists cost_reports_sel on public.cost_reports;
drop policy if exists cost_reports_ins on public.cost_reports;
drop policy if exists cost_reports_upd on public.cost_reports;
drop policy if exists cost_reports_del on public.cost_reports;
drop policy if exists cost_reports_svc on public.cost_reports;

create policy cost_reports_sel on public.cost_reports for select using (tenant_id = get_tenant_id());
create policy cost_reports_ins on public.cost_reports for insert with check (tenant_id = get_tenant_id());
create policy cost_reports_upd on public.cost_reports for update using (tenant_id = get_tenant_id());
create policy cost_reports_del on public.cost_reports for delete using (tenant_id = get_tenant_id());
-- service-role (createServerClient) path — API enforces tenant explicitly in code:
create policy cost_reports_svc on public.cost_reports for all using (true) with check (true);
