/* Repair for databases where 0037 was recorded but its comments ALTER did not land. */
CREATE PROCEDURE `__repair_comments_metadata`()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'comments' AND column_name = 'author_url') THEN ALTER TABLE `comments` ADD `author_url` varchar(500); END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'comments' AND column_name = 'gravatar_hash') THEN ALTER TABLE `comments` ADD `gravatar_hash` varchar(32); END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'comments' AND column_name = 'browser_name') THEN ALTER TABLE `comments` ADD `browser_name` varchar(40); END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'comments' AND column_name = 'browser_version') THEN ALTER TABLE `comments` ADD `browser_version` varchar(40); END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'comments' AND column_name = 'os_name') THEN ALTER TABLE `comments` ADD `os_name` varchar(40); END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'comments' AND column_name = 'os_version') THEN ALTER TABLE `comments` ADD `os_version` varchar(40); END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'comments' AND column_name = 'device_type') THEN ALTER TABLE `comments` ADD `device_type` varchar(16); END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'comments' AND column_name = 'ip_hash') THEN ALTER TABLE `comments` ADD `ip_hash` varchar(64); END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'comments' AND column_name = 'moderation_reason') THEN ALTER TABLE `comments` ADD `moderation_reason` varchar(500); END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'comments' AND column_name = 'approved_at') THEN ALTER TABLE `comments` ADD `approved_at` datetime(6); END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'comments' AND column_name = 'approved_by') THEN ALTER TABLE `comments` ADD `approved_by` bigint; END IF;
END;
--> statement-breakpoint
CALL `__repair_comments_metadata`();
--> statement-breakpoint
DROP PROCEDURE `__repair_comments_metadata`;
