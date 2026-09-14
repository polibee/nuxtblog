import { afterEach, describe, expect, it } from 'vitest'
import { getPublicLoginCredentials } from '../../server/utils/login-credentials'

const originalEnv = { ...process.env }

afterEach(() => {
  process.env = { ...originalEnv }
})

describe('public login credentials', () => {
  it('hides administrator and demo credentials by default', () => {
    delete process.env.BLOG_ADMIN_PUBLIC
    delete process.env.DEMO_ACCOUNT_PUBLIC
    process.env.DEMO_ACCOUNT_ENABLED = 'true'

    expect(getPublicLoginCredentials()).toEqual([])
  })

  it('returns only explicitly enabled administrator credentials', () => {
    process.env.BLOG_ADMIN_PUBLIC = 'true'
    process.env.BLOG_ADMIN_EMAIL = 'Admin@Example.com'
    process.env.BLOG_ADMIN_PASSWORD = 'admin-secret'

    expect(getPublicLoginCredentials()).toEqual([
      { kind: 'admin', email: 'Admin@Example.com', password: 'admin-secret' }
    ])
  })

  it('returns a read-only demo credential only when enabled and public', () => {
    process.env.DEMO_ACCOUNT_ENABLED = 'true'
    process.env.DEMO_ACCOUNT_PUBLIC = 'true'
    process.env.DEMO_ACCOUNT_EMAIL = 'Demo@Example.com'
    process.env.DEMO_ACCOUNT_PASSWORD = 'demo-secret'

    expect(getPublicLoginCredentials()).toContainEqual({
      kind: 'demo',
      email: 'demo@example.com',
      password: 'demo-secret',
      readOnly: true
    })
  })
})
