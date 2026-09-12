import type { DatabaseDriver } from '../database/types'

export type DomainOrmDriver = 'mysql' | 'postgres'

export interface DomainRepositoryContext {
  driver: DatabaseDriver
  ormDriver: DomainOrmDriver
  isPostgres: boolean
  isReady: boolean
}

export function createDomainRepositoryContext(input: {
  driver?: string
  isReady?: boolean
} = {}): DomainRepositoryContext {
  const driver = (input.driver ?? process.env.DB_DRIVER ?? 'mysql') as DatabaseDriver
  if (!['mysql', 'postgres', 'supabase'].includes(driver)) {
    throw new Error(`Unsupported domain database driver: ${driver}`)
  }
  const isPostgres = driver === 'postgres' || driver === 'supabase'
  return {
    driver,
    ormDriver: isPostgres ? 'postgres' : 'mysql',
    isPostgres,
    isReady: input.isReady ?? false
  }
}
