CREATE TABLE `media` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`storage_key` varchar(120) NOT NULL,
	`filename` varchar(255) NOT NULL,
	`mime` varchar(120) NOT NULL DEFAULT 'application/octet-stream',
	`size` bigint NOT NULL DEFAULT 0,
	`width` int,
	`height` int,
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `media_id` PRIMARY KEY(`id`),
	CONSTRAINT `media_storage_key_key` UNIQUE(`storage_key`)
);
--> statement-breakpoint
CREATE TABLE `media_translations` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`media_id` bigint NOT NULL,
	`locale_id` bigint NOT NULL,
	`alt` varchar(255) NOT NULL DEFAULT '',
	`caption` varchar(500) NOT NULL DEFAULT '',
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `media_translations_id` PRIMARY KEY(`id`),
	CONSTRAINT `media_translations_media_locale_key` UNIQUE(`media_id`,`locale_id`)
);
--> statement-breakpoint
ALTER TABLE `settings` MODIFY COLUMN `is_public` boolean NOT NULL;--> statement-breakpoint
ALTER TABLE `media_translations` ADD CONSTRAINT `media_translations_media_id_fk` FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `media_translations` ADD CONSTRAINT `media_translations_locale_id_fk` FOREIGN KEY (`locale_id`) REFERENCES `locales`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `media_filename_idx` ON `media` (`filename`);--> statement-breakpoint
CREATE INDEX `media_translations_locale_idx` ON `media_translations` (`locale_id`);