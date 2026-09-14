import { describe, expect, it } from 'vitest'
import { localizedPath } from '../../shared/utils/locale-navigation'

describe('localized public paths', () => {
  it('adds a non-default locale prefix while preserving the route', () => {
    expect(localizedPath('/profile', { code: 'en', urlPrefix: 'en' }, 'zh-CN')).toBe('/en/profile')
  })

  it('removes an existing locale prefix for the default locale', () => {
    expect(localizedPath('/en/profile?tab=projects', { code: 'zh-CN', urlPrefix: '' }, 'zh-CN')).toBe('/profile?tab=projects')
  })

  it('drops legacy locale query parameters while keeping other query state', () => {
    expect(localizedPath('/posts/hello?locale=en&page=2#comments', { code: 'en', urlPrefix: 'en' }, 'zh-CN'))
      .toBe('/en/posts/hello?page=2#comments')
  })

  it('does not duplicate an existing locale prefix', () => {
    expect(localizedPath('/en/posts/hello', { code: 'en', urlPrefix: 'en' }, 'zh-CN'))
      .toBe('/en/posts/hello')
  })
})
