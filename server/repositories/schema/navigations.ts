import {
  bigint,
  boolean,
  datetime,
  foreignKey,
  index,
  int,
  mysqlTable,
  uniqueIndex,
  varchar
} from 'drizzle-orm/mysql-core'
import { sql } from 'drizzle-orm'
import { locales } from './locales'

/* Navigation module (Blog-Framework-navigation-menu-design.md §6):
   navigations = logical locations (header/footer); navigation_variants
   = per-locale menu versions; items belong to a VARIANT and reference
   entities by id; custom_url lives in the item translation. */

export const navigations = mysqlTable(
  'navigations',
  {
    id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
    key: varchar('key', { length: 40 }).notNull(),
    // header | footer (one logical navigation per location in v1)
    location: varchar('location', { length: 20 }).notNull(),
    adminName: varchar('admin_name', { length: 80 }).notNull(),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: datetime('created_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime('updated_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    uniqueIndex('navigations_key_key').on(table.key),
    uniqueIndex('navigations_location_key').on(table.location)
  ]
)

export const navigationVariants = mysqlTable(
  'navigation_variants',
  {
    id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
    navigationId: bigint('navigation_id', { mode: 'number' }).notNull(),
    localeId: bigint('locale_id', { mode: 'number' }).notNull(),
    // draft | published | disabled (v1 uses published/disabled only)
    status: varchar('status', { length: 20 }).notNull().default('published'),
    isDefault: boolean('is_default').notNull().default(false),
    // at most one default variant per navigation: flag carries navigation_id
    defaultFlag: bigint('default_flag', { mode: 'number' }).generatedAlwaysAs(
      sql`if(\`is_default\`, \`navigation_id\`, null)`
    ),
    createdAt: datetime('created_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime('updated_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    uniqueIndex('navigation_variants_navigation_locale_key').on(table.navigationId, table.localeId),
    uniqueIndex('navigation_variants_default_flag_key').on(table.defaultFlag),
    index('navigation_variants_locale_idx').on(table.localeId),
    foreignKey({
      name: 'navigation_variants_navigation_id_fk',
      columns: [table.navigationId],
      foreignColumns: [navigations.id]
    }).onDelete('cascade'),
    foreignKey({
      name: 'navigation_variants_locale_id_fk',
      columns: [table.localeId],
      foreignColumns: [locales.id]
    }).onDelete('cascade')
  ]
)

export const navigationItems = mysqlTable(
  'navigation_items',
  {
    id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
    navigationVariantId: bigint('navigation_variant_id', { mode: 'number' }).notNull(),
    parentId: bigint('parent_id', { mode: 'number' }),
    // page | post | category | custom
    type: varchar('type', { length: 20 }).notNull().default('custom'),
    targetEntityType: varchar('target_entity_type', { length: 20 }),
    targetEntityId: bigint('target_entity_id', { mode: 'number' }),
    sortOrder: int('sort_order').notNull().default(0),
    enabled: boolean('enabled').notNull().default(true),
    openInNewTab: boolean('open_in_new_tab').notNull().default(false),
    rel: varchar('rel', { length: 100 }),
    createdAt: datetime('created_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime('updated_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    index('navigation_items_variant_idx').on(table.navigationVariantId),
    index('navigation_items_parent_idx').on(table.parentId),
    foreignKey({
      name: 'navigation_items_variant_id_fk',
      columns: [table.navigationVariantId],
      foreignColumns: [navigationVariants.id]
    }).onDelete('cascade'),
    foreignKey({
      name: 'navigation_items_parent_id_fk',
      columns: [table.parentId],
      foreignColumns: [table.id]
    }).onDelete('cascade')
  ]
)

export const navigationItemTranslations = mysqlTable(
  'navigation_item_translations',
  {
    id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
    itemId: bigint('navigation_item_id', { mode: 'number' }).notNull(),
    localeId: bigint('locale_id', { mode: 'number' }).notNull(),
    label: varchar('label', { length: 120 }).notNull(),
    // custom link URL is per-locale (variant locale enforced by service)
    customUrl: varchar('custom_url', { length: 500 }),
    titleAttribute: varchar('title_attribute', { length: 255 }),
    nofollow: boolean('nofollow').notNull().default(false),
    createdAt: datetime('created_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime('updated_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    uniqueIndex('navigation_item_translations_item_locale_key').on(table.itemId, table.localeId),
    index('navigation_item_translations_locale_idx').on(table.localeId),
    foreignKey({
      name: 'navigation_item_translations_item_id_fk',
      columns: [table.itemId],
      foreignColumns: [navigationItems.id]
    }).onDelete('cascade'),
    foreignKey({
      name: 'navigation_item_translations_locale_id_fk',
      columns: [table.localeId],
      foreignColumns: [locales.id]
    }).onDelete('cascade')
  ]
)
