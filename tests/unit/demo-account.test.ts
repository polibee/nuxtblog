import { afterEach, describe, expect, it } from 'vitest'
import { demoAccountEmail, isDemoAccountEnabled, isDemoAccountUser } from '../../server/utils/demo-account'

const original = {
  enabled: process.env.DEMO_ACCOUNT_ENABLED,
  email: process.env.DEMO_ACCOUNT_EMAIL
}

afterEach(() => {
  if (original.enabled === undefined) delete process.env.DEMO_ACCOUNT_ENABLED
  else process.env.DEMO_ACCOUNT_ENABLED = original.enabled
  if (original.email === undefined) delete process.env.DEMO_ACCOUNT_EMAIL
  else process.env.DEMO_ACCOUNT_EMAIL = original.email
})

describe('demo account policy', () => {
  it('uses a stable safe default email and stays disabled by default', () => {
    delete process.env.DEMO_ACCOUNT_EMAIL
    delete process.env.DEMO_ACCOUNT_ENABLED
    expect(demoAccountEmail()).toBe('demo@example.com')
    expect(isDemoAccountEnabled()).toBe(false)
  })

  it('identifies the configured account case-insensitively', () => {
    process.env.DEMO_ACCOUNT_ENABLED = 'true'
    process.env.DEMO_ACCOUNT_EMAIL = 'TryMe@example.com'
    expect(isDemoAccountUser({ email: 'tryme@EXAMPLE.com' })).toBe(true)
    expect(isDemoAccountUser({ email: 'other@example.com' })).toBe(false)
  })

  it('can be disabled for a non-demo deployment', () => {
    process.env.DEMO_ACCOUNT_ENABLED = 'false'
    expect(isDemoAccountUser({ email: 'demo@example.com' })).toBe(false)
  })
})
