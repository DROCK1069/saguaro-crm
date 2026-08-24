-- 068_rls_close_open_tables.sql — SECURITY. Applied live 2026-08-24.
--
-- THE HOLE: 16 public tables shipped with row-level security DISABLED and ZERO
-- policies, while the mobile app ships the Supabase anon key (extractable from
-- the bundle) and talks to some of them directly — app/radio.tsx even opens a
-- postgres_changes realtime subscription on radio_messages. Anyone holding that
-- key could read and modify EVERY tenant's data in these tables:
--
--   platform_admins, admin_access_log, tenant_entitlements,
--   radio_channels, radio_members, radio_messages, radio_assists,
--   radio_guest_links, radio_channel_patches, crew_location_pings,
--   work_assignments, safety_plans, learning_events,
--   catalog_items, catalog_vendors, catalog_vendor_prices
--
-- crew_location_pings is where crew members physically are. platform_admins is
-- the admin roster. This is a go-live blocker, not a hardening nicety.
--
-- THE SHAPE OF THE FIX matches the house pattern already used by photos and
-- daily_logs: authenticated => tenant_id = get_tenant_id(); service_role => all
-- (every server route uses the service client, so API behavior is unchanged).
--
-- THE TRAP AVOIDED: all 906 catalog rows have a NULL tenant_id — that IS the
-- shared global catalog every tenant reads. A naive tenant_id = get_tenant_id()
-- policy would have blanked the catalog for every user in the product. Shared
-- rows (tenant_id IS NULL) therefore stay readable, and a tenant can also see
-- its own private items.
--
-- Verified before applying: none of these tables carries an auto-tenant trigger,
-- so the app supplies tenant_id explicitly and the INSERT checks are safe.
--
-- FOLLOW-UP FOR THE OWNER: rotate the Supabase anon key now that the policies
-- are in place — the old key has been in shipped bundles against open tables.

alter table platform_admins enable row level security;
drop policy if exists pa_service on platform_admins;
create policy pa_service on platform_admins for all to service_role using (true) with check (true);

alter table admin_access_log enable row level security;
drop policy if exists aal_service on admin_access_log;
create policy aal_service on admin_access_log for all to service_role using (true) with check (true);

alter table tenant_entitlements enable row level security;
drop policy if exists te_select on tenant_entitlements;
create policy te_select on tenant_entitlements for select to authenticated using (tenant_id = get_tenant_id());
drop policy if exists te_service on tenant_entitlements;
create policy te_service on tenant_entitlements for all to service_role using (true) with check (true);

do $$
declare t text;
begin
  foreach t in array array[
    'radio_channels','radio_members','radio_messages','radio_assists',
    'radio_guest_links','radio_channel_patches','crew_location_pings',
    'work_assignments','safety_plans','learning_events'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_sel', t);
    execute format('create policy %I on %I for select to authenticated using (tenant_id = get_tenant_id())', t || '_sel', t);
    execute format('drop policy if exists %I on %I', t || '_ins', t);
    execute format('create policy %I on %I for insert to authenticated with check (tenant_id = get_tenant_id())', t || '_ins', t);
    execute format('drop policy if exists %I on %I', t || '_upd', t);
    execute format('create policy %I on %I for update to authenticated using (tenant_id = get_tenant_id()) with check (tenant_id = get_tenant_id())', t || '_upd', t);
    execute format('drop policy if exists %I on %I', t || '_del', t);
    execute format('create policy %I on %I for delete to authenticated using (tenant_id = get_tenant_id())', t || '_del', t);
    execute format('drop policy if exists %I on %I', t || '_service', t);
    execute format('create policy %I on %I for all to service_role using (true) with check (true)', t || '_service', t);
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array['catalog_items','catalog_vendors','catalog_vendor_prices'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_sel', t);
    execute format('create policy %I on %I for select to authenticated using (tenant_id is null or tenant_id = get_tenant_id())', t || '_sel', t);
    execute format('drop policy if exists %I on %I', t || '_service', t);
    execute format('create policy %I on %I for all to service_role using (true) with check (true)', t || '_service', t);
  end loop;
end $$;
