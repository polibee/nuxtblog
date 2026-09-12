import {
  bigint,
  boolean,
  datetime,
  foreignKey,
  index,
  mediumtext,
  mysqlTable,
  uniqueIndex,
  varchar
} from 'drizzle-orm/mysql-core'
import { locales } from './locales'

/* Settings (P02): machine-keyed key/value store with visibility and
   grouping; localized_settings holds per-locale values for keys that
   carry natural language (site description, etc.). */

export const settings = mysqlTable(
  'settings',
  {
    id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
    key: varchar('key', { length: 80 }).notNull(),
    value: mediumtext('value').notNull(),
    // string | text | number | boolean | secret | json
    type: varchar('type', { length: 20 }).notNull().default('string'),
    group: varchar('group', { length: 40 }).notNull().default('General'),
    publicFlag: boolean('is_public').notNull().default(false),
    description: varchar('description', { length: 255 }),
    sortOrder: bigint('sort_order', { mode: 'number' }).notNull().default(0),
    createdAt: datetime('created_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime('updated_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    uniqueIndex('settings_key_key').on(table.key),
    index('settings_group_idx').on(table.group)
  ]
)

export const localizedSettings = mysqlTable(
  'localized_settings',
  {
    id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
    key: varchar('key', { length: 80 }).notNull(),
    localeId: bigint('locale_id', { mode: 'number' }).notNull(),
    value: mediumtext('value').notNull(),
    updatedAt: datetime('updated_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    uniqueIndex('localized_settings_key_locale_key').on(table.key, table.localeId),
    index('localized_settings_locale_idx').on(table.localeId),
    foreignKey({
      name: 'localized_settings_locale_id_fk',
      columns: [table.localeId],
      foreignColumns: [locales.id]
    }).onDelete('cascade')
  ]
)
