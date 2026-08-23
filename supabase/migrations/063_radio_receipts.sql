-- 063_radio_receipts.sql — Saguaro Radio heard-by receipts (Task R13).
--
-- Two pieces:
--   1. radio_receipts — one row per (message, listener, action). action
--      'played' = the member's device finished playing the voice clip (or a
--      dispatcher clicked play on the console). 'seen' is reserved for text/
--      alert read receipts.
--   2. radio_messages.present_at_send — a jsonb snapshot, stamped fire-and-
--      forget right after a transmission lands, of who was live on the channel
--      (radio_members.last_seen_at within 90s) at send time:
--      [{ "user_id": ..., "portal_sub_id": ..., "name": ... }, ...]
--
-- Every reader/writer in the API is written tolerantly: until this migration
-- is applied, receipts queries fail silently and the UI simply shows no
-- heard-by data. Applying this turns the feature on with no deploy.

create table if not exists radio_receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  channel_id uuid not null references radio_channels(id) on delete cascade,
  message_id uuid not null references radio_messages(id) on delete cascade,
  user_id uuid,
  portal_sub_id text,
  display_name text,
  action text not null default 'played' check (action in ('played', 'seen')),
  created_at timestamptz not null default now()
);

-- One receipt per listener per message per action (staff and portal-sub
-- identities dedupe separately; partial indexes because either id may be null).
create unique index if not exists radio_receipts_msg_user_action
  on radio_receipts (message_id, user_id, action) where user_id is not null;
create unique index if not exists radio_receipts_msg_sub_action
  on radio_receipts (message_id, portal_sub_id, action) where portal_sub_id is not null;

-- The messages GET enriches a page of rows with one IN (...) query.
create index if not exists radio_receipts_message_idx
  on radio_receipts (message_id);
create index if not exists radio_receipts_channel_created_idx
  on radio_receipts (tenant_id, channel_id, created_at desc);

-- Server-only table: the API talks to it through the service-role client.
-- RLS on with no policies = anon/authenticated clients can't touch it.
alter table radio_receipts enable row level security;

-- Presence snapshot at send time (who could have heard it live).
alter table radio_messages add column if not exists present_at_send jsonb;
