import { describe, expect, it } from 'vitest'
import { generateToken, hashPassword, hashToken, verifyPassword } from '../../server/utils/password'

describe('hashPassword / verifyPassword', () => {
  it('round-trips a password', async () => {
    const hash = await hashPassword('correct horse battery staple')
    expect(hash.startsWith('scrypt:')).toBe(true)
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true)
  })

  it('rejects wrong passwords', async () => {
    const hash = await hashPassword('secret-password')
    expect(await verifyPassword('wrong-password', hash)).toBe(false)
  })

  it('produces different hashes for the same password (random salt)', async () => {
    const a = await hashPassword('same-password')
    const b = await hashPassword('same-password')
    expect(a).not.toBe(b)
  })

  it('rejects malformed stored hashes', async () => {
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false)
    expect(await verifyPassword('x', '')).toBe(false)
  })
})

describe('tokens', () => {
  it('generates 64-char hex tokens', () => {
    expect(generateToken()).toMatch(/^[0-9a-f]{64}$/)
  })

  it('hashes tokens to sha256 hex', () => {
    expect(hashToken(generateToken())).toMatch(/^[0-9a-f]{64}$/)
    expect(hashToken('abc')).toBe(hashToken('abc'))
  })
})
