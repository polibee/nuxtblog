CREATE TABLE `slider_item_translations` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`slider_item_id` bigint NOT NULL,
	`locale_id` int NOT NULL,
	`title` varchar(200),
	`description` varchar(500),
	`button_text` varchar(50),
	`link_url` varchar(500),
	`alt_text` varchar(300) NOT NULL DEFAULT '',
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `slider_item_translations_id` PRIMARY KEY(`id`),
	CONSTRAINT `slider_item_translations_item_locale_key` UNIQUE(`slider_item_id`,`locale_id`)
);
--> statement-breakpoint
CREATE TABLE `slider_items` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`slider_id` bigint NOT NULL,
	`image_media_id` bigint NOT NULL,
	`mobile_image_media_id` bigint,
	`link_url` varchar(500),
	`link_target` varchar(10) NOT NULL DEFAULT 'self',
	`enabled` boolean NOT NULL DEFAULT true,
	`starts_at` datetime(6),
	`ends_at` datetime(6),
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `slider_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sliders` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`key` varchar(100) NOT NULL,
	`name` varchar(120) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`autoplay` boolean NOT NULL DEFAULT true,
	`interval_ms` int NOT NULL DEFAULT 5000,
	`transition` varchar(20) NOT NULL DEFAULT 'slide',
	`show_arrows` boolean NOT NULL DEFAULT true,
	`show_indicators` boolean NOT NULL DEFAULT true,
	`pause_on_hover` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `sliders_id` PRIMARY KEY(`id`),
	CONSTRAINT `sliders_key_key` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE INDEX `slider_items_slider_idx` ON `slider_items` (`slider_id`,`sort_order`);
