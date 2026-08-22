-- Public tokenized invoice view (vendors never hit the login wall) + one-time
-- money normalization: total was a client-computed column that many write
-- paths left at DEFAULT 0 while amount carried the real figure.
-- (Applied live 2026-08-22 via MCP; kept here as the record.)
alter table invoices add column if not exists public_token uuid not null default gen_random_uuid();
create unique index if not exists invoices_public_token_idx on invoices (public_token);
update invoices set total = coalesce(amount, 0) + coalesce(tax, 0)
  where (total is null or total = 0) and coalesce(amount, 0) > 0;
update invoices set status = lower(status) where status is not null and status <> lower(status);
