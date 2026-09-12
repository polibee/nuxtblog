CREATE TABLE `post_translations` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`post_id` bigint NOT NULL,
	`locale_id` bigint NOT NULL,
	`title` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`excerpt` varchar(500) NOT NULL DEFAULT '',
	`content` mediumtext NOT NULL,
	`seo_title` varchar(255) NOT NULL DEFAULT '',
	`seo_description` varchar(500) NOT NULL DEFAULT '',
	`canonical_url` varchar(500),
	`noindex` bigint NOT NULL DEFAULT false,
	`featured_image_id` bigint,
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `post_translations_id` PRIMARY KEY(`id`),
	CONSTRAINT `post_translations_post_locale_key` UNIQUE(`post_id`,`locale_id`),
	CONSTRAINT `post_translations_locale_slug_key` UNIQUE(`locale_id`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`primary_locale_id` bigint NOT NULL,
	`author_id` bigint NOT NULL,
	`featured_media_id` bigint,
	`access_type` varchar(20) NOT NULL DEFAULT 'public',
	`status` varchar(20) NOT NULL DEFAULT 'draft',
	`published_at` datetime(6),
	`scheduled_at` datetime(6),
	`comment_status` varchar(20) NOT NULL DEFAULT 'closed',
	`deleted_at` datetime(6),
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `category_translations` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`entity_id` bigint NOT NULL,
	`locale_id` bigint NOT NULL,
	`name` varchar(120) NOT NULL,
	`slug` varchar(160) NOT NULL,
	`description` varchar(500) NOT NULL DEFAULT '',
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `category_translations_id` PRIMARY KEY(`id`),
	CONSTRAINT `category_translations_entity_locale_key` UNIQUE(`entity_id`,`locale_id`),
	CONSTRAINT `category_translations_locale_slug_key` UNIQUE(`locale_id`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `post_categories` (
	`post_id` bigint NOT NULL,
	`category_id` bigint NOT NULL,
	CONSTRAINT `post_categories_post_id_category_id_pk` PRIMARY KEY(`post_id`,`category_id`)
);
--> statement-breakpoint
CREATE TABLE `post_tags` (
	`post_id` bigint NOT NULL,
	`tag_id` bigint NOT NULL,
	CONSTRAINT `post_tags_post_id_tag_id_pk` PRIMARY KEY(`post_id`,`tag_id`)
);
--> statement-breakpoint
CREATE TABLE `tag_translations` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`entity_id` bigint NOT NULL,
	`locale_id` bigint NOT NULL,
	`name` varchar(120) NOT NULL,
	`slug` varchar(160) NOT NULL,
	`description` varchar(500) NOT NULL DEFAULT '',
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `tag_translations_id` PRIMARY KEY(`id`),
	CONSTRAINT `tag_translations_entity_locale_key` UNIQUE(`entity_id`,`locale_id`),
	CONSTRAINT `tag_translations_locale_slug_key` UNIQUE(`locale_id`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `tags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `post_translations` ADD CONSTRAINT `post_translations_post_id_fk` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `post_translations` ADD CONSTRAINT `post_translations_locale_id_fk` FOREIGN KEY (`locale_id`) REFERENCES `locales`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `post_translations` ADD CONSTRAINT `post_translations_featured_image_id_fk` FOREIGN KEY (`featured_image_id`) REFERENCES `media`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `posts` ADD CONSTRAINT `posts_primary_locale_id_fk` FOREIGN KEY (`primary_locale_id`) REFERENCES `locales`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `posts` ADD CONSTRAINT `posts_author_id_fk` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `posts` ADD CONSTRAINT `posts_featured_media_id_fk` FOREIGN KEY (`featured_media_id`) REFERENCES `media`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `category_translations` ADD CONSTRAINT `category_translations_category_id_fk` FOREIGN KEY (`entity_id`) REFERENCES `categories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `category_translations` ADD CONSTRAINT `category_translations_locale_id_fk` FOREIGN KEY (`locale_id`) REFERENCES `locales`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `post_categories` ADD CONSTRAINT `post_categories_post_id_fk` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `post_categories` ADD CONSTRAINT `post_categories_category_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `post_tags` ADD CONSTRAINT `post_tags_post_id_fk` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `post_tags` ADD CONSTRAINT `post_tags_tag_id_fk` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tag_translations` ADD CONSTRAINT `tag_translations_tag_id_fk` FOREIGN KEY (`entity_id`) REFERENCES `tags`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tag_translations` ADD CONSTRAINT `tag_translations_locale_id_fk` FOREIGN KEY (`locale_id`) REFERENCES `locales`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `post_translations_locale_idx` ON `post_translations` (`locale_id`);--> statement-breakpoint
CREATE INDEX `posts_status_idx` ON `posts` (`status`);--> statement-breakpoint
CREATE INDEX `posts_published_at_idx` ON `posts` (`published_at`);--> statement-breakpoint
CREATE INDEX `posts_author_idx` ON `posts` (`author_id`);--> statement-breakpoint
CREATE INDEX `posts_primary_locale_idx` ON `posts` (`primary_locale_id`);--> statement-breakpoint
CREATE INDEX `category_translations_locale_idx` ON `category_translations` (`locale_id`);--> statement-breakpoint
CREATE INDEX `post_categories_category_idx` ON `post_categories` (`category_id`);--> statement-breakpoint
CREATE INDEX `post_tags_tag_idx` ON `post_tags` (`tag_id`);--> statement-breakpoint
CREATE INDEX `tag_translations_locale_idx` ON `tag_translations` (`locale_id`);