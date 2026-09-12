import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2'
import { drizzle as drizzlePostgres } from 'drizzle-orm/node-postgres'
import mysql from 'mysql2/promise'
import pg from 'pg'
import type { DatabaseConfig } from './types'

/**
 * The only module allowed to construct database pools. Domain repositories
 * receive the Drizzle client from the lifecycle instead of importing a
 * vendor client or creating their own pool.
 */
export function createMySqlPool(config: DatabaseConfig): mysql.Pool {
  if (config.ormDriver !== 'mysql') {
    throw new Error(`MySQL pool requested for ${config.ormDriver} driver`)
  }
  return mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit: config.poolMax,
    connectTimeout: config.connectTimeoutMs,
    charset: 'utf8mb4_unicode_ci'
  })
}

export async function ensureMySqlDatabase(config: DatabaseConfig): Promise<mysql.Pool> {
  if (!/^[a-zA-Z0-9_]+$/.test(config.database)) {
    throw new Error(`invalid database name: ${config.database}`)
  }
  const bootstrap = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    connectTimeout: config.connectTimeoutMs
  })
  try {
    await bootstrap.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
  } finally {
    await bootstrap.end()
  }
  return createMySqlPool(config)
}

export function createMySqlOrm<TSchema extends Record<string, unknown>>(
  pool: mysql.Pool,
  schema: TSchema
): MySql2Database<TSchema> {
  return drizzle(pool, { schema, mode: 'default' })
}

export function createPostgresPool(config: DatabaseConfig): pg.Pool {
  if (config.ormDriver !== 'postgres') {
    throw new Error(`PostgreSQL pool requested for ${config.ormDriver} driver`)
  }
  return new pg.Pool({
    connectionString: config.url || undefined,
    host: config.url ? undefined : config.host,
    port: config.url ? undefined : config.port,
    database: config.url ? undefined : config.database,
    user: config.url ? undefined : config.user,
    password: config.url ? undefined : config.password,
    max: config.poolMax,
    connectionTimeoutMillis: config.connectTimeoutMs,
    statement_timeout: config.queryTimeoutMs,
    // Supabase requires encrypted transport; transaction pooler users must
    // also disable prepared statements in the ORM/client configuration.
    ssl: config.ssl ? { rejectUnauthorized: config.sslVerify } : false
  })
}

export function createPostgresOrm(pool: pg.Pool, schema?: Record<string, unknown>) {
  return schema ? drizzlePostgres(pool, { schema }) : drizzlePostgres(pool)
}
