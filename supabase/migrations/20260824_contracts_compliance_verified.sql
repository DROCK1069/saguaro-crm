-- Contracts: give the compliance checkboxes somewhere to live.
--
-- app/field/contracts/page.tsx has "Insurance verified" / "Bonding verified"
-- toggles that PATCHed insurance_verified / bonding_verified. Neither column
-- existed, so PostgREST rejected the write, the page's catch swallowed it, and
-- the toggle stayed flipped on screen over a record that never changed.
--
-- Additive, defaulted, idempotent.

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS insurance_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS bonding_verified   boolean DEFAULT false;
