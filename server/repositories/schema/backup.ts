import {
  bigint,
  boolean,
  datetime,
  index,
  mysqlTable,
  text,
  varchar
} from 'drizzle-orm/mysql-core'

/* P14 backup: history of full-site backup archives. The ZIP itself
   lives in the exports storage; this table only tracks the job. */

export const backupJobs = mysqlTable(
  'backup_jobs',
  {
    id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
    status: varchar('status', { length: 20 }).notNull().default('completed'),
    fileKey: varchar('file_key', { length: 200 }),
    fileSize: bigint('file_size', { mode: 'number' }),
    manifestVersion: varchar('manifest_version', { length: 20 }),
    includesMedia: boolean('includes_media').notNull().default(true),
    createdBy: bigint('created_by', { mode: 'number' }),
    error: text('error'),
    startedAt: datetime('started_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    completedAt: datetime('completed_at', { fsp: 6, mode: 'date' }),
    createdAt: datetime('created_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
  },
  table => [
    index('backup_jobs_created_idx').on(table.createdAt)
  ]
)
