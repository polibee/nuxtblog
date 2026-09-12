import { count } from 'drizzle-orm'
import type { MySql2Database } from 'drizzle-orm/mysql2'
import * as schema from './schema/locales'
import { locales } from './schema/locales'
import { createMySqlOrm, ensureMySqlDatabase } from '../database/factory'
import { closePool, runMySqlMigrations } from '../database/lifecycle'
import { normalizeDatabaseConfig } from '../database/config'

/* =============================================================
 * Blog framework data layer: real MySQL 8.x via Drizzle ORM.
 * Fully independent from the NuxtAdmin demo in-memory db
 * (server/utils/db.ts) - blog data never flows through it.
 *
 * All consumers must import these functions explicitly (see
 * architecture doc §5.5); no reliance on Nitro auto-imports so
 * every handler shares one pool/module instance.
 *
 * Boot flow (initBlogDb, idempotent):
 *   ensure database -> run SQL migrations -> seed default locale.
 * Any failure is logged and swallowed: blog features degrade to
 * the constant default locale, the admin demo keeps working.
 * ============================================================= */

const DEFAULT_DATABASE = 'nuxtblog'

interface BlogDbConfig {
  host: string
  port: number
  user: string
  password: string
  database: string
}

export function readBlogDbConfig(): BlogDbConfig {
  return {
    host: process.env.DB_HOST ?? process.env.BLOG_DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? process.env.BLOG_DB_PORT) || 3306,
    user: process.env.DB_USER ?? process.env.BLOG_DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? process.env.BLOG_DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? process.env.BLOG_DB_NAME ?? DEFAULT_DATABASE
  }
}

let pool: Awaited<ReturnType<typeof ensureMySqlDatabase>> | null = null
let db: MySql2Database<typeof schema> | null = null
let initPromise: Promise<boolean> | null = null

export function isBlogDbReady(): boolean {
  return db !== null
}

export function getDb(): MySql2Database<typeof schema> {
  if (!db) {
    throw new Error('blog database not initialized (see [blog-db] boot logs)')
  }
  return db
}

function databaseConfig(config: BlogDbConfig) {
  return normalizeDatabaseConfig({
    driver: 'mysql',
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database
  })
}

/** idempotent default locale seed (zh-CN, no url prefix) */
async function ensureLocaleSeed(database: MySql2Database<typeof schema>): Promise<void> {
  const [row] = await database.select({ total: count() }).from(locales)
  if ((row?.total ?? 0) > 0) return
  await database.insert(locales).values({
    code: 'zh-CN',
    name: 'Simplified Chinese',
    nativeName: '简体中文',
    urlPrefix: '',
    enabled: true,
    contentEnabled: true,
    uiEnabled: true,
    isDefault: true,
    sortOrder: 0
  })
  console.log('[blog-db] seeded default locale zh-CN')
}

/**
 * Boot the blog data layer. Safe to call multiple times; concurrent
 * callers share one promise. Returns false when MySQL is unreachable.
 */
export function initBlogDb(): Promise<boolean> {
  if (initPromise) return initPromise
  initPromise = (async () => {
    const config = readBlogDbConfig()
    try {
      pool = await ensureMySqlDatabase(databaseConfig(config))
      db = createMySqlOrm(pool, schema)
      await runMySqlMigrations(db)
      await ensureLocaleSeed(db)
      console.log(`[blog-db] ready (mysql://${config.host}:${config.port}/${config.database})`)
      return true
    } catch (e: unknown) {
      const err = e as { message?: string, cause?: { message?: string } }
      console.error('[blog-db] init failed, blog features run degraded:', err.message)
      if (err.cause) console.error('[blog-db] cause:', err.cause.message)
      db = null
      return false
    }
  })()
  return initPromise
}

/** used by tests / graceful shutdown */
export async function closeBlogDb(): Promise<void> {
  if (pool) await closePool(pool)
  pool = null
  db = null
  initPromise = null
}
