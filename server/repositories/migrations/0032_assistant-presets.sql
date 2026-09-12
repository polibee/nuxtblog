CREATE TABLE `ai_assistant_presets` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`name` varchar(80) NOT NULL,
	`slug` varchar(80) NOT NULL,
	`description` varchar(200) NOT NULL DEFAULT '',
	`icon` varchar(40) NOT NULL DEFAULT 'sparkles',
	`type` varchar(20) NOT NULL DEFAULT 'custom',
	`instructions` text NOT NULL DEFAULT (''),
	`default_scope` varchar(30) NOT NULL DEFAULT 'site',
	`default_depth` varchar(20) NOT NULL DEFAULT 'balanced',
	`allowed_tool_groups_json` text,
	`allowed_scopes_json` text,
	`suggested_questions_json` text,
	`enabled` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`prompt_version` int NOT NULL DEFAULT 1,
	`created_by` bigint,
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `ai_assistant_presets_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_assistant_presets_slug_idx` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE INDEX `ai_assistant_presets_enabled_idx` ON `ai_assistant_presets` (`enabled`,`sort_order`);