-- Alias unification (docs/Blog-Framework-alias-unification-implementation-prompt.md §3):
-- entities get a stable English alias; translations lose the public slug.
-- One-time mapping: alias is backfilled from the default-locale (or first)
-- translation slug, then translation slug columns are dropped.

ALTER TABLE `posts` ADD `alias` varchar(120);--> statement-breakpoint
ALTER TABLE `pages` ADD `alias` varchar(120);--> statement-breakpoint
ALTER TABLE `categories` ADD `alias` varchar(120);--> statement-breakpoint
ALTER TABLE `tags` ADD `alias` varchar(120);--> statement-breakpoint
UPDATE `posts` INNER JOIN `post_translations` ON `post_translations`.`post_id` = `posts`.`id` INNER JOIN `locales` ON `locales`.`id` = `post_translations`.`locale_id` AND `locales`.`is_default` = true SET `posts`.`alias` = `post_translations`.`slug`;--> statement-breakpoint
UPDATE `pages` INNER JOIN `page_translations` ON `page_translations`.`page_id` = `pages`.`id` INNER JOIN `locales` ON `locales`.`id` = `page_translations`.`locale_id` AND `locales`.`is_default` = true SET `pages`.`alias` = `page_translations`.`slug`;--> statement-breakpoint
UPDATE `categories` INNER JOIN `category_translations` ON `category_translations`.`entity_id` = `categories`.`id` INNER JOIN `locales` ON `locales`.`id` = `category_translations`.`locale_id` AND `locales`.`is_default` = true SET `categories`.`alias` = `category_translations`.`slug`;--> statement-breakpoint
UPDATE `tags` INNER JOIN `tag_translations` ON `tag_translations`.`entity_id` = `tags`.`id` INNER JOIN `locales` ON `locales`.`id` = `tag_translations`.`locale_id` AND `locales`.`is_default` = true SET `tags`.`alias` = `tag_translations`.`slug`;--> statement-breakpoint
UPDATE `pages` SET `alias` = (SELECT `page_translations`.`slug` FROM `page_translations` WHERE `page_translations`.`page_id` = `pages`.`id` ORDER BY `page_translations`.`id` LIMIT 1) WHERE `pages`.`alias` IS NULL;--> statement-breakpoint
UPDATE `categories` SET `alias` = (SELECT `category_translations`.`slug` FROM `category_translations` WHERE `category_translations`.`entity_id` = `categories`.`id` ORDER BY `category_translations`.`id` LIMIT 1) WHERE `categories`.`alias` IS NULL;--> statement-breakpoint
UPDATE `tags` SET `alias` = (SELECT `tag_translations`.`slug` FROM `tag_translations` WHERE `tag_translations`.`entity_id` = `tags`.`id` ORDER BY `tag_translations`.`id` LIMIT 1) WHERE `tags`.`alias` IS NULL;--> statement-breakpoint
UPDATE `posts` SET `alias` = CONCAT('post-', `id`) WHERE `alias` IS NULL OR `alias` = '';--> statement-breakpoint
UPDATE `pages` SET `alias` = CONCAT('page-', `id`) WHERE `alias` IS NULL OR `alias` = '';--> statement-breakpoint
UPDATE `categories` SET `alias` = CONCAT('category-', `id`) WHERE `alias` IS NULL OR `alias` = '';--> statement-breakpoint
UPDATE `tags` SET `alias` = CONCAT('tag-', `id`) WHERE `alias` IS NULL OR `alias` = '';--> statement-breakpoint
CREATE TABLE `url_redirects` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`entity_type` varchar(20) NOT NULL,
	`entity_id` bigint NOT NULL,
	`locale_id` bigint,
	`old_path` varchar(500) NOT NULL,
	`new_path` varchar(500) NOT NULL,
	`status_code` int NOT NULL DEFAULT 301,
	`created_at` datetime(6) NOT NULL,
	`expires_at` datetime(6),
	CONSTRAINT `url_redirects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `url_redirects_old_path_idx` ON `url_redirects` (`old_path`);--> statement-breakpoint
ALTER TABLE `posts` MODIFY COLUMN `alias` varchar(120) NOT NULL;--> statement-breakpoint
ALTER TABLE `pages` MODIFY COLUMN `alias` varchar(120) NOT NULL;--> statement-breakpoint
ALTER TABLE `categories` MODIFY COLUMN `alias` varchar(120) NOT NULL;--> statement-breakpoint
ALTER TABLE `tags` MODIFY COLUMN `alias` varchar(120) NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `posts_alias_key` ON `posts` (`alias`);--> statement-breakpoint
CREATE UNIQUE INDEX `pages_alias_key` ON `pages` (`alias`);--> statement-breakpoint
CREATE UNIQUE INDEX `categories_alias_key` ON `categories` (`alias`);--> statement-breakpoint
CREATE UNIQUE INDEX `tags_alias_key` ON `tags` (`alias`);--> statement-breakpoint
INSERT INTO `url_redirects` (`entity_type`, `entity_id`, `locale_id`, `old_path`, `new_path`, `status_code`, `created_at`) SELECT 'post', `posts`.`id`, NULL, CONCAT('/posts/', `post_translations`.`slug`), CONCAT('/posts/', `posts`.`alias`), 301, NOW(6) FROM `posts` INNER JOIN `post_translations` ON `post_translations`.`post_id` = `posts`.`id` AND `post_translations`.`locale_id` <> `posts`.`primary_locale_id`;--> statement-breakpoint
INSERT INTO `url_redirects` (`entity_type`, `entity_id`, `locale_id`, `old_path`, `new_path`, `status_code`, `created_at`) SELECT 'page', `pages`.`id`, NULL, CONCAT('/pages/', `page_translations`.`slug`), CONCAT('/pages/', `pages`.`alias`), 301, NOW(6) FROM `pages` INNER JOIN `page_translations` ON `page_translations`.`page_id` = `pages`.`id` WHERE `page_translations`.`slug` <> `pages`.`alias`;--> statement-breakpoint
INSERT INTO `url_redirects` (`entity_type`, `entity_id`, `locale_id`, `old_path`, `new_path`, `status_code`, `created_at`) SELECT 'category', `categories`.`id`, NULL, CONCAT('/category/', `category_translations`.`slug`), CONCAT('/category/', `categories`.`alias`), 301, NOW(6) FROM `categories` INNER JOIN `category_translations` ON `category_translations`.`entity_id` = `categories`.`id` WHERE `category_translations`.`slug` <> `categories`.`alias`;--> statement-breakpoint
INSERT INTO `url_redirects` (`entity_type`, `entity_id`, `locale_id`, `old_path`, `new_path`, `status_code`, `created_at`) SELECT 'tag', `tags`.`id`, NULL, CONCAT('/tag/', `tag_translations`.`slug`), CONCAT('/tag/', `tags`.`alias`), 301, NOW(6) FROM `tags` INNER JOIN `tag_translations` ON `tag_translations`.`entity_id` = `tags`.`id` WHERE `tag_translations`.`slug` <> `tags`.`alias`;--> statement-breakpoint
ALTER TABLE `post_translations` DROP INDEX `post_translations_locale_slug_key`;--> statement-breakpoint
ALTER TABLE `page_translations` DROP INDEX `page_translations_locale_slug_key`;--> statement-breakpoint
ALTER TABLE `category_translations` DROP INDEX `category_translations_locale_slug_key`;--> statement-breakpoint
ALTER TABLE `tag_translations` DROP INDEX `tag_translations_locale_slug_key`;--> statement-breakpoint
ALTER TABLE `post_translations` DROP COLUMN `slug`;--> statement-breakpoint
ALTER TABLE `page_translations` DROP COLUMN `slug`;--> statement-breakpoint
ALTER TABLE `category_translations` DROP COLUMN `slug`;--> statement-breakpoint
ALTER TABLE `tag_translations` DROP COLUMN `slug`;
