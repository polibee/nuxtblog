import { describe, expect, it } from 'vitest'
import { capitalizeEnglishLabel, resolveDisplayLabel } from '../../shared/utils/display-label'

describe('display label resolution', () => {
  it('capitalizes the first character of English navigation labels', () => {
    expect(capitalizeEnglishLabel('about us')).toBe('About us')
    expect(capitalizeEnglishLabel('tech')).toBe('Tech')
    expect(capitalizeEnglishLabel('')).toBe('')
  })

  it('formats the selected English navigation label', () => {
    expect(resolveDisplayLabel({ locale: 'en', defaultLabel: '关于我们', localizedLabel: '', alias: 'about' })).toBe('About')
  })

  it('keeps the default language label', () => {
    expect(resolveDisplayLabel({ locale: 'zh-CN', defaultLabel: '技术分类', localizedLabel: '', alias: 'tech' })).toBe('技术分类')
  })

  it('uses an explicit English label before alias', () => {
    expect(resolveDisplayLabel({ locale: 'en', defaultLabel: '技术分类', localizedLabel: 'Technology', alias: 'tech' })).toBe('Technology')
  })

  it('uses alias when the non-default translation is empty', () => {
    expect(resolveDisplayLabel({ locale: 'en', defaultLabel: '技术分类', localizedLabel: '', alias: 'tech' })).toBe('Tech')
  })
})
