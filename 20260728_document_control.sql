-- ============================================================================
-- Document Version Control  (page: /app/document-versions)
-- ----------------------------------------------------------------------------
-- Real backing tables for the Document Version Control module.
--
-- NAMING NOTE: the literal names `documents` and `document_versions` ALREADY
-- EXIST in this database with a DIFFERENT, incompatible shape:
--   * public.documents           -> (user_id, title, content jsonb, ...)   [legacy note-store]
--   * public.document_versions   -> (source_type, source_id, doc_type,
--                                     html_content, ...)                    [generated-doc / AIA versioning]
-- Reusing those names would collide with live tables and other modules, so
-- this module uses the collision-free `document_control*` namespace instead.
--
-- STORAGE: reuses the existing PRIVATE `documents` bucket (public=false).
-- Objects are stored tenant-prefixed:  <tenant_id>/document-control/<doc>/<ts>-<name>
-- Reads are served via short-lived createSignedUrl (never getPublicUrl).
--
-- Apply in the Supabase SQL editor / migration runner. Idempotent.
-- ============================================================================

-- ── document_control : the document register (one row per logical document) ──
create table if not exists public.document_control (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null,
  project_id         uuid references public.projects(id) on delete set null,
  name               text not null,
  description        text,
  category           text not null default 'Uncategorized',
  tags               text[] not null default '{}',
  current_version    integer not null default 0,
  status             text not null default 'Draft',   -- Draft | Under Review | Approved | Superseded
  checked_out_by     uuid,                             -- profiles.id holding the lock; null = available
  checked_out_by_name text,
  checked_out_at     timestamptz,
  created_by         uuid,
  created_by_name    text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ── document_control_versions : immutable version history (one row per upload) ──
create table if not exists public.document_control_versions (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null,
  document_id        uuid not null references public.document_control(id) on delete cascade,
  version            integer not null,
  file_name          text not null,
  file_path          text not null,                   -- object key in the private `documents` bucket
  file_size          bigint,
  file_type          text,
  uploaded_by        uuid,
  uploaded_by_name   text,
  notes              text,
  checksum           text,                            -- sha-256 hex of the uploaded bytes
  status             text not null default 'Draft',   -- Draft | Under Review | Approved | Superseded
  approved_by        text,
  approved_at        timestamptz,
  created_at         timestamptz not null default now(),
  unique (document_id, version)
);

-- ── document_control_grants : per-document access control ─────────────────────
create table if not exists public.document_control_grants (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null,
  document_id        uuid not null references public.document_control(id) on delete cascade,
  grantee            text not null,                   -- name or email
  role               text not null default 'viewer',  -- viewer | editor | admin
  created_by         uuid,
  created_at         timestamptz not null default now(),
  unique (document_id, grantee)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
create index if not exists idx_doc_control_tenant       on public.document_control (tenant_id);
create index if not exists idx_doc_control_project      on public.document_control (project_id);
create index if not exists idx_doc_control_ver_doc      on public.document_control_versions (document_id);
create index if not exists idx_doc_control_ver_tenant   on public.document_control_versions (tenant_id);
create index if not exists idx_doc_control_grant_doc    on public.document_control_grants (document_id);
create index if not exists idx_doc_control_grant_tenant on public.document_control_grants (tenant_id);

-- ── updated_at trigger ────────────────────────────────────────────────────────
create or replace function public.document_control_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_document_control_touch on public.document_control;
create trigger trg_document_control_touch
  before update on public.document_control
  for each row execute function public.document_control_touch_updated_at();

-- ── Row Level Security (tenant-scoped; mirrors the takeoff/core modules) ──────
alter table public.document_control          enable row level security;
alter table public.document_control_versions enable row level security;
alter table public.document_control_grants   enable row level security;

create policy if not exists "tenant members manage document_control"
  on public.document_control for all
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy if not exists "tenant members manage document_control_versions"
  on public.document_control_versions for all
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy if not exists "tenant members manage document_control_grants"
  on public.document_control_grants for all
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- NOTE: the API layer uses the service-role key (createServerClient), which
-- bypasses RLS; every query there is explicitly `.eq('tenant_id', user.tenantId)`.
-- These policies protect any direct anon/authenticated (e.g. mobile RLS) access.
