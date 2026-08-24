-- 066: drawing_review_links — read-only owner/architect share links (B4).
--
-- A staff member mints a token-gated link for one drawing (optionally one
-- drawing_sheets row). The public portal page resolves the token through the
-- service role only: RLS is enabled with NO policies, so anon/authed clients
-- can never read or write these rows directly.
--
-- Guests are READ-ONLY this wave — the table carries no can_markup flag on
-- purpose (honest scope: no guest markup creation exists yet).

create table if not exists drawing_review_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  project_id uuid not null,
  drawing_id uuid,
  drawing_sheet_id uuid,
  token text unique not null,
  label text,
  created_by uuid,
  created_at timestamptz default now(),
  expires_at timestamptz,
  revoked_at timestamptz
);

-- token lookups are the hot path for the public portal; the unique constraint
-- already indexes token. These cover the staff list/revoke queries.
create index if not exists idx_drawing_review_links_drawing
  on drawing_review_links (drawing_id) where drawing_id is not null;
create index if not exists idx_drawing_review_links_tenant
  on drawing_review_links (tenant_id);

-- Server-role only: RLS on, zero policies.
alter table drawing_review_links enable row level security;
