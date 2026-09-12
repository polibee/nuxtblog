CREATE TABLE `event_outbox` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`event_name` varchar(60) NOT NULL,
	`module` varchar(30) NOT NULL DEFAULT '',
	`severity` varchar(20) NOT NULL DEFAULT 'info',
	`entity_type` varchar(40),
	`entity_id` varchar(120),
	`payload_json` mediumtext NOT NULL,
	`dedupe_key` varchar(150),
	`suppressed_count` int NOT NULL DEFAULT 0,
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`occurred_at` datetime(6) NOT NULL,
	`processed_at` datetime(6),
	`created_at` datetime(6) NOT NULL,
	CONSTRAINT `event_outbox_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notification_channels` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`name` varchar(80) NOT NULL,
	`provider` varchar(20) NOT NULL,
	`config_encrypted` text NOT NULL,
	`config_hint` varchar(200) NOT NULL DEFAULT '',
	`enabled` boolean NOT NULL DEFAULT true,
	`created_by` bigint,
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `notification_channels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notification_deliveries` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`outbox_id` bigint NOT NULL,
	`subscription_id` bigint NOT NULL,
	`channel_id` bigint NOT NULL,
	`provider` varchar(20) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`attempt_count` int NOT NULL DEFAULT 0,
	`response_status` int,
	`response_summary` varchar(500),
	`last_error` varchar(500),
	`next_retry_at` datetime(6),
	`sent_at` datetime(6),
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `notification_deliveries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notification_subscription_events` (
	`subscription_id` bigint NOT NULL,
	`event_name` varchar(60) NOT NULL,
	CONSTRAINT `notification_subscription_events_subscription_id_event_name_pk` PRIMARY KEY(`subscription_id`,`event_name`)
);
--> statement-breakpoint
CREATE TABLE `notification_subscriptions` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`name` varchar(80) NOT NULL,
	`channel_id` bigint NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`minimum_severity` varchar(20),
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `notification_subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `event_outbox_status_idx` ON `event_outbox` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `event_outbox_dedupe_idx` ON `event_outbox` (`dedupe_key`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `notification_channels_provider_idx` ON `notification_channels` (`provider`,`enabled`);--> statement-breakpoint
CREATE INDEX `notification_del_status_idx` ON `notification_deliveries` (`status`,`next_retry_at`);--> statement-breakpoint
CREATE INDEX `notification_del_outbox_idx` ON `notification_deliveries` (`outbox_id`);--> statement-breakpoint
CREATE INDEX `notification_sub_events_name_idx` ON `notification_subscription_events` (`event_name`);--> statement-breakpoint
CREATE INDEX `notification_subs_channel_idx` ON `notification_subscriptions` (`channel_id`,`enabled`);