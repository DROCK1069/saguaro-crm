-- Warranty claims: persist the fields the UI has always collected.
--
-- The live `warranty_claims` table was created from a narrower shape than
-- migration 018 described, so app/app/warranty-claims/page.tsx was posting
-- claim_number / category / cost / covered_under_warranty / scheduled_date /
-- reported_date / notes into a route that silently dropped every one of them.
-- The analytics tab then computed "Avg Resolution 0d / Total Cost $0" and a
-- bar chart keyed on the string "undefined" off rows that had no category and
-- no cost. Adding the columns makes the write real and the analytics honest.
--
-- Additive and idempotent: every column is nullable (or defaulted), so existing
-- rows keep working and a re-run is a no-op.

ALTER TABLE public.warranty_claims
  ADD COLUMN IF NOT EXISTS claim_number           text,
  ADD COLUMN IF NOT EXISTS category               text,
  ADD COLUMN IF NOT EXISTS cost                   numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS covered_under_warranty boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS scheduled_date         date,
  ADD COLUMN IF NOT EXISTS reported_date          date,
  ADD COLUMN IF NOT EXISTS notes                  text;

-- claim_number is generated per project (WC-0001, WC-0002, ...); the uniqueness
-- guard is what makes the server-side "max + 1" allocation safe under a race —
-- a colliding insert fails loudly and is retried instead of silently duplicating.
CREATE UNIQUE INDEX IF NOT EXISTS warranty_claims_project_claim_number_key
  ON public.warranty_claims (project_id, claim_number)
  WHERE claim_number IS NOT NULL;
