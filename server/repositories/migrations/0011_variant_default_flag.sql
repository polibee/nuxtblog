ALTER TABLE `navigation_variants` MODIFY COLUMN `default_flag` bigint GENERATED ALWAYS AS (if(`is_default`, `navigation_id`, null)) VIRTUAL;
