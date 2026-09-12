-- Navigation module v2 (docs/Blog-Framework-navigation-menu-design.md §6):
-- replaces the flat menu tables with the four-table model:
-- navigations (locations) -> navigation_variants (per-locale versions)
-- -> navigation_items (variant-scoped tree, entity references)
-- -> navigation_item_translations (labels, per-locale custom urls).
-- Old navigation tables only ever held seed data, so dropping them is safe.

DROP TABLE IF EXISTS `navigation_item_translations`;--> statement-breakpoint
DROP TABLE IF EXISTS `navigation_items`;--> statement-breakpoint
DROP TABLE IF EXISTS `navigations`;--> statement-breakpoint
CREATE TABLE `navigations` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`key` varchar(40) NOT NULL,
	`location` varchar(20) NOT NULL,
	`admin_name` varchar(80) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `navigations_id` PRIMARY KEY(`id`),
	CONSTRAINT `navigations_key_key` UNIQUE(`key`),
	CONSTRAINT `navigations_location_key` UNIQUE(`location`)
);
--> statement-breakpoint
CREATE TABLE `navigation_variants` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`navigation_id` bigint NOT NULL,
	`locale_id` bigint NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'published',
	`is_default` boolean NOT NULL DEFAULT false,
	`default_flag` bigint GENERATED ALWAYS AS (if(`is_default`, `navigation_id`, null)) VIRTUAL,
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `navigation_variants_id` PRIMARY KEY(`id`),
	CONSTRAINT `navigation_variants_navigation_locale_key` UNIQUE(`navigation_id`,`locale_id`),
	CONSTRAINT `navigation_variants_default_flag_key` UNIQUE(`default_flag`)
);
--> statement-breakpoint
CREATE TABLE `navigation_items` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`navigation_variant_id` bigint NOT NULL,
	`parent_id` bigint,
	`type` varchar(20) NOT NULL DEFAULT 'custom',
	`target_entity_type` varchar(20),
	`target_entity_id` bigint,
	`sort_order` int NOT NULL DEFAULT 0,
	`enabled` boolean NOT NULL DEFAULT true,
	`open_in_new_tab` boolean NOT NULL DEFAULT false,
	`rel` varchar(100),
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `navigation_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `navigation_item_translations` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`navigation_item_id` bigint NOT NULL,
	`locale_id` bigint NOT NULL,
	`label` varchar(120) NOT NULL,
	`custom_url` varchar(500),
	`title_attribute` varchar(255),
	`nofollow` boolean NOT NULL DEFAULT false,
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `navigation_item_translations_id` PRIMARY KEY(`id`),
	CONSTRAINT `navigation_item_translations_item_locale_key` UNIQUE(`navigation_item_id`,`locale_id`)
);
--> statement-breakpoint
ALTER TABLE `navigation_variants` ADD CONSTRAINT `navigation_variants_navigation_id_fk` FOREIGN KEY (`navigation_id`) REFERENCES `navigations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `navigation_variants` ADD CONSTRAINT `navigation_variants_locale_id_fk` FOREIGN KEY (`locale_id`) REFERENCES `locales`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `navigation_items` ADD CONSTRAINT `navigation_items_variant_id_fk` FOREIGN KEY (`navigation_variant_id`) REFERENCES `navigation_variants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `navigation_items` ADD CONSTRAINT `navigation_items_parent_id_fk` FOREIGN KEY (`parent_id`) REFERENCES `navigation_items`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `navigation_item_translations` ADD CONSTRAINT `navigation_item_translations_item_id_fk` FOREIGN KEY (`navigation_item_id`) REFERENCES `navigation_items`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `navigation_item_translations` ADD CONSTRAINT `navigation_item_translations_locale_id_fk` FOREIGN KEY (`locale_id`) REFERENCES `locales`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `navigation_variants_locale_idx` ON `navigation_variants` (`locale_id`);--> statement-breakpoint
CREATE INDEX `navigation_items_variant_idx` ON `navigation_items` (`navigation_variant_id`);--> statement-breakpoint
CREATE INDEX `navigation_items_parent_idx` ON `navigation_items` (`parent_id`);--> statement-breakpoint
CREATE INDEX `navigation_item_translations_locale_idx` ON `navigation_item_translations` (`locale_id`);
