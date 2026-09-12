import { bigint, datetime, index, int, mysqlTable, varchar } from 'drizzle-orm/mysql-core'

/* URL redirects (alias unification doc 3.3): alias changes record the
   old public path so links keep working via 301/308. */

export const urlRedirects = mysqlTable(
  'url_redirects',
  {
    id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
    // post | page | category | tag
    entityType: varchar('entity_type', { length: 20 }).notNull(),
    entityId: bigint('entity_id', { mode: 'number' }).notNull(),
    localeId: bigint('locale_id', { mode: 'number' }),
    oldPath: varchar('old_path', { length: 500 }).notNull(),
    newPath: varchar('new_path', { length: 500 }).notNull(),
    // 301 | 308
    statusCode: int('status_code').notNull().default(301),
    createdAt: datetime('created_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    expiresAt: datetime('expires_at', { fsp: 6, mode: 'date' })
  },
  table => [
    index('url_redirects_old_path_idx').on(table.oldPath)
  ]
)
