import {
  bigint,
  date,
  datetime,
  index,
  int,
  mysqlTable,
  varchar
} from 'drizzle-orm/mysql-core'

/* Export jobs (commerce doc §11.3): CSV exports with optional date
   filtering. Files live in nitro "exports" storage keyed by job id. */

export const exportJobs = mysqlTable(
  'export_jobs',
  {
    id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
    // orders | transactions | inventory
    type: varchar('type', { length: 30 }).notNull(),
    // pending | completed | failed
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    dateFrom: date('date_from', { mode: 'string' }),
    dateTo: date('date_to', { mode: 'string' }),
    rowCount: int('row_count').notNull().default(0),
    fileKey: varchar('file_key', { length: 120 }),
    error: varchar('error', { length: 500 }),
    createdBy: bigint('created_by', { mode: 'number' }).notNull(),
    createdAt: datetime('created_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    completedAt: datetime('completed_at', { fsp: 6, mode: 'date' })
  },
  table => [
    index('export_jobs_created_idx').on(table.createdAt)
  ]
)
