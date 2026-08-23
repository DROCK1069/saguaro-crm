-- 064_sage_brain.sql
-- SAGE BRAIN OVERHAUL (R16-R19): transparent style profiles, consent-first
-- automation rules, and the Sage activity trail.
-- All server access goes through the service-role client; RLS mirrors the
-- own-row pattern established in 027_sage_v6.sql so authenticated direct reads
-- (if ever used) stay scoped.

-- ─────────────────────────────────────────────────────────────────────────────
-- R16: Transparent per-user communication style profile.
-- Computed from the user's REAL content inside the platform, stored visibly,
-- editable and toggleable in Sage's own settings surface. profile_text is the
-- EXACT text injected into Sage's system prompt — full honesty, no hidden model.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sage_style_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL UNIQUE,
  tenant_id       UUID,
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  -- Descriptive dimensions, each 1-10 (5 = neutral). Shown to the user as-is.
  brevity         INTEGER NOT NULL DEFAULT 5 CHECK (brevity BETWEEN 1 AND 10),
  formality       INTEGER NOT NULL DEFAULT 5 CHECK (formality BETWEEN 1 AND 10),
  emoji_use       INTEGER NOT NULL DEFAULT 1 CHECK (emoji_use BETWEEN 1 AND 10),
  directness      INTEGER NOT NULL DEFAULT 5 CHECK (directness BETWEEN 1 AND 10),
  technical_depth INTEGER NOT NULL DEFAULT 5 CHECK (technical_depth BETWEEN 1 AND 10),
  humor           INTEGER NOT NULL DEFAULT 1 CHECK (humor BETWEEN 1 AND 10),
  -- The exact prompt text Sage receives. What you see here is what Sage sees.
  profile_text    TEXT,
  -- Provenance — how the profile was inferred, so the user can judge it.
  sample_count    INTEGER NOT NULL DEFAULT 0,
  sources         TEXT[] DEFAULT '{}',
  user_edited     BOOLEAN NOT NULL DEFAULT FALSE,
  computed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- R18: Consent-first automation rules. Sage only automates under a rule the GC
-- explicitly approved. Every rule is visible and revocable; revoking sets
-- revoked_at (kept for the audit trail) and enabled = false.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sage_automation_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL,
  tenant_id     UUID,
  title         TEXT NOT NULL,
  description   TEXT,
  trigger_type  TEXT NOT NULL,   -- e.g. 'sub_unconfirmed', 'rfi_overdue', 'coi_expiring'
  action_type   TEXT NOT NULL,   -- e.g. 'draft_email', 'draft_message', 'surface_alert'
  config        JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at    TIMESTAMPTZ
);

-- ─────────────────────────────────────────────────────────────────────────────
-- R18: Activity trail. Every Sage auto-action (and every rule/profile change)
-- is logged here and shown in Sage's UI. Nothing Sage does is invisible.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sage_activity_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL,
  tenant_id    UUID,
  rule_id      UUID REFERENCES sage_automation_rules(id) ON DELETE SET NULL,
  actor        TEXT NOT NULL DEFAULT 'sage',  -- 'sage' | 'user'
  action_type  TEXT NOT NULL,                 -- e.g. 'rule_created', 'rule_revoked', 'style_profile_updated', 'draft_offered'
  summary      TEXT NOT NULL,
  detail       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sage_style_user       ON sage_style_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_sage_rules_user       ON sage_automation_rules(user_id, enabled);
CREATE INDEX IF NOT EXISTS idx_sage_activity_user    ON sage_activity_log(user_id, created_at DESC);

ALTER TABLE sage_style_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sage_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE sage_activity_log     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_style_profile" ON sage_style_profiles
  FOR ALL USING (user_id = auth.uid());
CREATE POLICY "own_automation_rules" ON sage_automation_rules
  FOR ALL USING (user_id = auth.uid());
CREATE POLICY "own_activity_log" ON sage_activity_log
  FOR ALL USING (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
