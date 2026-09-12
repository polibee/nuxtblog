CREATE TABLE `navigation_item_translations` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`item_id` bigint NOT NULL,
	`locale_id` bigint NOT NULL,
	`label` varchar(120) NOT NULL,
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `navigation_item_translations_id` PRIMARY KEY(`id`),
	CONSTRAINT `navigation_item_translations_item_locale_key` UNIQUE(`item_id`,`locale_id`)
);
--> statement-breakpoint
CREATE TABLE `navigation_items` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`navigation_id` bigint NOT NULL,
	`parent_id` bigint,
	`sort_order` int NOT NULL DEFAULT 0,
	`type` varchar(20) NOT NULL DEFAULT 'custom',
	`reference_id` bigint,
	`url` varchar(500),
	`enabled` boolean NOT NULL DEFAULT true,
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `navigation_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `navigations` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`key` varchar(40) NOT NULL,
	`name` varchar(80) NOT NULL,
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `navigations_id` PRIMARY KEY(`id`),
	CONSTRAINT `navigations_key_key` UNIQUE(`key`)
);
--> statement-breakpoint
ALTER TABLE `navigation_item_translations` ADD CONSTRAINT `navigation_item_translations_item_id_fk` FOREIGN KEY (`item_id`) REFERENCES `navigation_items`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `navigation_item_translations` ADD CONSTRAINT `navigation_item_translations_locale_id_fk` FOREIGN KEY (`locale_id`) REFERENCES `locales`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `navigation_items` ADD CONSTRAINT `navigation_items_navigation_id_fk` FOREIGN KEY (`navigation_id`) REFERENCES `navigations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `navigation_items` ADD CONSTRAINT `navigation_items_parent_id_fk` FOREIGN KEY (`parent_id`) REFERENCES `navigation_items`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `navigation_item_translations_locale_idx` ON `navigation_item_translations` (`locale_id`);--> statement-breakpoint
CREATE INDEX `navigation_items_navigation_idx` ON `navigation_items` (`navigation_id`);--> statement-breakpoint
CREATE INDEX `navigation_items_parent_idx` ON `navigation_items` (`parent_id`);