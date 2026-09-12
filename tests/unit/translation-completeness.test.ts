import { describe, expect, it } from 'vitest'
import {
  isPublishable,
  localeTranslationCompleteness,
  translationCompletenessByLocale
} from '#shared/schemas/locale'

describe('localeTranslationCompleteness', () => {
  it('reports missing when the locale has no translation row', () => {
    expect(localeTranslationCompleteness(undefined, ['title'])).toBe('missing')
  })

  it('reports incomplete when required fields are empty', () => {
    expect(localeTranslationCompleteness({}, ['title'])).toBe('incomplete')
    expect(localeTranslationCompleteness({ title: null }, ['title'])).toBe('incomplete')
    expect(localeTranslationCompleteness({ title: '   ' }, ['title'])).toBe('incomplete')
  })

  it('strips html before judging rich text completeness', () => {
    expect(localeTranslationCompleteness({ content: '<p><br></p>' }, ['content'])).toBe('incomplete')
    expect(localeTranslationCompleteness({ content: '<p>正文</p>' }, ['content'])).toBe('complete')
  })

  it('reports complete when all required fields are present', () => {
    expect(localeTranslationCompleteness({ title: 'Hello', slug: 'hello' }, ['title', 'slug']))
      .toBe('complete')
  })
})

describe('translationCompletenessByLocale', () => {
  it('maps every locale in the record', () => {
    expect(translationCompletenessByLocale(
      { 'zh-CN': { title: '你好' }, 'en': {} },
      ['title']
    )).toEqual({ 'zh-CN': 'complete', 'en': 'incomplete' })
  })

  it('returns an empty map for absent translations', () => {
    expect(translationCompletenessByLocale(undefined, ['title'])).toEqual({})
  })
})

describe('isPublishable', () => {
  it('requires a complete primary locale translation', () => {
    expect(isPublishable({ 'zh-CN': { title: '你好' } }, 'zh-CN', ['title'])).toBe(true)
    expect(isPublishable({ 'zh-CN': {} }, 'zh-CN', ['title'])).toBe(false)
    expect(isPublishable({ en: { title: 'Hello' } }, 'zh-CN', ['title'])).toBe(false)
  })

  it('ignores completeness of secondary locales', () => {
    expect(isPublishable(
      { 'zh-CN': { title: '你好' }, 'en': {} },
      'zh-CN',
      ['title']
    )).toBe(true)
  })
})
