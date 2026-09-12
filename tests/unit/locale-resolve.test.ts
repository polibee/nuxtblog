import { describe, expect, it } from 'vitest'
import {
  contentLocales,
  defaultLocale,
  matchLocaleByPathPrefix,
  matchLocaleFromAcceptLanguage,
  withLocaleKey
} from '../../server/utils/locale'
import type { LocaleSummary } from '#shared/types/locale'

function makeLocale(partial: Partial<LocaleSummary>): LocaleSummary {
  return {
    id: 1,
    code: 'zh-CN',
    name: 'Simplified Chinese',
    nativeName: '简体中文',
    urlPrefix: null,
    enabled: true,
    contentEnabled: true,
    uiEnabled: false,
    isDefault: false,
    sortOrder: 0,
    ...partial
  }
}

const LOCALES: LocaleSummary[] = [
  makeLocale({ id: 1, code: 'zh-CN', urlPrefix: '', isDefault: true }),
  makeLocale({ id: 2, code: 'en', urlPrefix: 'en' }),
  makeLocale({ id: 3, code: 'ja', urlPrefix: 'ja', contentEnabled: false }),
  makeLocale({ id: 4, code: 'fr', urlPrefix: 'fr', enabled: false, contentEnabled: false })
]

describe('contentLocales', () => {
  it('excludes disabled and non-content locales', () => {
    expect(contentLocales(LOCALES).map(l => l.code)).toEqual(['zh-CN', 'en'])
  })
})

describe('matchLocaleByPathPrefix', () => {
  it('matches a locale by its url prefix', () => {
    expect(matchLocaleByPathPrefix('/en/posts', LOCALES)?.code).toBe('en')
  })

  it('strips query strings before matching', () => {
    expect(matchLocaleByPathPrefix('/en/posts?utm_source=x', LOCALES)?.code).toBe('en')
  })

  it('does not let the default locale (empty prefix) claim segments', () => {
    expect(matchLocaleByPathPrefix('/zh-CN/posts', LOCALES)).toBeUndefined()
  })

  it('returns undefined for the root path and unknown prefixes', () => {
    expect(matchLocaleByPathPrefix('/', LOCALES)).toBeUndefined()
    expect(matchLocaleByPathPrefix('/ja/posts', LOCALES)).toBeUndefined()
    expect(matchLocaleByPathPrefix('/fr/posts', LOCALES)).toBeUndefined()
  })
})

describe('matchLocaleFromAcceptLanguage', () => {
  it('prefers exact code matches ordered by q', () => {
    expect(matchLocaleFromAcceptLanguage('en;q=0.9, zh-CN;q=1.0', LOCALES)?.code).toBe('zh-CN')
  })

  it('falls back to the language base tag', () => {
    expect(matchLocaleFromAcceptLanguage('en-US,en;q=0.9', LOCALES)?.code).toBe('en')
  })

  it('ignores locales that are not content enabled', () => {
    // no match among content locales; resolveLocale() falls back to the default
    expect(matchLocaleFromAcceptLanguage('ja', LOCALES)).toBeUndefined()
  })

  it('returns undefined without a usable header', () => {
    expect(matchLocaleFromAcceptLanguage(undefined, LOCALES)).toBeUndefined()
    expect(matchLocaleFromAcceptLanguage('fr', LOCALES)).toBeUndefined()
  })
})

describe('defaultLocale', () => {
  it('prefers the is_default row', () => {
    expect(defaultLocale(LOCALES)?.code).toBe('zh-CN')
  })

  it('degrades to the first content locale without a default', () => {
    const noDefault = LOCALES.map(l => ({ ...l, isDefault: false }))
    expect(defaultLocale(noDefault)?.code).toBe('zh-CN')
  })
})

describe('withLocaleKey', () => {
  it('scopes cache keys by locale code', () => {
    expect(withLocaleKey('page:/posts', { id: 2, code: 'en', urlPrefix: 'en' })).toBe('page:/posts:en')
    expect(withLocaleKey('rss', 'zh-CN')).toBe('rss:zh-CN')
  })
})
