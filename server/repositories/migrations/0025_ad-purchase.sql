ALTER TABLE `ad_campaigns` ADD `budget_minor` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ad_campaigns` ADD `currency` varchar(8) DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE `ad_campaigns` ADD `paid_amount_minor` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ad_campaigns` ADD `order_id` bigint;--> statement-breakpoint
ALTER TABLE `ad_campaigns` ADD `paid_at` datetime(6);