-- P14 backup: job history for created full-site backups
CREATE TABLE `backup_jobs` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'completed',
	`file_key` varchar(200),
	`file_size` bigint,
	`manifest_version` varchar(20),
	`includes_media` boolean NOT NULL DEFAULT true,
	`created_by` bigint,
	`error` text,
	`started_at` datetime(6) NOT NULL,
	`completed_at` datetime(6),
	`created_at` datetime(6) NOT NULL,
	CONSTRAINT `backup_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `backup_jobs_created_idx` ON `backup_jobs` (`created_at`);
