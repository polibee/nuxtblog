CREATE TABLE IF NOT EXISTS `author_profile_translations` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `profile_id` bigint NOT NULL,
  `locale_id` bigint NOT NULL,
  `display_name` varchar(80) NOT NULL,
  `headline` varchar(120) NOT NULL DEFAULT '',
  `bio` text,
  `location` varchar(120) NOT NULL DEFAULT '',
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `author_profile_translations_profile_locale_key` (`profile_id`, `locale_id`)
) ENGINE=InnoDB;
