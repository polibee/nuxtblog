CREATE TABLE `ai_conversations` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`user_id` bigint,
	`title` varchar(120) NOT NULL DEFAULT '',
	`scope_type` varchar(30) NOT NULL DEFAULT 'site',
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `ai_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_messages` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`conversation_id` bigint NOT NULL,
	`role` varchar(20) NOT NULL,
	`content` mediumtext NOT NULL,
	`references_json` mediumtext,
	`created_at` datetime(6) NOT NULL,
	CONSTRAINT `ai_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_tool_calls` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`conversation_id` bigint NOT NULL,
	`tool` varchar(80) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'ok',
	`duration_ms` int,
	`created_at` datetime(6) NOT NULL,
	CONSTRAINT `ai_tool_calls_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `author_certifications` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`issuer` varchar(120) NOT NULL DEFAULT '',
	`date_issued` varchar(40) NOT NULL DEFAULT '',
	`url` varchar(500),
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `author_certifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `author_education` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`school` varchar(120) NOT NULL,
	`program` varchar(120) NOT NULL DEFAULT '',
	`period` varchar(60) NOT NULL DEFAULT '',
	`details` varchar(500) NOT NULL DEFAULT '',
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `author_education_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `author_experiences` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`role` varchar(120) NOT NULL,
	`organization` varchar(120) NOT NULL DEFAULT '',
	`period` varchar(60) NOT NULL DEFAULT '',
	`current` boolean NOT NULL DEFAULT false,
	`location` varchar(120) NOT NULL DEFAULT '',
	`description` text,
	`url` varchar(500),
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `author_experiences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `author_focus_items` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`text` varchar(200) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `author_focus_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `author_page_sections` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`type` varchar(40) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`config` json,
	CONSTRAINT `author_page_sections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `author_profile` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`display_name` varchar(80) NOT NULL,
	`headline` varchar(120) NOT NULL DEFAULT '',
	`bio` text,
	`avatar_media_id` bigint,
	`location` varchar(120) NOT NULL DEFAULT '',
	`hero_config` json,
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `author_profile_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `author_projects` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text,
	`image_media_id` bigint,
	`url` varchar(500),
	`github_url` varchar(500),
	`tags` varchar(300) NOT NULL DEFAULT '',
	`featured` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `author_projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `author_skills` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`group_name` varchar(60) NOT NULL DEFAULT '',
	`name` varchar(80) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `author_skills_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `author_social_channels` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`platform` varchar(30) NOT NULL,
	`url` varchar(500) NOT NULL,
	`handle` varchar(120) NOT NULL DEFAULT '',
	`description` varchar(300) NOT NULL DEFAULT '',
	`show_in_sidebar` boolean NOT NULL DEFAULT true,
	`show_in_hero` boolean NOT NULL DEFAULT true,
	`show_in_social` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime(6) NOT NULL,
	CONSTRAINT `author_social_channels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ai_conversations_user_idx` ON `ai_conversations` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `ai_messages_conversation_idx` ON `ai_messages` (`conversation_id`,`id`);--> statement-breakpoint
CREATE INDEX `ai_tool_calls_conversation_idx` ON `ai_tool_calls` (`conversation_id`);