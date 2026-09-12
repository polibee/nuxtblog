import { describe, expect, it } from 'vitest'
import { sidebarCardInputSchema, SIDEBAR_CARD_TYPES } from '#shared/schemas/sidebar-card'
import { userCreateSchema, userUpdateSchema } from '#shared/schemas/user'

describe('sidebarCardInputSchema', () => {
  it('accepts a valid card', () => {
    expect(sidebarCardInputSchema.safeParse({
      type: 'html',
      enabled: true,
      sortOrder: 1,
      translations: { 'zh-CN': { title: '关于', content: '<p>正文</p>' } }
    }).success).toBe(true)
  })

  it('requires at least one translation', () => {
    expect(sidebarCardInputSchema.safeParse({
      type: 'html',
      translations: {}
    }).success).toBe(false)
  })

  it('requires a non-empty title per translation', () => {
    expect(sidebarCardInputSchema.safeParse({
      translations: { 'zh-CN': { title: '  ', content: 'x' } }
    }).success).toBe(false)
  })

  it('rejects unknown types and extra keys', () => {
    expect(sidebarCardInputSchema.safeParse({
      type: 'iframe',
      translations: { 'zh-CN': { title: 't', content: 'c' } }
    }).success).toBe(false)
    expect(sidebarCardInputSchema.safeParse({
      translations: { 'zh-CN': { title: 't', content: 'c' } },
      hacked: true
    }).success).toBe(false)
  })

  it('exposes the extensible card type list', () => {
    expect(SIDEBAR_CARD_TYPES).toContain('html')
  })
})

describe('userCreateSchema', () => {
  it('normalizes email to lowercase and accepts valid input', () => {
    const result = userCreateSchema.safeParse({
      email: '  Jane@Example.COM ',
      name: 'Jane',
      password: 'long-enough-password'
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe('jane@example.com')
      expect(result.data.role).toBeUndefined()
    }
  })

  it('requires a password of at least 8 chars', () => {
    expect(userCreateSchema.safeParse({
      email: 'a@b.co',
      name: 'A',
      password: 'short'
    }).success).toBe(false)
  })

  it('rejects bad roles and extra keys', () => {
    expect(userCreateSchema.safeParse({
      email: 'a@b.co',
      name: 'A',
      password: 'long-enough',
      role: 'superadmin'
    }).success).toBe(false)
    expect(userCreateSchema.safeParse({
      email: 'a@b.co',
      name: 'A',
      password: 'long-enough',
      passwordHash: 'x'
    }).success).toBe(false)
  })
})

describe('userUpdateSchema', () => {
  it('allows partial updates including optional password', () => {
    expect(userUpdateSchema.safeParse({}).success).toBe(true)
    expect(userUpdateSchema.safeParse({ status: 'inactive' }).success).toBe(true)
    expect(userUpdateSchema.safeParse({ password: 'new-password-123' }).success).toBe(true)
  })

  it('still enforces email format and password length when present', () => {
    expect(userUpdateSchema.safeParse({ email: 'nope' }).success).toBe(false)
    expect(userUpdateSchema.safeParse({ password: 'x' }).success).toBe(false)
  })
})
