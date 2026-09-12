CREATE TABLE `localized_settings` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`key` varchar(80) NOT NULL,
	`locale_id` bigint NOT NULL,
	`value` mediumtext NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `localized_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `localized_settings_key_locale_key` UNIQUE(`key`,`locale_id`)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`key` varchar(80) NOT NULL,
	`value` mediumtext NOT NULL,
	`type` varchar(20) NOT NULL DEFAULT 'string',
	`group` varchar(40) NOT NULL DEFAULT 'General',
	`is_public` boolean NOT NULL DEFAULT false,
	`description` varchar(255),
	`sort_order` bigint NOT NULL DEFAULT 0,
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `settings_key_key` UNIQUE(`key`)
);
--> statement-breakpoint
ALTER TABLE `localized_settings` ADD CONSTRAINT `localized_settings_locale_id_fk` FOREIGN KEY (`locale_id`) REFERENCES `locales`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `localized_settings_locale_idx` ON `localized_settings` (`locale_id`);--> statement-breakpoint
CREATE INDEX `settings_group_idx` ON `settings` (`group`);