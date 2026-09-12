import { describe, expect, it } from 'vitest'
import {
  localeInputSchema,
  localeUrlPrefixSchema,
  translationsRecordSchema
} from '#shared/schemas/locale'

describe('localeInputSchema', () => {
  it('accepts a minimal valid locale', () => {
    const result = localeInputSchema.safeParse({
      code: 'en',
      name: 'English',
      nativeName: 'English'
    })
    expect(result.success).toBe(true)
  })

  it('accepts an empty url prefix (default locale, no prefix)', () => {
    const result = localeInputSchema.safeParse({
      code: 'zh-CN',
      name: 'Simplified Chinese',
      nativeName: '简体中文',
      urlPrefix: ''
    })
    expect(result.success).toBe(true)
  })

  it('rejects malformed codes and uppercase prefixes', () => {
    expect(localeInputSchema.safeParse({
      code: 'e',
      name: 'x',
      nativeName: 'x'
    }).success).toBe(false)
    expect(localeInputSchema.safeParse({
      code: 'en',
      name: 'English',
      nativeName: 'English',
      urlPrefix: 'EN'
    }).success).toBe(false)
  })

  it('rejects unknown keys (strict)', () => {
    expect(localeInputSchema.safeParse({
      code: 'en',
      name: 'English',
      nativeName: 'English',
      title_zh: '英文'
    }).success).toBe(false)
  })
})

describe('localeUrlPrefixSchema', () => {
  it('allows lowercase letters, digits and dashes', () => {
    expect(localeUrlPrefixSchema.safeParse('en-US').success).toBe(false)
    expect(localeUrlPrefixSchema.safeParse('zh-hans').success).toBe(true)
    expect(localeUrlPrefixSchema.safeParse('en').success).toBe(true)
    expect(localeUrlPrefixSchema.safeParse('').success).toBe(true)
  })
})

describe('translationsRecordSchema', () => {
  it('accepts translations[locale][field] records', () => {
    expect(translationsRecordSchema.safeParse({
      'zh-CN': { title: '你好', content: '<p>正文</p>' },
      'en': { title: 'Hello' }
    }).success).toBe(true)
  })

  it('rejects non-object locale values', () => {
    expect(translationsRecordSchema.safeParse({ 'zh-CN': '标题' }).success).toBe(false)
  })
})
