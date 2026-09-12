CREATE TABLE `sidebar_card_translations` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`card_id` bigint NOT NULL,
	`locale_id` bigint NOT NULL,
	`title` varchar(200) NOT NULL,
	`content` mediumtext NOT NULL,
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `sidebar_card_translations_id` PRIMARY KEY(`id`),
	CONSTRAINT `sidebar_card_translations_card_locale_key` UNIQUE(`card_id`,`locale_id`)
);
--> statement-breakpoint
CREATE TABLE `sidebar_cards` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`type` varchar(32) NOT NULL DEFAULT 'html',
	`enabled` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `sidebar_cards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `sidebar_card_translations` ADD CONSTRAINT `sidebar_card_translations_card_id_fk` FOREIGN KEY (`card_id`) REFERENCES `sidebar_cards`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sidebar_card_translations` ADD CONSTRAINT `sidebar_card_translations_locale_id_fk` FOREIGN KEY (`locale_id`) REFERENCES `locales`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `sidebar_card_translations_locale_idx` ON `sidebar_card_translations` (`locale_id`);--> statement-breakpoint
CREATE INDEX `sidebar_cards_enabled_idx` ON `sidebar_cards` (`enabled`);--> statement-breakpoint
CREATE INDEX `sidebar_cards_sort_idx` ON `sidebar_cards` (`sort_order`);