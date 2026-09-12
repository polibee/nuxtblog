import { isBlogDbReady } from './db.server'
import { isPostgresBlogDbReady } from './db-postgres.server'

export function isDomainDbReady(): boolean {
  return isPostgresDriver() ? isPostgresBlogDbReady() : isBlogDbReady()
}

export function isPostgresDriver(): boolean {
  return process.env.DB_DRIVER === 'postgres' || process.env.DB_DRIVER === 'supabase'
}
