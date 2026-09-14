CREATE TABLE `author_card_translations` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `card_id` bigint NOT NULL,
  `locale_id` bigint NOT NULL,
  `display_name` varchar(50) NOT NULL,
  `headline` varchar(80) NOT NULL DEFAULT '',
  `bio` mediumtext NOT NULL,
  `cta_label` varchar(30) NOT NULL DEFAULT '',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `author_card_translations_card_locale_key` (`card_id`, `locale_id`),
  KEY `author_card_translations_locale_idx` (`locale_id`),
  CONSTRAINT `author_card_translations_card_id_fk` FOREIGN KEY (`card_id`) REFERENCES `sidebar_cards` (`id`) ON DELETE CASCADE,
  CONSTRAINT `author_card_translations_locale_id_fk` FOREIGN KEY (`locale_id`) REFERENCES `locales` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
INSERT INTO `author_card_translations` (`card_id`, `locale_id`, `display_name`, `headline`, `bio`, `cta_label`)
SELECT sc.`id`, l.`id`,
  COALESCE(JSON_UNQUOTE(JSON_EXTRACT(sc.`config`, '$.displayName')), 'Author'),
  COALESCE(JSON_UNQUOTE(JSON_EXTRACT(sc.`config`, '$.headline')), ''),
  COALESCE(JSON_UNQUOTE(JSON_EXTRACT(sc.`config`, '$.bio')), ''),
  COALESCE(JSON_UNQUOTE(JSON_EXTRACT(sc.`config`, '$.cta.label')), '')
FROM `sidebar_cards` sc
JOIN `locales` l ON l.`is_default` = 1
WHERE sc.`type` = 'author'
  AND sc.`config` IS NOT NULL;
