import type { DatabaseConfig, DatabaseConfigInput, DatabaseDriver, DatabaseLogMeta, OrmDriver } from './types'

const REMOTE_DRIVERS = new Set<DatabaseDriver>(['mysql', 'postgres', 'supabase'])

function parseUrl(input: DatabaseConfigInput): Partial<DatabaseConfig> {
  if (!input.url) return {}
  const url = new URL(input.url)
  const ormDriver: OrmDriver = url.protocol.startsWith('mysql') ? 'mysql' : 'postgres'
  return {
    ormDriver,
    host: url.hostname,
    port: url.port ? Number(url.port) : ormDriver === 'mysql' ? 3306 : 5432,
    database: decodeURIComponent(url.pathname.replace(/^\//, '')) || 'nuxtblog',
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    ssl: url.searchParams.get('sslmode') === 'require' || url.searchParams.get('ssl') === 'true'
  }
}

export function normalizeDatabaseConfig(input: DatabaseConfigInput = {}): DatabaseConfig {
  const driver = (input.driver ?? 'memory') as DatabaseDriver
  if (!['memory', 'mysql', 'postgres', 'supabase'].includes(driver)) {
    throw new Error(`Unsupported database driver: ${input.driver}`)
  }
  const parsed = parseUrl(input)
  const ormDriver = driver === 'memory' ? 'memory' : (parsed.ormDriver ?? (driver === 'mysql' ? 'mysql' : 'postgres'))
  const ssl = input.ssl ?? parsed.ssl ?? driver === 'supabase'
  return {
    driver,
    ormDriver,
    url: input.url ?? '',
    host: input.host ?? parsed.host ?? 'localhost',
    port: input.port ?? parsed.port ?? (ormDriver === 'mysql' ? 3306 : 5432),
    database: input.database ?? parsed.database ?? 'nuxtblog',
    user: input.user ?? parsed.user ?? '',
    password: input.password ?? parsed.password ?? '',
    ssl,
    sslVerify: input.sslVerify ?? driver !== 'supabase',
    poolMax: input.poolMax ?? 10,
    connectTimeoutMs: input.connectTimeoutMs ?? 5000,
    queryTimeoutMs: input.queryTimeoutMs ?? 10000,
    allowMemoryFallback: input.allowMemoryFallback ?? !REMOTE_DRIVERS.has(driver)
  }
}

export function databaseLogMeta(config: DatabaseConfig): DatabaseLogMeta {
  return {
    driver: config.driver,
    ormDriver: config.ormDriver,
    host: config.host,
    database: config.database
  }
}
