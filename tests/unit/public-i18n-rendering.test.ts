import { computed, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useI18n } from '../../app/admin/i18n'
import { useLocale } from '../../app/composables/useLocale'
import { resolveDisplayLabel } from '../../shared/utils/display-label'
import { localizedPath } from '../../shared/utils/locale-navigation'

interface StateBox<T = unknown> {
  value: T
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('public i18n behavior', () => {
  it('renders public labels from the real locale dictionaries', () => {
    vi.stubGlobal('useCookie', () => ({ value: 'zh-CN' }))
    const { locale, t } = useI18n()

    locale.value = 'zh-CN'
    expect(t('public.home.layoutLabel')).toBe('文章布局')
    expect(t('public.home.layoutList')).toBe('列表')
    expect(t('public.home.layoutGrid')).toBe('卡片')
    expect(t('common.navigation.breadcrumb')).toBe('面包屑导航')
    expect(t('common.navigation.main')).toBe('主导航')
    expect(t('public.profile.loadFailed')).toBe('个人主页加载失败')
    expect(t('public.profile.retry')).toBe('重试')

    locale.value = 'en'
    expect(t('public.home.layoutLabel')).toBe('Post layout')
    expect(t('public.home.layoutList')).toBe('List')
    expect(t('public.home.layoutGrid')).toBe('Grid')
    expect(t('common.navigation.breadcrumb')).toBe('Breadcrumb navigation')
    expect(t('common.navigation.main')).toBe('Main navigation')
    expect(t('public.profile.loadFailed')).toBe('Failed to load profile')
    expect(t('public.profile.retry')).toBe('Retry')
    expect(t('public.profile.github')).toBe('GitHub')
  })

  it('builds locale-aware paths through useLocale and preserves external URLs', () => {
    const state = ref({ id: null, code: 'zh-CN', urlPrefix: '' })
    const cookie: StateBox = { value: 'zh-CN' }
    vi.stubGlobal('useState', () => state)
    vi.stubGlobal('useCookie', () => cookie)
    vi.stubGlobal('computed', computed)

    const { localeCode, publicPath, setLocale } = useLocale()
    expect(localeCode.value).toBe('zh-CN')
    expect(publicPath('/posts/hello')).toBe('/posts/hello')
    expect(publicPath('https://example.com/docs')).toBe('https://example.com/docs')

    setLocale('en', 'en')
    expect(cookie.value).toBe('en')
    expect(localeCode.value).toBe('en')
    expect(publicPath('/posts/hello?tab=comments#top')).toBe('/en/posts/hello?tab=comments#top')
  })

  it('normalizes /en deep links without a trailing slash and switches routes canonically', () => {
    expect(localizedPath('/en', { code: 'en', urlPrefix: 'en' }, 'zh-CN')).toBe('/en')
    expect(localizedPath('/en/posts/hello?locale=en&page=2#comments', { code: 'en', urlPrefix: 'en' }, 'zh-CN'))
      .toBe('/en/posts/hello?page=2#comments')
    expect(localizedPath('/en/profile', { code: 'zh-CN', urlPrefix: '' }, 'zh-CN')).toBe('/profile')
  })

  it('resolves the locale middleware from the URL before the cookie', async () => {
    const states = new Map<string, StateBox>()
    states.set('public-locales', {
      value: [{ code: 'zh-CN', urlPrefix: '', isDefault: true, contentEnabled: true }, { code: 'en', urlPrefix: 'en', isDefault: false, contentEnabled: true }]
    })
    vi.stubGlobal('useState', (key: string, init: () => unknown) => {
      if (!states.has(key)) states.set(key, { value: init() })
      return states.get(key)
    })
    vi.stubGlobal('useCookie', () => ({ value: 'zh-CN' }))
    vi.stubGlobal('defineNuxtRouteMiddleware', (handler: unknown) => handler)
    vi.stubGlobal('$fetch', vi.fn())
    vi.stubGlobal('navigateTo', vi.fn())

    const { default: middleware } = await import('../../app/middleware/locale.global')
    await middleware({ path: '/en', fullPath: '/en', query: {} } as never)

    expect(states.get('blog-locale')?.value).toMatchObject({ code: 'en', urlPrefix: 'en' })
  })

  it('uses English label, then alias, then system key for public navigation', () => {
    expect(resolveDisplayLabel({ locale: 'en', defaultLabel: '文章', localizedLabel: 'Posts', alias: 'posts', systemKey: 'post-12' })).toBe('Posts')
    expect(resolveDisplayLabel({ locale: 'en', defaultLabel: '文章', localizedLabel: '', alias: 'posts', systemKey: 'post-12' })).toBe('posts')
    expect(resolveDisplayLabel({ locale: 'en', defaultLabel: '文章', localizedLabel: '', alias: '', systemKey: 'post-12' })).toBe('post-12')
  })
})
