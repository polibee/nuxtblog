-- P16 sidebar card types: link / image-link / js ad code.
-- content (mediumtext) stays the universal payload; these columns hold
-- the structured fields of the new card types.

ALTER TABLE `sidebar_cards` ADD `link_url` varchar(500);
--> statement-breakpoint
ALTER TABLE `sidebar_cards` ADD `image_media_id` bigint;
