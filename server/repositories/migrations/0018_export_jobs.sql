-- Export jobs (commerce doc §11.3): CSV exports of orders/transactions/
-- inventory summaries with optional date filtering. Files live in the
-- nitro "exports" storage; the row only tracks state and metadata.

CREATE TABLE `export_jobs` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`type` varchar(30) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`date_from` date,
	`date_to` date,
	`row_count` int NOT NULL DEFAULT 0,
	`file_key` varchar(120),
	`error` varchar(500),
	`created_by` bigint NOT NULL,
	`created_at` datetime(6) NOT NULL,
	`completed_at` datetime(6),
	CONSTRAINT `export_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `export_jobs_created_idx` ON `export_jobs` (`created_at`);
