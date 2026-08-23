-- Radio field telemetry: mic/send failures + OTA identity (applied live 2026-08-22 via MCP)
CREATE TABLE IF NOT EXISTS radio_client_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid,
  stage text NOT NULL,
  message text,
  platform text,
  os_version text,
  runtime text,
  update_id text,
  embedded boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE radio_client_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_radio_client_logs_recent ON radio_client_logs (created_at DESC);
