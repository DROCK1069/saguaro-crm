-- 029_approval_workflows.sql
-- Persistence backend for the Approval Workflows page
-- (app/app/approval-workflows/page.tsx).
--
-- Three tenant-scoped tables:
--   approval_workflows   — reusable multi-step approval chain templates
--   approval_requests    — in-flight / decided approval items routed through a workflow
--   approval_delegations — out-of-office delegation of approval authority
--
-- Idempotent: safe to re-run.

-- ── approval_workflows ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS approval_workflows (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  name        text NOT NULL,
  module      text,
  -- array of steps:
  --   { order, name, approverType, approverValue, required,
  --     autoApproveThreshold, conditionalMinAmount }
  steps       jsonb NOT NULL DEFAULT '[]'::jsonb,
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_workflows_tenant_id
  ON approval_workflows (tenant_id);

-- ── approval_requests ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS approval_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  workflow_id   uuid,
  workflow_name text,
  module        text,
  item_name     text,
  item_amount   numeric,
  requested_by  text,
  requested_at  timestamptz NOT NULL DEFAULT now(),
  current_step  int NOT NULL DEFAULT 1,
  total_steps   int NOT NULL DEFAULT 1,
  status        text NOT NULL DEFAULT 'pending',
  -- decision trail: [{ action, decidedBy, decidedAt, comment }]
  history       jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_tenant_id
  ON approval_requests (tenant_id);

-- ── approval_delegations ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS approval_delegations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  from_user   text,
  to_user     text,
  start_date  date,
  end_date    date,
  reason      text,
  active      boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_delegations_tenant_id
  ON approval_delegations (tenant_id);
