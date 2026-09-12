import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  datetime,
  foreignKey,
  index,
  int,
  mysqlTable,
  uniqueIndex,
  varchar
} from 'drizzle-orm/mysql-core'

export const locales = mysqlTable(
  'locales',
  {
    id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
    code: varchar('code', { length: 20 }).notNull(),
    name: varchar('name', { length: 80 }).notNull(),
    nativeName: varchar('native_name', { length: 80 }).notNull(),
    urlPrefix: varchar('url_prefix', { length: 20 }),
    enabled: boolean('enabled').notNull().default(true),
    contentEnabled: boolean('content_enabled').notNull().default(false),
    uiEnabled: boolean('ui_enabled').notNull().default(false),
    isDefault: boolean('is_default').notNull().default(false),
    // MySQL has no partial unique index: pin "at most one default" on a
    // generated column that is 1 for the default row and NULL otherwise
    defaultFlag: bigint('default_flag', { mode: 'number' }).generatedAlwaysAs(
      sql`if(\`is_default\`, 1, null)`
    ),
    fallbackLocaleId: bigint('fallback_locale_id', { mode: 'number' }),
    sortOrder: int('sort_order').notNull().default(0),
    createdAt: datetime('created_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime('updated_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    foreignKey({
      name: 'locales_fallback_locale_id_locales_id_fk',
      columns: [table.fallbackLocaleId],
      foreignColumns: [table.id]
    }).onDelete('set null'),
    check('locales_content_requires_enabled', sql`\`content_enabled\` = false OR \`enabled\` = true`),
    check('locales_ui_requires_enabled', sql`\`ui_enabled\` = false OR \`enabled\` = true`),
    uniqueIndex('locales_code_key').on(table.code),
    uniqueIndex('locales_url_prefix_key').on(table.urlPrefix),
    uniqueIndex('locales_default_flag_key').on(table.defaultFlag),
    index('locales_enabled_idx').on(table.enabled),
    index('locales_sort_idx').on(table.sortOrder)
  ]
)
