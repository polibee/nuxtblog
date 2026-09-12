import type { DatabaseConfig } from './types'

/**
 * Dialect-neutral boundary for domain repositories.
 *
 * TDb and TSchema stay generic on purpose: each repository implementation is
 * compiled against exactly one Drizzle dialect, while services depend only
 * on its contract. This avoids an unsafe MySQL|PostgreSQL database union.
 */
export interface DomainDatabaseContext<TDb, TSchema extends Record<string, unknown>> {
  readonly config: Readonly<DatabaseConfig>
  readonly db: TDb
  readonly schema: TSchema
  transaction<T>(work: (tx: TDb) => Promise<T>): Promise<T>
  close(): Promise<void>
}

export type DomainDriver = 'mysql' | 'postgres' | 'supabase'

export function isPostgresDomainDriver(driver: DomainDriver): boolean {
  return driver === 'postgres' || driver === 'supabase'
}
