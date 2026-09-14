/* Repair tables skipped when 0037 was recorded after a partial migration. */
CREATE TABLE IF NOT EXISTS `badges` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `key` varchar(60) NOT NULL,
  `name` varchar(120) NOT NULL,
  `description` varchar(500) NOT NULL DEFAULT '',
  `icon` varchar(60) NOT NULL DEFAULT 'badge',
  `color` varchar(30) NOT NULL DEFAULT 'blue',
  `sort_order` int NOT NULL DEFAULT 0,
  `enabled` boolean NOT NULL DEFAULT TRUE,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `badges_key_key` (`key`)
) ENGINE=InnoDB;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `user_badges` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `badge_id` bigint NOT NULL,
  `source_type` varchar(40) NOT NULL,
  `source_id` bigint,
  `expires_at` datetime(6),
  `granted_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_badges_user_badge_key` (`user_id`, `badge_id`),
  KEY `user_badges_user_idx` (`user_id`),
  KEY `user_badges_badge_idx` (`badge_id`),
  CONSTRAINT `user_badges_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade,
  CONSTRAINT `user_badges_badge_id_fk` FOREIGN KEY (`badge_id`) REFERENCES `badges`(`id`) ON DELETE cascade
) ENGINE=InnoDB;
--> statement-breakpoint
INSERT INTO `badges` (`key`, `name`, `description`, `icon`, `color`, `sort_order`, `enabled`, `created_at`, `updated_at`)
VALUES ('member', 'Member', 'Active membership', 'user', 'blue', 10, TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6)),
  ('vip', 'VIP', 'Active paid membership', 'crown', 'gold', 20, TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6)),
  ('supporter', 'Supporter', 'Paid order supporter', 'heart', 'rose', 30, TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6))
ON DUPLICATE KEY UPDATE `updated_at` = CURRENT_TIMESTAMP(6);
