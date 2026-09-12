import { describe, expect, it } from 'vitest'
import {
  assertValidAlias,
  ensureAlias,
  isReservedAlias,
  postInputSchema,
  slugifyTitle,
  taxonomyInputSchema
} from '#shared/schemas/post'

describe('slugifyTitle / ensureAlias', () => {
  it('slugifies ascii titles', () => {
    expect(slugifyTitle('Getting Started with Nuxt 4!')).toBe('getting-started-with-nuxt-4')
  })

  it('drops CJK characters (no ascii slug) and falls back to a timestamp slug', () => {
    expect(slugifyTitle('你好世界')).toBe('')
    const slug = ensureAlias('你好世界', undefined)
    expect(slug).toMatch(/^p-\d+$/)
  })

  it('prefers the provided slug', () => {
    expect(ensureAlias('Some Title', 'custom-slug')).toBe('custom-slug')
  })

  it('rejects uppercase and underscores in aliases', () => {
    expect(postInputSchema.safeParse({
      alias: 'Bad_Slug',
      translations: { 'zh-CN': { title: 'T' } }
    }).success).toBe(false)
  })

  it('rejects reserved aliases', () => {
    expect(isReservedAlias('admin')).toBe(true)
    expect(isReservedAlias('posts')).toBe(true)
    expect(() => assertValidAlias('api')).toThrow()
    expect(isReservedAlias('react-router')).toBe(false)
  })
})

describe('postInputSchema', () => {
  it('accepts a minimal valid post', () => {
    expect(postInputSchema.safeParse({
      status: 'draft',
      translations: { 'zh-CN': { title: '标题', content: '<p>正文</p>' } }
    }).success).toBe(true)
  })

  it('rejects unknown statuses and extra keys', () => {
    expect(postInputSchema.safeParse({
      status: 'pending',
      translations: {}
    }).success).toBe(false)
    expect(postInputSchema.safeParse({
      translations: {},
      views: 1
    }).success).toBe(false)
  })

  it('validates scheduledAt as ISO datetime', () => {
    expect(postInputSchema.safeParse({
      status: 'scheduled',
      scheduledAt: 'not-a-date',
      translations: {}
    }).success).toBe(false)
    expect(postInputSchema.safeParse({
      status: 'scheduled',
      scheduledAt: new Date(Date.now() + 60_000).toISOString(),
      translations: {}
    }).success).toBe(true)
  })
})

describe('taxonomyInputSchema', () => {
  it('requires at least one translation', () => {
    expect(taxonomyInputSchema.safeParse({ translations: {} }).success).toBe(false)
    expect(taxonomyInputSchema.safeParse({
      alias: 'tech',
      translations: { 'zh-CN': { name: '技术' } }
    }).success).toBe(true)
  })

  it('rejects empty names', () => {
    expect(taxonomyInputSchema.safeParse({
      translations: { 'zh-CN': { name: ' ' } }
    }).success).toBe(false)
  })

  it('rejects reserved aliases via isReservedAlias', () => {
    expect(isReservedAlias('pages')).toBe(true)
  })
})
