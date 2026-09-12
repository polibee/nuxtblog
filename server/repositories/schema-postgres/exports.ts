import {
  bigint,
  date,
  timestamp,
  index,
  integer,
  pgTable,
  varchar
} from 'drizzle-orm/pg-core'

/* Export jobs (commerce doc §11.3): CSV exports with optional date
   filtering. Files live in nitro "exports" storage keyed by job id. */

export const exportJobs = pgTable(
  'export_jobs',
  {
    id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
    // orders | transactions | inventory
    type: varchar('type', { length: 30 }).notNull(),
    // pending | completed | failed
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    dateFrom: date('date_from', { mode: 'string' }),
    dateTo: date('date_to', { mode: 'string' }),
    rowCount: integer('row_count').notNull().default(0),
    fileKey: varchar('file_key', { length: 120 }),
    error: varchar('error', { length: 500 }),
    createdBy: bigint('created_by', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' })
  },
  table => [
    index('export_jobs_created_idx').on(table.createdAt)
  ]
)
