import { describe, expect, it } from 'vitest'
import { createDomainRepositoryContext } from '../../server/repositories/domain-context'

describe('DomainRepositoryContext', () => {
  it('maps Supabase to the PostgreSQL ORM', () => {
    expect(createDomainRepositoryContext({ driver: 'supabase', isReady: true })).toEqual({
      driver: 'supabase', ormDriver: 'postgres', isPostgres: true, isReady: true
    })
  })

  it('maps MySQL without depending on legacy variables', () => {
    expect(createDomainRepositoryContext({ driver: 'mysql' }).ormDriver).toBe('mysql')
  })

  it('rejects unsupported drivers', () => {
    expect(() => createDomainRepositoryContext({ driver: 'sqlite' })).toThrow('Unsupported domain database driver')
  })
})
