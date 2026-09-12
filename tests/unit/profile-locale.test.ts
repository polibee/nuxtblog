import { describe, expect, it } from 'vitest'
import { chooseProfileTranslation } from '../../server/modules/profile/profile-locale'

describe('profile locale resolution', () => {
  it('prefers requested locale and falls back to the default translation', () => {
    const translations = new Map([
      [1, { displayName: '中文作者' }],
      [2, { displayName: 'English Author' }]
    ])

    expect(chooseProfileTranslation(translations, 2, 1)?.displayName).toBe('English Author')
    expect(chooseProfileTranslation(translations, 9, 1)?.displayName).toBe('中文作者')
  })

  it('returns undefined when there is no translation', () => {
    expect(chooseProfileTranslation(new Map(), 2, 1)).toBeUndefined()
  })
})
