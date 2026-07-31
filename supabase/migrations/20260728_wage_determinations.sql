-- ============================================================
-- Saguaro CRM — Prevailing Wage Determinations (make-it-real)
-- Migration: 20260728_wage_determinations.sql
--
-- Reference data table powering the Prevailing Wage Calculator
-- (app/app/compliance/prevailing-wage) and the WH-347 certified
-- payroll rate assist (app/app/projects/[projectId]/payroll).
--
-- tenant_id is NULLABLE on purpose:
--   * tenant_id IS NULL  -> shared reference schedule (Davis-Bacon
--                           style seed, readable by every tenant)
--   * tenant_id = <uuid> -> a tenant's own CUSTOM determination,
--                           which overrides a seed row of the same
--                           state/county/determination/classification.
--
-- Reads go through the service-role client (bypasses RLS); the RLS
-- policies below still enforce that, over the anon client, tenants
-- can read the shared seed + their own rows and only WRITE their own.
--
-- DO NOT auto-apply blindly — review first.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.wage_determinations (
  id                   uuid          primary key default gen_random_uuid(),
  tenant_id            uuid,                              -- NULL = shared reference; non-null = tenant custom
  state                text          not null,            -- two-letter code, uppercase (AZ, CA, TX...)
  county               text,                              -- NULL = statewide determination
  determination_number text,                              -- e.g. AZ20240012
  effective_date       date,
  classification       text          not null,            -- trade / labor classification
  base_rate            numeric(10,2) not null default 0,  -- cash hourly wage floor
  fringe_rate          numeric(10,2) not null default 0,  -- hourly fringe benefit
  created_at           timestamptz   not null default now()
);

-- Lookups are (state [, county] [, classification]) — the calculator's access path.
create index if not exists idx_wage_determinations_lookup
  on public.wage_determinations (state, county, classification);
create index if not exists idx_wage_determinations_tenant
  on public.wage_determinations (tenant_id);

-- ────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
--   READ : shared reference rows (tenant_id IS NULL) + own tenant.
--   WRITE: own tenant rows only — the shared seed is never writable
--          from the app (service-role migrations manage it).
-- ────────────────────────────────────────────────────────────
alter table public.wage_determinations enable row level security;

create policy if not exists "read wage determinations (reference + own tenant)"
  on public.wage_determinations for select
  using (
    tenant_id is null
    or tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

create policy if not exists "tenant members insert own wage determinations"
  on public.wage_determinations for insert
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy if not exists "tenant members update own wage determinations"
  on public.wage_determinations for update
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy if not exists "tenant members delete own wage determinations"
  on public.wage_determinations for delete
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ============================================================
-- SEED — shared reference schedule (tenant_id NULL).
-- Idempotent: clears the seeded states' reference rows first so a
-- re-run refreshes rather than duplicates. Tenant custom rows
-- (tenant_id NOT NULL) are untouched.
-- Rates are realistic Davis-Bacon-style base + fringe by state/county.
-- ============================================================
delete from public.wage_determinations
  where tenant_id is null and state in ('AZ','CA','TX');

insert into public.wage_determinations
  (tenant_id, state, county, determination_number, effective_date, classification, base_rate, fringe_rate)
values
  -- ── ARIZONA — Maricopa County (AZ20240012, eff 2024-01-05) ──
  (null, 'AZ', 'Maricopa', 'AZ20240012', '2024-01-05', 'Laborer',            22.50,  9.75),
  (null, 'AZ', 'Maricopa', 'AZ20240012', '2024-01-05', 'Carpenter',          28.65, 14.23),
  (null, 'AZ', 'Maricopa', 'AZ20240012', '2024-01-05', 'Electrician',        36.14, 16.45),
  (null, 'AZ', 'Maricopa', 'AZ20240012', '2024-01-05', 'Plumber',            34.87, 15.92),
  (null, 'AZ', 'Maricopa', 'AZ20240012', '2024-01-05', 'Ironworker',         33.42, 22.10),
  (null, 'AZ', 'Maricopa', 'AZ20240012', '2024-01-05', 'Operating Engineer', 31.20, 16.80),
  (null, 'AZ', 'Maricopa', 'AZ20240012', '2024-01-05', 'Cement Mason',       27.50, 14.50),
  (null, 'AZ', 'Maricopa', 'AZ20240012', '2024-01-05', 'Painter',            24.80, 13.20),
  (null, 'AZ', 'Maricopa', 'AZ20240012', '2024-01-05', 'Roofer',             26.30, 14.70),
  (null, 'AZ', 'Maricopa', 'AZ20240012', '2024-01-05', 'Sheet Metal Worker', 35.60, 21.40),
  -- ── ARIZONA — Pima County (AZ20240015, eff 2024-01-05) ──
  (null, 'AZ', 'Pima', 'AZ20240015', '2024-01-05', 'Laborer',            21.80,  9.40),
  (null, 'AZ', 'Pima', 'AZ20240015', '2024-01-05', 'Carpenter',          27.90, 13.85),
  (null, 'AZ', 'Pima', 'AZ20240015', '2024-01-05', 'Electrician',        34.90, 15.80),
  (null, 'AZ', 'Pima', 'AZ20240015', '2024-01-05', 'Plumber',            33.60, 15.10),
  (null, 'AZ', 'Pima', 'AZ20240015', '2024-01-05', 'Ironworker',         32.20, 21.30),
  (null, 'AZ', 'Pima', 'AZ20240015', '2024-01-05', 'Operating Engineer', 30.40, 16.10),
  (null, 'AZ', 'Pima', 'AZ20240015', '2024-01-05', 'Cement Mason',       26.80, 14.00),

  -- ── CALIFORNIA — Los Angeles County (CA20240045, eff 2024-02-01) ──
  (null, 'CA', 'Los Angeles', 'CA20240045', '2024-02-01', 'Laborer',            34.71, 24.13),
  (null, 'CA', 'Los Angeles', 'CA20240045', '2024-02-01', 'Carpenter',          43.85, 27.60),
  (null, 'CA', 'Los Angeles', 'CA20240045', '2024-02-01', 'Electrician',        52.30, 29.85),
  (null, 'CA', 'Los Angeles', 'CA20240045', '2024-02-01', 'Plumber',            51.90, 30.10),
  (null, 'CA', 'Los Angeles', 'CA20240045', '2024-02-01', 'Ironworker',         45.20, 33.75),
  (null, 'CA', 'Los Angeles', 'CA20240045', '2024-02-01', 'Operating Engineer', 48.60, 29.40),
  (null, 'CA', 'Los Angeles', 'CA20240045', '2024-02-01', 'Cement Mason',       41.15, 28.90),
  (null, 'CA', 'Los Angeles', 'CA20240045', '2024-02-01', 'Painter',            38.40, 24.10),
  (null, 'CA', 'Los Angeles', 'CA20240045', '2024-02-01', 'Roofer',             39.70, 22.85),
  (null, 'CA', 'Los Angeles', 'CA20240045', '2024-02-01', 'Sheet Metal Worker', 49.80, 34.20),
  -- ── CALIFORNIA — Alameda County (CA20240061, eff 2024-02-01) ──
  (null, 'CA', 'Alameda', 'CA20240061', '2024-02-01', 'Laborer',            37.20, 26.40),
  (null, 'CA', 'Alameda', 'CA20240061', '2024-02-01', 'Carpenter',          47.90, 29.10),
  (null, 'CA', 'Alameda', 'CA20240061', '2024-02-01', 'Electrician',        58.75, 33.20),
  (null, 'CA', 'Alameda', 'CA20240061', '2024-02-01', 'Plumber',            57.40, 34.55),
  (null, 'CA', 'Alameda', 'CA20240061', '2024-02-01', 'Ironworker',         49.80, 36.10),
  (null, 'CA', 'Alameda', 'CA20240061', '2024-02-01', 'Operating Engineer', 52.10, 31.80),
  (null, 'CA', 'Alameda', 'CA20240061', '2024-02-01', 'Cement Mason',       44.30, 30.20),

  -- ── TEXAS — Harris County (TX20240033, eff 2024-01-15) ──
  (null, 'TX', 'Harris', 'TX20240033', '2024-01-15', 'Laborer',            16.85,  6.20),
  (null, 'TX', 'Harris', 'TX20240033', '2024-01-15', 'Carpenter',          21.40,  8.65),
  (null, 'TX', 'Harris', 'TX20240033', '2024-01-15', 'Electrician',        28.90, 11.30),
  (null, 'TX', 'Harris', 'TX20240033', '2024-01-15', 'Plumber',            27.75, 10.85),
  (null, 'TX', 'Harris', 'TX20240033', '2024-01-15', 'Ironworker',         24.60, 12.40),
  (null, 'TX', 'Harris', 'TX20240033', '2024-01-15', 'Operating Engineer', 25.30,  9.90),
  (null, 'TX', 'Harris', 'TX20240033', '2024-01-15', 'Cement Mason',       20.15,  8.10),
  (null, 'TX', 'Harris', 'TX20240033', '2024-01-15', 'Painter',            18.90,  7.25),
  (null, 'TX', 'Harris', 'TX20240033', '2024-01-15', 'Roofer',             17.60,  5.80),
  (null, 'TX', 'Harris', 'TX20240033', '2024-01-15', 'Sheet Metal Worker', 26.40, 12.10),
  -- ── TEXAS — Travis County (TX20240041, eff 2024-01-15) ──
  (null, 'TX', 'Travis', 'TX20240041', '2024-01-15', 'Laborer',            17.40,  6.55),
  (null, 'TX', 'Travis', 'TX20240041', '2024-01-15', 'Carpenter',          22.10,  8.95),
  (null, 'TX', 'Travis', 'TX20240041', '2024-01-15', 'Electrician',        30.20, 11.85),
  (null, 'TX', 'Travis', 'TX20240041', '2024-01-15', 'Plumber',            29.10, 11.20),
  (null, 'TX', 'Travis', 'TX20240041', '2024-01-15', 'Ironworker',         25.30, 12.80),
  (null, 'TX', 'Travis', 'TX20240041', '2024-01-15', 'Operating Engineer', 26.00, 10.20),
  (null, 'TX', 'Travis', 'TX20240041', '2024-01-15', 'Cement Mason',       20.80,  8.35);
