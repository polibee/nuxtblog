/* Move legacy single-locale profile values into the locale-aware table.
   The insert is intentionally non-destructive: existing translations win. */
INSERT INTO `author_profile_translations`
  (`profile_id`, `locale_id`, `display_name`, `headline`, `bio`, `location`, `updated_at`)
SELECT
  p.`id`,
  l.`id`,
  p.`display_name`,
  p.`headline`,
  p.`bio`,
  p.`location`,
  CURRENT_TIMESTAMP(6)
FROM `author_profile` p
JOIN `locales` l ON l.`is_default` = 1
LEFT JOIN `author_profile_translations` t
  ON t.`profile_id` = p.`id` AND t.`locale_id` = l.`id`
WHERE t.`id` IS NULL;
