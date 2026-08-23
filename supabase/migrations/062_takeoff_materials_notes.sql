-- R2: GC notes on takeoff line items (applied live 2026-08-22 via MCP)
ALTER TABLE takeoff_materials ADD COLUMN IF NOT EXISTS notes text;
