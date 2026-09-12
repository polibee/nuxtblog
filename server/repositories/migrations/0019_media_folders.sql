-- Media folders (P15): admin-managed categories for the media library.
-- media.folder_id is nullable (uncategorised) and has no FK constraint
-- so deleting a folder never orphans or blocks media rows.

CREATE TABLE `media_folders` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`name` varchar(80) NOT NULL,
	`created_at` datetime(6) NOT NULL,
	CONSTRAINT `media_folders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `media` ADD `folder_id` bigint;
