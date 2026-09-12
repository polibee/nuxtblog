CREATE TABLE `media_variants` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`media_id` bigint NOT NULL,
	`variant` varchar(40) NOT NULL,
	`storage_key` varchar(120) NOT NULL,
	`width` int,
	`height` int,
	`size` bigint NOT NULL DEFAULT 0,
	`format` varchar(10) NOT NULL DEFAULT 'webp',
	`created_at` datetime(6) NOT NULL,
	CONSTRAINT `media_variants_id` PRIMARY KEY(`id`),
	CONSTRAINT `media_variants_media_variant_key` UNIQUE(`media_id`,`variant`)
);
--> statement-breakpoint
ALTER TABLE `media` ADD `usage_type` varchar(40) DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE `media` ADD `hash` varchar(64);--> statement-breakpoint
ALTER TABLE `media_variants` ADD CONSTRAINT `media_variants_media_id_fk` FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `media_variants_media_idx` ON `media_variants` (`media_id`);--> statement-breakpoint
CREATE INDEX `media_usage_idx` ON `media` (`usage_type`);