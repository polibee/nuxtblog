-- Product images (optional): reference into the media table.
-- Plain column on purpose: a deleted media row degrades to "no image"
-- (frontend falls back to the built-in placeholder) instead of
-- blocking media deletion with a FK constraint.

ALTER TABLE `products` ADD `image_media_id` bigint;
