-- ============================================================
-- Saguaro CRM — Approval Workflows (make-it-real)
-- Migration: 20260728_approval_workflows.sql
--
-- REUSE + EXTEND: approval_workflows, approval_requests and
-- approval_delegations ALREADY exist in this database (empty,
-- RLS enabled). This migration is idempotent (IF NOT EXISTS /
-- ADD COLUMN IF NOT EXISTS) so it documents the full intended
-- schema without duplicating what is already there, and it
-- ADDS the missing approval_decisions audit table plus the
-- entity-linkage columns on approval_requests.
--
-- DO NOT auto-apply blindly — review first.
-- ============================================================

create extension if not exists pgcrypto;

-- ────────────────────────────────────────────────────────────
-- APPROVAL WORKFLOWS  (per-tenant reusable approval templates)
--   module = entity_type key: change_order | pay_app |
--            purchase_order | invoice
--   steps  = jsonb array of
--            { order, name, approverType, approverValue,
--              required, autoApproveThreshold, conditionalMinAmount }
-- ────────────────────────────────────────────────────────────
create table if not exists public.approval_workflows (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   uuid        not null,
  name        text        not null,
  module      text        not null,   -- entity_type key (change_order|pay_app|purchase_order|invoice)
  steps       jsonb       not null default '[]'::jsonb,
  active      boolean     not null default true,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- extend if the table pre-existed without these columns
alter table public.approval_workflows add column if not exists created_by uuid;
alter table public.approval_workflows add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_approval_workflows_tenant
  on public.approval_workflows (tenant_id, module, active);

-- ────────────────────────────────────────────────────────────
-- APPROVAL REQUESTS  (a live workflow instance for one entity)
--   Tracks how far a given entity has progressed through its
--   chain. entity_type + entity_id link to the real record.
-- ────────────────────────────────────────────────────────────
create table if not exists public.approval_requests (
  id             uuid        primary key default gen_random_uuid(),
  tenant_id      uuid        not null,
  workflow_id    uuid,
  workflow_name  text,
  module         text,                 -- entity_type key
  entity_type    text,                 -- change_order | pay_app | purchase_order | invoice
  entity_id      uuid,                 -- FK-by-value to the real record
  project_id     uuid,
  item_name      text,
  item_amount    numeric(14,2),
  requested_by   text,
  requested_at   timestamptz not null default now(),
  current_step   integer     not null default 0,
  total_steps    integer     not null default 1,
  status         text        not null default 'pending'
    check (status in ('pending','approved','rejected')),
  history        jsonb       not null default '[]'::jsonb,
  created_at     timestamptz not null default now()
);
-- extend if the table pre-existed without the entity-linkage columns
alter table public.approval_requests add column if not exists entity_type text;
alter table public.approval_requests add column if not exists entity_id   uuid;
alter table public.approval_requests add column if not exists project_id  uuid;

create index if not exists idx_approval_requests_tenant
  on public.approval_requests (tenant_id, status);
create unique index if not exists uq_approval_requests_entity
  on public.approval_requests (tenant_id, entity_type, entity_id)
  where entity_type is not null and entity_id is not null;

-- ────────────────────────────────────────────────────────────
-- APPROVAL DECISIONS  (immutable audit row per approve/reject)
--   NEW table. Keyed to the request AND directly to the entity
--   so decisions can be recorded even for entities that predate
--   the workflow engine.
-- ────────────────────────────────────────────────────────────
create table if not exists public.approval_decisions (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    uuid        not null,
  request_id   uuid,                       -- nullable: not every entity has a tracked request row
  entity_type  text        not null,
  entity_id    uuid        not null,
  step         integer     not null default 1,
  decision     text        not null check (decision in ('approved','rejected')),
  decided_by   text,                       -- approver email / user id
  note         text,
  decided_at   timestamptz not null default now()
);

create index if not exists idx_approval_decisions_tenant
  on public.approval_decisions (tenant_id, decided_at desc);
create index if not exists idx_approval_decisions_entity
  on public.approval_decisions (tenant_id, entity_type, entity_id);

-- ────────────────────────────────────────────────────────────
-- APPROVAL DELEGATIONS  (route my approvals to a delegate)
-- ────────────────────────────────────────────────────────────
create table if not exists public.approval_delegations (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   uuid        not null,
  from_user   text        not null,
  to_user     text        not null,
  start_date  date        not null,
  end_date    date        not null,
  reason      text,
  active      boolean     not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists idx_approval_delegations_tenant
  on public.approval_delegations (tenant_id, active);

-- ────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY  (tenant isolation; matches repo convention)
-- ────────────────────────────────────────────────────────────
alter table public.approval_workflows   enable row level security;
alter table public.approval_requests    enable row level security;
alter table public.approval_decisions   enable row level security;
alter table public.approval_delegations enable row level security;

create policy if not exists "tenant members manage approval workflows"
  on public.approval_workflows for all
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy if not exists "tenant members manage approval requests"
  on public.approval_requests for all
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy if not exists "tenant members manage approval decisions"
  on public.approval_decisions for all
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy if not exists "tenant members manage approval delegations"
  on public.approval_delegations for all
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
