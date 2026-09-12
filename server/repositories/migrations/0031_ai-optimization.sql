CREATE TABLE `ai_artifacts` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`entity_type` varchar(40) NOT NULL,
	`entity_id` varchar(120) NOT NULL DEFAULT '',
	`artifact_type` varchar(40) NOT NULL,
	`source_fingerprint` varchar(64) NOT NULL,
	`provider` varchar(60) NOT NULL DEFAULT '',
	`model` varchar(100) NOT NULL DEFAULT '',
	`prompt_id` varchar(60) NOT NULL DEFAULT '',
	`prompt_version` int NOT NULL DEFAULT 1,
	`payload_json` mediumtext NOT NULL,
	`input_tokens` int,
	`output_tokens` int,
	`created_at` datetime(6) NOT NULL,
	`expires_at` datetime(6),
	CONSTRAINT `ai_artifacts_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_artifacts_lookup_idx` UNIQUE(`entity_type`,`entity_id`,`artifact_type`,`source_fingerprint`,`model`,`prompt_version`)
);
--> statement-breakpoint
CREATE TABLE `ai_domain_versions` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`domain` varchar(40) NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `ai_domain_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_domain_versions_domain_idx` UNIQUE(`domain`)
);
--> statement-breakpoint
CREATE TABLE `ai_tool_cache` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`cache_key` varchar(64) NOT NULL,
	`tool_name` varchar(80) NOT NULL,
	`scope` varchar(60) NOT NULL DEFAULT '',
	`data_version` varchar(200) NOT NULL DEFAULT '',
	`payload_json` mediumtext NOT NULL,
	`payload_chars` int NOT NULL DEFAULT 0,
	`created_at` datetime(6) NOT NULL,
	`expires_at` datetime(6),
	CONSTRAINT `ai_tool_cache_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_tool_cache_key_idx` UNIQUE(`cache_key`)
);
--> statement-breakpoint
ALTER TABLE `ai_requests` ADD `cache_status` varchar(40) DEFAULT 'MISS' NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_requests` ADD `cached_input_tokens` int;--> statement-breakpoint
ALTER TABLE `ai_requests` ADD `saved_tokens` int;--> statement-breakpoint
ALTER TABLE `ai_conversations` ADD `summary_text` mediumtext;--> statement-breakpoint
ALTER TABLE `ai_conversations` ADD `summary_until_message_id` bigint;--> statement-breakpoint
CREATE INDEX `ai_artifacts_entity_idx` ON `ai_artifacts` (`entity_type`,`entity_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ai_tool_cache_expires_idx` ON `ai_tool_cache` (`expires_at`);