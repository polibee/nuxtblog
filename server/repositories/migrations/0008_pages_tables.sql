CREATE TABLE `page_translations` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`page_id` bigint NOT NULL,
	`locale_id` bigint NOT NULL,
	`title` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`content` mediumtext NOT NULL,
	`seo_title` varchar(255) NOT NULL DEFAULT '',
	`seo_description` varchar(500) NOT NULL DEFAULT '',
	`canonical_url` varchar(500),
	`noindex` boolean NOT NULL DEFAULT false,
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `page_translations_id` PRIMARY KEY(`id`),
	CONSTRAINT `page_translations_page_locale_key` UNIQUE(`page_id`,`locale_id`),
	CONSTRAINT `page_translations_locale_slug_key` UNIQUE(`locale_id`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `pages` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`primary_locale_id` bigint NOT NULL,
	`author_id` bigint NOT NULL,
	`template` varchar(40) NOT NULL DEFAULT 'default',
	`status` varchar(20) NOT NULL DEFAULT 'draft',
	`published_at` datetime(6),
	`deleted_at` datetime(6),
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `pages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `post_translations` MODIFY COLUMN `content` mediumtext NOT NULL;--> statement-breakpoint
ALTER TABLE `page_translations` ADD CONSTRAINT `page_translations_page_id_fk` FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `page_translations` ADD CONSTRAINT `page_translations_locale_id_fk` FOREIGN KEY (`locale_id`) REFERENCES `locales`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pages` ADD CONSTRAINT `pages_primary_locale_id_fk` FOREIGN KEY (`primary_locale_id`) REFERENCES `locales`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pages` ADD CONSTRAINT `pages_author_id_fk` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `page_translations_locale_idx` ON `page_translations` (`locale_id`);--> statement-breakpoint
CREATE INDEX `pages_status_idx` ON `pages` (`status`);--> statement-breakpoint
CREATE INDEX `pages_author_idx` ON `pages` (`author_id`);