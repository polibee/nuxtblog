import path from 'node:path'
import { migrate } from 'drizzle-orm/mysql2/migrator'
import type { MySql2Database } from 'drizzle-orm/mysql2'

export async function runMySqlMigrations<TSchema extends Record<string, unknown>>(
  db: MySql2Database<TSchema>,
  migrationsFolder = path.join(process.cwd(), 'server', 'repositories', 'migrations')
): Promise<void> {
  await migrate(db, { migrationsFolder })
}

export async function closePool(pool: { end(): Promise<unknown> }): Promise<void> {
  await pool.end()
}
