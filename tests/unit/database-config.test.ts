import { describe, expect, it } from 'vitest'
import { databaseLogMeta, normalizeDatabaseConfig } from '../../server/database/config'

describe('database configuration', () => {
  it('normalizes Supabase as a PostgreSQL ORM adapter with SSL', () => {
    const config = normalizeDatabaseConfig({
      driver: 'supabase',
      url: 'postgresql://postgres.project:secret@pooler.example:5432/postgres?sslmode=require'
    })

    expect(config.driver).toBe('supabase')
    expect(config.ormDriver).toBe('postgres')
    expect(config.ssl).toBe(true)
    expect(config.allowMemoryFallback).toBe(false)
  })

  it('requires explicit memory fallback for remote database drivers', () => {
    expect(normalizeDatabaseConfig({ driver: 'postgres' }).allowMemoryFallback).toBe(false)
    expect(normalizeDatabaseConfig({ driver: 'postgres', allowMemoryFallback: true }).allowMemoryFallback).toBe(true)
    expect(normalizeDatabaseConfig({ driver: 'memory' }).allowMemoryFallback).toBe(true)
  })

  it('never includes credentials in connection log metadata', () => {
    const meta = databaseLogMeta(normalizeDatabaseConfig({
      driver: 'postgres',
      url: 'postgresql://user:secret@db.example:5432/blog'
    }))

    expect(meta).toEqual({ driver: 'postgres', ormDriver: 'postgres', host: 'db.example', database: 'blog' })
    expect(JSON.stringify(meta)).not.toContain('secret')
  })
})
