CREATE TABLE `friend_link_categories` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`slug` varchar(60) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime(6) NOT NULL,
	CONSTRAINT `friend_link_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `friend_link_categories_slug_idx` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `friend_link_category_translations` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`category_id` bigint NOT NULL,
	`locale_id` bigint NOT NULL,
	`name` varchar(60) NOT NULL,
	`created_at` datetime(6) NOT NULL,
	CONSTRAINT `friend_link_category_translations_id` PRIMARY KEY(`id`),
	CONSTRAINT `friend_link_cat_tr_key` UNIQUE(`category_id`,`locale_id`)
);
--> statement-breakpoint
CREATE TABLE `friend_link_checks` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`friend_link_id` bigint NOT NULL,
	`check_type` varchar(20) NOT NULL,
	`status` varchar(20) NOT NULL,
	`http_status` int,
	`found_url` varchar(500),
	`details_json` mediumtext,
	`checked_at` datetime(6) NOT NULL,
	CONSTRAINT `friend_link_checks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `friend_link_submissions` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`site_name` varchar(120) NOT NULL,
	`site_url` varchar(500) NOT NULL,
	`normalized_url` varchar(500) NOT NULL,
	`domain` varchar(200) NOT NULL,
	`description` varchar(500) NOT NULL DEFAULT '',
	`logo_url` varchar(500),
	`contact_name` varchar(80),
	`contact_email` varchar(200),
	`backlink_url` varchar(500),
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`backlink_status` varchar(20) NOT NULL DEFAULT 'unknown',
	`backlink_checked_at` datetime(6),
	`backlink_found_url` varchar(500),
	`site_status` varchar(20) NOT NULL DEFAULT 'unknown',
	`site_http_status` int,
	`site_title_detected` varchar(300),
	`reviewer_id` bigint,
	`reviewed_at` datetime(6),
	`rejection_reason` varchar(300),
	`admin_note` varchar(500),
	`submit_ip_hash` varchar(64),
	`user_agent` varchar(300),
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `friend_link_submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `friend_links` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`url` varchar(500) NOT NULL,
	`normalized_url` varchar(500) NOT NULL,
	`domain` varchar(200) NOT NULL,
	`description` varchar(500) NOT NULL DEFAULT '',
	`logo_media_id` bigint,
	`external_logo_url` varchar(500),
	`category_id` bigint,
	`status` varchar(20) NOT NULL DEFAULT 'active',
	`featured` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`backlink_required` boolean NOT NULL DEFAULT false,
	`backlink_status` varchar(20) NOT NULL DEFAULT 'unknown',
	`backlink_url` varchar(500),
	`backlink_last_checked_at` datetime(6),
	`backlink_last_found_at` datetime(6),
	`backlink_failure_count` int NOT NULL DEFAULT 0,
	`nofollow` boolean NOT NULL DEFAULT false,
	`open_in_new_tab` boolean NOT NULL DEFAULT true,
	`source` varchar(20) NOT NULL DEFAULT 'admin',
	`submission_id` bigint,
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	`deleted_at` datetime(6),
	CONSTRAINT `friend_links_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `friend_link_cat_tr_locale_idx` ON `friend_link_category_translations` (`locale_id`);--> statement-breakpoint
CREATE INDEX `friend_link_checks_link_idx` ON `friend_link_checks` (`friend_link_id`,`checked_at`);--> statement-breakpoint
CREATE INDEX `friend_link_subs_status_idx` ON `friend_link_submissions` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `friend_link_subs_domain_idx` ON `friend_link_submissions` (`domain`);--> statement-breakpoint
CREATE INDEX `friend_links_status_idx` ON `friend_links` (`status`,`sort_order`);--> statement-breakpoint
CREATE INDEX `friend_links_domain_idx` ON `friend_links` (`domain`);