-- Purchase orders: give "issued" a date of its own.
--
-- app/field/purchase-orders/page.tsx has an issue step that stamped an
-- issued_date onto local state only — the column did not exist, so the date
-- vanished on refresh and every date filter ran against created_at (the day the
-- draft was typed, not the day the PO went to the vendor).
--
-- Additive, nullable, idempotent.

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS issued_date date;
