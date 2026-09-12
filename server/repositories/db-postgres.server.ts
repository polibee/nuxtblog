import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type pg from 'pg'
import { createPostgresOrm, createPostgresPool } from '../database/factory'
import { normalizeDatabaseConfig } from '../database/config'
import * as schema from './schema-postgres'

type PostgresBlogDb = NodePgDatabase<typeof schema>
let pool: pg.Pool | null = null
let db: PostgresBlogDb | null = null
let initPromise: Promise<boolean> | null = null

export function isPostgresBlogDbReady(): boolean {
  return db !== null
}

export function getPostgresDb(): PostgresBlogDb {
  if (!db) throw new Error('postgres blog database not initialized')
  return db
}

export function initPostgresBlogDb(): Promise<boolean> {
  if (initPromise) return initPromise
  initPromise = (async () => {
    try {
      const config = normalizeDatabaseConfig({
        driver: process.env.DB_DRIVER === 'supabase' ? 'supabase' : 'postgres',
        url: process.env.DATABASE_URL,
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT) || undefined,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: process.env.DB_SSL ? process.env.DB_SSL === 'true' : undefined,
        sslVerify: process.env.DB_SSL_VERIFY ? process.env.DB_SSL_VERIFY === 'true' : undefined
      })
      pool = createPostgresPool(config)
      db = createPostgresOrm(pool, schema) as unknown as PostgresBlogDb
      await pool.query('select 1')
      const locale = await db.select({ id: schema.locales.id }).from(schema.locales).limit(1)
      if (locale.length === 0) {
        await db.insert(schema.locales).values({
          code: 'zh-CN', name: 'Simplified Chinese', nativeName: '简体中文', urlPrefix: '',
          enabled: true, contentEnabled: true, uiEnabled: true, isDefault: true, sortOrder: 0
        })
      }
      console.log(`[blog-db] ready (${config.driver})`)
      return true
    } catch (error) {
      console.error('[blog-db] postgres init failed:', error instanceof Error ? error.message : error)
      db = null
      return false
    }
  })()
  return initPromise
}

export async function closePostgresBlogDb(): Promise<void> {
  if (pool) await pool.end()
  pool = null
  db = null
  initPromise = null
}
