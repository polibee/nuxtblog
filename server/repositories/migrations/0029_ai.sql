CREATE TABLE `ai_providers` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`name` varchar(80) NOT NULL,
	`provider_type` varchar(30) NOT NULL DEFAULT 'openai_compatible',
	`base_url` varchar(300) NOT NULL,
	`api_key_encrypted` text,
	`api_key_hint` varchar(60) NOT NULL DEFAULT '',
	`default_model` varchar(100) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `ai_providers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_requests` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`feature` varchar(50) NOT NULL,
	`provider_id` bigint,
	`model` varchar(100) NOT NULL DEFAULT '',
	`status` varchar(20) NOT NULL DEFAULT 'ok',
	`input_tokens` int,
	`output_tokens` int,
	`latency_ms` int,
	`error_code` varchar(80),
	`user_id` bigint,
	`created_at` datetime(6) NOT NULL,
	CONSTRAINT `ai_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ai_providers_enabled_idx` ON `ai_providers` (`enabled`);--> statement-breakpoint
CREATE INDEX `ai_requests_feature_idx` ON `ai_requests` (`feature`,`created_at`);