import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('navigation alias migration registration', () => {
  it('registers the alias migration in the MySQL Drizzle journal', () => {
    const journal = JSON.parse(readFileSync(resolve(process.cwd(), 'server/repositories/migrations/meta/_journal.json'), 'utf8')) as {
      entries: Array<{ tag: string }>
    }
    expect(journal.entries.some(entry => entry.tag === '0043_navigation-group-alias')).toBe(true)
  })

  it('is safe when the alias column already exists', () => {
    const migration = readFileSync(resolve(process.cwd(), 'server/repositories/migrations/0043_navigation-group-alias.sql'), 'utf8')
    expect(migration).toContain('information_schema.columns')
    expect(migration).toContain('PREPARE navigation_alias_migration_stmt')
  })
})
