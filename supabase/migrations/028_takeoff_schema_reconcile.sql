-- 028_takeoff_schema_reconcile.sql
--
-- Reconciles the repo migrations with the LIVE Saguaro CRM takeoff schema.
--
-- Why this exists: the takeoff tables the application code actually queries
-- (takeoffs, takeoff_materials, takeoff_projects, takeoff_line_items,
-- takeoff_sheets, takeoff_measurements, takeoff_assemblies) were hand-patched
-- into the live DB out-of-band and had NO matching CREATE TABLE in the repo.
-- Earlier migrations (010_takeoffs.sql, 013_takeoff_columns.sql) cover only
-- `takeoffs`; an abandoned migration described a different schema
-- (takeoff_material_lines / takeoff_labor_lines / takeoff_blueprints) that the
-- code never uses. This file makes a fresh `supabase db reset` produce the
-- schema that lib/database.types.ts and the API routes expect.
--
-- Everything here is idempotent (IF NOT EXISTS) so it is a safe no-op against
-- the already-patched live database and only does real work on a clean reset.

-- ──────────────────────────────────────────────────────────────────────────
-- AI takeoff system (REAL, in use): takeoffs + takeoff_materials
--   `takeoffs` is created by 010_takeoffs.sql / extended by 013; here we only
--   guarantee the columns the analyze/upload/export routes depend on exist.
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.takeoffs ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE IF EXISTS public.takeoffs ADD COLUMN IF NOT EXISTS storage_path text;
ALTER TABLE IF EXISTS public.takeoffs ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE IF EXISTS public.takeoffs ADD COLUMN IF NOT EXISTS page_count integer;
ALTER TABLE IF EXISTS public.takeoffs ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE TABLE IF NOT EXISTS public.takeoff_materials (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  takeoff_id    uuid NOT NULL,
  tenant_id     uuid,
  csi_division  text DEFAULT ''::text,
  csi_code      text NOT NULL DEFAULT ''::text,
  csi_name      text NOT NULL DEFAULT ''::text,
  description   text NOT NULL DEFAULT ''::text,
  quantity      numeric NOT NULL DEFAULT 0,
  unit          text NOT NULL DEFAULT 'LS'::text,
  unit_cost     numeric NOT NULL DEFAULT 0,
  total_cost    numeric NOT NULL DEFAULT 0,
  labor_hours   numeric NOT NULL DEFAULT 0,
  labor_unit_cost numeric DEFAULT 0,
  total_material_cost numeric DEFAULT 0,
  total_labor_cost numeric DEFAULT 0,
  sell_price    numeric DEFAULT 0,
  crew_size     integer DEFAULT 2,
  duration_days numeric DEFAULT 1,
  is_subcontractor boolean DEFAULT false,
  recommendation text DEFAULT ''::text,
  alternative_material text DEFAULT ''::text,
  alternative_savings numeric DEFAULT 0,
  confidence_score integer DEFAULT 80,
  notes         text DEFAULT ''::text,
  sort_order    integer DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_takeoff_materials_takeoff ON public.takeoff_materials(takeoff_id);

-- ──────────────────────────────────────────────────────────────────────────
-- Manual takeoff / estimate system: takeoff_projects + takeoff_line_items +
-- takeoff_sheets + takeoff_measurements + takeoff_assemblies
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.takeoff_projects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  project_id      uuid NOT NULL,
  name            text NOT NULL DEFAULT 'New Takeoff'::text,
  description     text,
  status          text DEFAULT 'in_progress'::text,
  total_cost      numeric DEFAULT 0,
  material_cost   numeric DEFAULT 0,
  labor_cost      numeric DEFAULT 0,
  equipment_cost  numeric DEFAULT 0,
  overhead_pct    numeric DEFAULT 10,
  profit_pct      numeric DEFAULT 12,
  contingency_pct numeric DEFAULT 5,
  sell_price      numeric DEFAULT 0,
  gross_margin    numeric DEFAULT 0,
  version         integer DEFAULT 1,
  locked          boolean DEFAULT false,
  locked_at       timestamptz,
  locked_by       uuid,
  notes           text,
  created_by      uuid,
  user_id         uuid,
  trial_id        uuid,
  project_type    text DEFAULT 'ground_up'::text,
  site_address    text,
  site_city       text,
  site_state      text,
  total_area_sqft numeric,
  total_cost_estimate numeric DEFAULT 0,
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_takeoff_projects_project ON public.takeoff_projects(project_id);
CREATE INDEX IF NOT EXISTS idx_takeoff_projects_tenant  ON public.takeoff_projects(tenant_id);

-- NOTE: line items are keyed by `takeoff_id` (references takeoff_projects.id),
-- NOT `takeoff_project_id`. The API routes filter on takeoff_id.
CREATE TABLE IF NOT EXISTS public.takeoff_line_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  takeoff_id          uuid NOT NULL,
  tenant_id           uuid NOT NULL,
  project_id          uuid,
  csi_division        text,
  csi_code            text,
  csi_description     text,
  description         text NOT NULL DEFAULT ''::text,
  scope_notes         text,
  page_reference      text,
  sheet_number        text,
  spec_section        text,
  quantity            numeric DEFAULT 0,
  unit                text DEFAULT 'LS'::text,
  waste_factor_pct    numeric DEFAULT 0,
  adjusted_quantity   numeric,
  unit_material_cost  numeric DEFAULT 0,
  unit_labor_cost     numeric DEFAULT 0,
  unit_equipment_cost numeric DEFAULT 0,
  unit_sub_cost       numeric DEFAULT 0,
  total_material      numeric,
  total_labor         numeric,
  total_equipment     numeric,
  total_sub           numeric,
  ai_extracted        boolean DEFAULT false,
  ai_confidence       numeric,
  ai_source_text      text,
  manually_edited     boolean DEFAULT false,
  sort_order          integer DEFAULT 0,
  category            text,
  is_allowance        boolean DEFAULT false,
  is_excluded         boolean DEFAULT false,
  notes               text,
  metadata            jsonb,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_takeoff_line_items_takeoff ON public.takeoff_line_items(takeoff_id);
CREATE INDEX IF NOT EXISTS idx_takeoff_line_items_tenant  ON public.takeoff_line_items(tenant_id);
-- Guarantee the FK column exists even if an older migration created the table
-- under a different shape:
ALTER TABLE IF EXISTS public.takeoff_line_items ADD COLUMN IF NOT EXISTS takeoff_id uuid;

-- Sheets ARE keyed by takeoff_project_id (this is correct in the routes).
CREATE TABLE IF NOT EXISTS public.takeoff_sheets (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL,
  takeoff_project_id uuid NOT NULL,
  name               text NOT NULL,
  sheet_number       text,
  discipline         text DEFAULT 'architectural'::text,
  file_url           text,
  thumbnail_url      text,
  page_number        integer DEFAULT 1,
  scale              text DEFAULT 'quarter inch'::text,
  scale_factor       numeric DEFAULT 48,
  width_px           integer,
  height_px          integer,
  sort_order         integer DEFAULT 0,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_takeoff_sheets_project ON public.takeoff_sheets(takeoff_project_id);

-- Measurements link to a line item (line_item_id) and a sheet (sheet_id).
CREATE TABLE IF NOT EXISTS public.takeoff_measurements (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL,
  line_item_id     uuid NOT NULL,
  sheet_id         uuid NOT NULL,
  measurement_type text NOT NULL DEFAULT 'count'::text,
  geometry         jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_value        numeric DEFAULT 0,
  scaled_value     numeric DEFAULT 0,
  unit             text DEFAULT 'EA'::text,
  label            text,
  color            text DEFAULT '#3b82f6'::text,
  blueprint_id     uuid,
  category         text,
  value            numeric,
  unit_cost        numeric,
  points           jsonb,
  polygon          jsonb,
  notes            text,
  trade            text,
  phase            text,
  created_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_takeoff_measurements_line_item ON public.takeoff_measurements(line_item_id);
CREATE INDEX IF NOT EXISTS idx_takeoff_measurements_sheet     ON public.takeoff_measurements(sheet_id);

CREATE TABLE IF NOT EXISTS public.takeoff_assemblies (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL,
  name                text NOT NULL,
  description         text,
  csi_division        text,
  csi_code            text,
  category            text,
  unit                text DEFAULT 'EA'::text,
  default_quantity    numeric DEFAULT 1,
  material_items      jsonb DEFAULT '[]'::jsonb,
  labor_hours         numeric DEFAULT 0,
  labor_rate          numeric DEFAULT 0,
  total_material_cost numeric DEFAULT 0,
  total_labor_cost    numeric DEFAULT 0,
  total_cost          numeric DEFAULT 0,
  is_global           boolean DEFAULT false,
  created_by          uuid,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_takeoff_assemblies_tenant ON public.takeoff_assemblies(tenant_id);
