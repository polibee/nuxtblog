/* =============================================================
 * Runtime configuration readers: environment variables take
 * precedence over admin-configured settings; settings come from the
 * DB-backed settings service (falls back to the fallback value when
 * the blog DB is unavailable). Secrets are only ever sourced from
 * settings (secret type) or environment - never literals.
 * Readers are async since P02; call sites await them.
 * ============================================================= */

import { getSettingValue } from '../modules/settings/settings.runtime.service'

async function setting(key: string, fallback = ''): Promise<string> {
  return String(await getSettingValue(key, fallback))
}

async function envish(key: string, settingKey: string, fallback = ''): Promise<string> {
  const stored = await setting(settingKey)
  return process.env[key] ?? (stored || fallback)
}

export type DbDriver = 'memory' | 'postgres' | 'mysql' | 'supabase'

export interface DbConfig {
  driver: DbDriver
  /** full connection string; when set it wins over discrete fields */
  url: string
  host: string
  port: number
  database: string
  user: string
  hasPassword: boolean
  ssl: boolean
  sslVerify: boolean
  seedDemo: boolean
  poolMax: number
  connectTimeoutMs: number
  queryTimeoutMs: number
  /**
   * Keep false for configured remote databases. A failed connection must not
   * silently turn into a process-local data source.
   */
  allowMemoryFallback: boolean
}

export async function readDbConfig(): Promise<DbConfig> {
  const raw = await envish('DB_DRIVER', 'DB_DRIVER', 'memory')
  const driver = (['postgres', 'mysql', 'supabase'].includes(raw) ? raw : 'memory') as DbDriver
  const url = process.env.DATABASE_URL ?? (await setting('DATABASE_URL'))
  return {
    driver,
    url,
    host: await envish('DB_HOST', 'DB_HOST', 'localhost'),
    port: Number(await envish('DB_PORT', 'DB_PORT', driver === 'mysql' ? '3306' : '5432')) || (driver === 'mysql' ? 3306 : 5432),
    database: await envish('DB_NAME', 'DB_NAME', 'nuxt_admin'),
    user: await envish('DB_USER', 'DB_USER'),
    hasPassword: (process.env.DB_PASSWORD ?? (await setting('DB_PASSWORD')) ?? '').length > 0,
    ssl: ((await envish('DB_SSL', 'DB_SSL', driver === 'supabase' ? 'true' : 'false'))) === 'true',
    sslVerify: ((await envish('DB_SSL_VERIFY', 'DB_SSL_VERIFY', driver === 'supabase' ? 'false' : 'true'))) === 'true',
    seedDemo: ((await envish('SEED_DEMO', 'SEED_DEMO', 'true'))) === 'true',
    allowMemoryFallback: ((await envish('ALLOW_MEMORY_FALLBACK', 'ALLOW_MEMORY_FALLBACK', 'false'))) === 'true',
    poolMax: Math.max(1, Number(await envish('DB_POOL_MAX', 'DB_POOL_MAX', '10')) || 10),
    connectTimeoutMs: Math.max(1000, Number(await envish('DB_CONNECT_TIMEOUT_MS', 'DB_CONNECT_TIMEOUT_MS', '5000')) || 5000),
    queryTimeoutMs: Math.max(1000, Number(await envish('DB_QUERY_TIMEOUT_MS', 'DB_QUERY_TIMEOUT_MS', '10000')) || 10000)
  }
}

export interface CacheConfig {
  driver: 'memory' | 'redis'
  url: string
  host: string
  port: number
  password: string
  db: number
}

export async function readCacheConfig(): Promise<CacheConfig> {
  const raw = await envish('CACHE_DRIVER', 'CACHE_DRIVER', 'memory')
  return {
    driver: raw === 'redis' ? 'redis' : 'memory',
    url: process.env.REDIS_URL ?? (await setting('REDIS_URL')),
    host: await envish('REDIS_HOST', 'REDIS_HOST', 'localhost'),
    port: Number(await envish('REDIS_PORT', 'REDIS_PORT', '6379')) || 6379,
    password: process.env.REDIS_PASSWORD ?? (await setting('REDIS_PASSWORD')),
    db: Number(await envish('REDIS_DB', 'REDIS_DB', '0')) || 0
  }
}

export async function dbPassword(): Promise<string> {
  return process.env.DB_PASSWORD ?? (await setting('DB_PASSWORD'))
}

export async function buildConnectionString(db: DbConfig): Promise<string> {
  if (db.url) return db.url
  const auth = db.user ? `${encodeURIComponent(db.user)}:${encodeURIComponent(await dbPassword())}@` : ''
  return `postgres://${auth}${db.host}:${db.port}/${db.database}${db.ssl ? '?sslmode=require' : ''}`
}
