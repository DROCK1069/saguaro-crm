-- Product image pipeline: real photos land here via admin upload or a pasted
-- manufacturer URL - never fabricated images. (Applied live 2026-08-22.)
alter table catalog_items add column if not exists image_url text;
