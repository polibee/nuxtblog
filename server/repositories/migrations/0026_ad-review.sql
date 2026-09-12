ALTER TABLE `ad_campaigns` ADD `material_title` varchar(200);--> statement-breakpoint
ALTER TABLE `ad_campaigns` ADD `material_description` varchar(500);--> statement-breakpoint
ALTER TABLE `ad_campaigns` ADD `material_image_media_id` bigint;--> statement-breakpoint
ALTER TABLE `ad_campaigns` ADD `material_url` varchar(500);--> statement-breakpoint
ALTER TABLE `ad_campaigns` ADD `material_slot_key` varchar(60);--> statement-breakpoint
ALTER TABLE `ad_campaigns` ADD `contact_email` varchar(255);--> statement-breakpoint
ALTER TABLE `ad_campaigns` ADD `review_note` varchar(500);