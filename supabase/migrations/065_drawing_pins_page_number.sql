-- 065: drawing_pins gains page_number for multi-page PDF sheets.
-- Mirror of the migration already applied to the live database (B1 markup
-- contract): pins on a multi-page drawing record the 1-based page they sit on;
-- null for single-image drawings.
alter table drawing_pins add column if not exists page_number integer;
