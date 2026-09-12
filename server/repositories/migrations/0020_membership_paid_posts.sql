-- P15: membership plans + subscriptions + paid posts.
-- posts: single-purchase price for access_type='paid'.
-- membership_plans: entity + translations per the commerce doc §9.3.
-- subscriptions: one active row per (user, plan); renewed by extending
-- current_period_end. Purchases reuse the order/payment chain via
-- shadow products (product_type 'post_access' | 'membership').

ALTER TABLE `posts` ADD `paid_price_minor` bigint;
--> statement-breakpoint
ALTER TABLE `posts` ADD `paid_currency` varchar(3);
--> statement-breakpoint
CREATE TABLE `membership_plans` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`alias` varchar(120) NOT NULL,
	`price_minor` bigint NOT NULL,
	`currency` varchar(3) NOT NULL,
	`period` varchar(20) NOT NULL DEFAULT 'month',
	`status` varchar(20) NOT NULL DEFAULT 'published',
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `membership_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `membership_plans_alias_key` ON `membership_plans` (`alias`);
--> statement-breakpoint
CREATE TABLE `membership_plan_translations` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`entity_id` bigint NOT NULL,
	`locale_id` bigint NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` varchar(500),
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `membership_plan_translations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `membership_plan_translations_entity_locale_key` ON `membership_plan_translations` (`entity_id`,`locale_id`);
--> statement-breakpoint
ALTER TABLE `membership_plan_translations` ADD CONSTRAINT `membership_plan_translations_entity_id_fk` FOREIGN KEY (`entity_id`) REFERENCES `membership_plans`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`user_id` bigint NOT NULL,
	`plan_id` bigint NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'active',
	`current_period_end` datetime(6) NOT NULL,
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `subscriptions_user_idx` ON `subscriptions` (`user_id`,`status`);
--> statement-breakpoint
CREATE TABLE `post_purchases` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`post_id` bigint NOT NULL,
	`order_id` bigint NOT NULL,
	`user_id` bigint,
	`email` varchar(255) NOT NULL DEFAULT '',
	`purchased_at` datetime(6) NOT NULL,
	CONSTRAINT `post_purchases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `post_purchases_post_idx` ON `post_purchases` (`post_id`,`email`);
