import { describe, expect, it } from 'vitest'
import { buildProfileTranslationMap, chooseProfileTranslationCode } from '../../shared/utils/profile-localization'

describe('profile localization', () => {
  it('keeps each locale as an independent editable translation', () => {
    const result = buildProfileTranslationMap({
      'zh-CN': { displayName: '中文作者', headline: '中文简介', bio: '中文内容', location: '杭州' },
      'en': { displayName: 'English Author', headline: 'English headline', bio: 'English bio', location: 'Hangzhou' }
    })

    expect(result).toEqual({
      'zh-CN': { displayName: '中文作者', headline: '中文简介', bio: '中文内容', location: '杭州' },
      'en': { displayName: 'English Author', headline: 'English headline', bio: 'English bio', location: 'Hangzhou' }
    })
  })

  it('falls back to the default translation when a locale is missing', () => {
    expect(chooseProfileTranslationCode(['zh-CN'], 'en', 'zh-CN')).toBe('zh-CN')
  })
})
