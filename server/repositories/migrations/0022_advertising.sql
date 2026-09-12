-- P17 advertising (commerce/monetization doc §8 + Nuxt full-stack impl doc).
-- Slots are page placeholders; placements bind slot↔campaign; creatives
-- carry provider + multilingual content. membership_plans.features holds
-- machine feature flags (["ad_free"]) consumed by the Decision Service.

CREATE TABLE `ad_slots` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`key` varchar(60) NOT NULL,
	`name` varchar(120) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `ad_slots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ad_slots_key_key` ON `ad_slots` (`key`);
--> statement-breakpoint
CREATE TABLE `ad_campaigns` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'draft',
	`start_at` datetime(6),
	`end_at` datetime(6),
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `ad_campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ad_creatives` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`campaign_id` bigint NOT NULL,
	`provider` varchar(30) NOT NULL DEFAULT 'image',
	`weight` int NOT NULL DEFAULT 1,
	`impressions` int NOT NULL DEFAULT 0,
	`clicks` int NOT NULL DEFAULT 0,
	`enabled` boolean NOT NULL DEFAULT true,
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `ad_creatives_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `ad_creatives` ADD CONSTRAINT `ad_creatives_campaign_id_fk` FOREIGN KEY (`campaign_id`) REFERENCES `ad_campaigns`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
CREATE INDEX `ad_creatives_campaign_idx` ON `ad_creatives` (`campaign_id`);
--> statement-breakpoint
CREATE TABLE `ad_creative_translations` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`creative_id` bigint NOT NULL,
	`locale_id` bigint NOT NULL,
	`title` varchar(200) NOT NULL,
	`content` mediumtext,
	`button_text` varchar(100),
	`image_id` bigint,
	`target_url` varchar(500),
	`alt_text` varchar(200),
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `ad_creative_translations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ad_creative_translations_creative_locale_key` ON `ad_creative_translations` (`creative_id`,`locale_id`);
--> statement-breakpoint
ALTER TABLE `ad_creative_translations` ADD CONSTRAINT `ad_creative_translations_creative_id_fk` FOREIGN KEY (`creative_id`) REFERENCES `ad_creatives`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
CREATE TABLE `ad_placements` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`slot_key` varchar(60) NOT NULL,
	`campaign_id` bigint NOT NULL,
	`priority` int NOT NULL DEFAULT 0,
	`enabled` boolean NOT NULL DEFAULT true,
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `ad_placements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ad_placements_slot_idx` ON `ad_placements` (`slot_key`,`enabled`);
--> statement-breakpoint
ALTER TABLE `ad_placements` ADD CONSTRAINT `ad_placements_campaign_id_fk` FOREIGN KEY (`campaign_id`) REFERENCES `ad_campaigns`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE `membership_plans` ADD `features` text;
