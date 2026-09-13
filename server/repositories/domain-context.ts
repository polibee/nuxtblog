import type { DatabaseDriver } from '../database/types'

export type DomainOrmDriver = 'mysql' | 'postgres'

export type DomainRepositoryTransaction<Repository> = <Result>(
  repository: Repository,
  work: (repository: Repository) => Promise<Result>
) => Promise<Result>

export interface DomainRepositoryContext<Repository = never> {
  driver: DatabaseDriver
  ormDriver: DomainOrmDriver
  isPostgres: boolean
  isReady: boolean
  repository?: Repository
  transaction?: <Result>(work: (repository: Repository) => Promise<Result>) => Promise<Result>
}

export function createDomainRepositoryContext<Repository = never>(input: {
  driver?: string
  isReady?: boolean
  repositories?: {
    mysql: Repository
    postgres: Repository
  }
  transaction?: DomainRepositoryTransaction<Repository>
} = {}): DomainRepositoryContext<Repository> {
  const rawDriver = input.driver ?? process.env.DB_DRIVER ?? 'mysql'
  const supportedDrivers: DatabaseDriver[] = ['memory', 'mysql', 'postgres', 'supabase']
  if (!supportedDrivers.includes(rawDriver as DatabaseDriver)) {
    throw new Error(`Unsupported domain database driver: ${rawDriver}`)
  }
  const driver = rawDriver as DatabaseDriver
  const isPostgres = driver === 'postgres' || driver === 'supabase'
  const context: DomainRepositoryContext<Repository> = {
    driver,
    ormDriver: isPostgres ? 'postgres' : 'mysql',
    isPostgres,
    isReady: input.isReady ?? false
  }

  if (input.repositories) {
    const repository = input.repositories[isPostgres ? 'postgres' : 'mysql']
    context.repository = repository
    if (input.transaction) {
      context.transaction = work => input.transaction!(repository, work)
    }
  }

  return context
}
