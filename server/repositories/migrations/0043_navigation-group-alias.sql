SET @navigation_alias_migration_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `navigation_item_translations` ADD COLUMN `alias` VARCHAR(120) NULL AFTER `label`',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'navigation_item_translations'
    AND column_name = 'alias'
);--> statement-breakpoint
PREPARE navigation_alias_migration_stmt FROM @navigation_alias_migration_sql;--> statement-breakpoint
EXECUTE navigation_alias_migration_stmt;--> statement-breakpoint
DEALLOCATE PREPARE navigation_alias_migration_stmt;
