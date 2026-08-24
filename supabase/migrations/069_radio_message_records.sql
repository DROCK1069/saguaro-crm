-- 069_radio_message_records.sql — TRANSMISSION -> PROJECT RECORD. Applied live 2026-08-24.
--
-- The wedge. Until now the radio was a communication tool that happened to
-- store audio: a super could say "the footing depth is wrong on grid line C"
-- and that fact lived only inside a voice clip nobody would ever find again.
--
-- This table is the two-way link that lets any transmission be promoted, in one
-- tap, into a tracked project record — an RFI, a punch item, a field issue or a
-- daily-log entry — carrying the ORIGINAL AUDIO as evidence. The feed then
-- shows "-> RFI #12" on the transmission, and the record shows the voice
-- recording that produced it. A phone call cannot do this. Neither can a
-- standalone PTT app, because it has no project to file into.
--
-- WHY A JOIN TABLE rather than a source_radio_message_id column on four
-- different tables: one migration, one policy set, and a single transmission
-- may legitimately produce more than one record (a clip can become both a punch
-- item and an RFI).
--
-- HONESTY NOTE recorded at build time: of the 8 voice messages in production,
-- 8 have audio and ZERO have a transcript, because transcription is env-gated
-- on OPENAI_API_KEY which is not configured. The promote flow is therefore
-- built to work with NO transcript — the audio is the evidence and the user
-- types the summary — and the UI says so rather than showing an empty
-- transcript as though a read had failed.

create table if not exists radio_message_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  project_id uuid,
  message_id uuid not null references radio_messages(id) on delete cascade,
  -- text + check, not an enum: adding a target type later is a one-line change.
  record_type text not null check (record_type in ('rfi', 'punch', 'field_issue', 'daily_log')),
  record_id uuid not null,
  -- Label captured at creation ("RFI #12") so the feed renders its chip without
  -- joining four tables on every poll.
  record_label text,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now()
);

-- Re-promoting the same transmission to the same record is a no-op, not a
-- duplicate chip; the promote route catches this and returns the original.
create unique index if not exists radio_message_records_unique
  on radio_message_records (message_id, record_type, record_id);
-- Forward: what did this transmission become?
create index if not exists radio_message_records_message_idx
  on radio_message_records (message_id);
-- Reverse: which transmission produced this record?
create index if not exists radio_message_records_record_idx
  on radio_message_records (tenant_id, record_type, record_id);

alter table radio_message_records enable row level security;
drop policy if exists rmr_sel on radio_message_records;
create policy rmr_sel on radio_message_records for select to authenticated using (tenant_id = get_tenant_id());
drop policy if exists rmr_ins on radio_message_records;
create policy rmr_ins on radio_message_records for insert to authenticated with check (tenant_id = get_tenant_id());
drop policy if exists rmr_del on radio_message_records;
create policy rmr_del on radio_message_records for delete to authenticated using (tenant_id = get_tenant_id());
drop policy if exists rmr_service on radio_message_records;
create policy rmr_service on radio_message_records for all to service_role using (true) with check (true);
