CREATE TABLE `locales` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`code` varchar(20) NOT NULL,
	`name` varchar(80) NOT NULL,
	`native_name` varchar(80) NOT NULL,
	`url_prefix` varchar(20),
	`enabled` boolean NOT NULL DEFAULT true,
	`content_enabled` boolean NOT NULL DEFAULT false,
	`ui_enabled` boolean NOT NULL DEFAULT false,
	`is_default` boolean NOT NULL DEFAULT false,
	`default_flag` bigint GENERATED ALWAYS AS (if(`is_default`, 1, null)) VIRTUAL,
	`fallback_locale_id` bigint,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `locales_id` PRIMARY KEY(`id`),
	CONSTRAINT `locales_code_key` UNIQUE(`code`),
	CONSTRAINT `locales_url_prefix_key` UNIQUE(`url_prefix`),
	CONSTRAINT `locales_default_flag_key` UNIQUE(`default_flag`)
);
--> statement-breakpoint
CREATE INDEX `locales_enabled_idx` ON `locales` (`enabled`);--> statement-breakpoint
CREATE INDEX `locales_sort_idx` ON `locales` (`sort_order`);