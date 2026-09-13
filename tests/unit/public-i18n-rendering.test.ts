import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import { useI18n } from '../../app/admin/i18n'
import { resolveDisplayLabel } from '../../shared/utils/display-label'

const root = resolve(import.meta.dirname, '../..')

function source(path: string): string {
  return readFileSync(resolve(root, path), 'utf8')
}

describe('public i18n rendering', () => {
  it('renders the public labels in both locales instead of returning raw keys', () => {
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

    vi.unstubAllGlobals()
  })

  it('keeps public pages on translated labels and independent article fields', () => {
    const home = source('app/pages/index.vue')
    const postIndex = source('app/pages/posts/index.vue')
    const postPage = source('app/pages/posts/[alias].vue')
    const postList = source('app/components/public/PostList.vue')
    const postDetail = source('app/components/public/PostDetail.vue')
    const profile = source('app/pages/profile.vue')
    const projectCard = source('app/components/public/ProfileProjectCard.vue')
    const header = source('app/components/public/SiteHeader.vue')

    expect(home).toContain('t(\'public.home.layoutList\'')
    expect(home).toContain('t(\'public.home.layoutGrid\'')
    expect(postIndex).toContain('t(\'public.posts.title\'')
    expect(postList).toContain('t(\'posts.meta.views\'')
    expect(postDetail).toContain('t(\'posts.meta.readingTime\'')
    expect(postDetail).toContain('post.title')
    expect(postDetail).toContain('v-html="post.content"')
    expect(postPage).toContain('detail.neighbors.prev.title')
    expect(postPage).toContain('detail.neighbors.next.title')
    expect(postPage).not.toContain('aria-label="Breadcrumb"')
    expect(profile).not.toContain('t(SECTION_LABELS[type]')
    expect(projectCard).toContain('t(\'public.profile.github\'')
    expect(projectCard).not.toMatch(/>GitHub<\/a>/u)
    expect(header).toContain('t(\'common.navigation.main\'')
    expect(header).not.toContain('aria-label="Main navigation"')
    expect(header).toContain(':to="publicPath(\'/\')"')
  })

  it('resolves public navigation labels in English by name, alias, then system key', () => {
    expect(resolveDisplayLabel({
      locale: 'en',
      defaultLabel: '文章',
      localizedLabel: 'Posts',
      alias: 'posts',
      systemKey: 'post-12'
    })).toBe('Posts')
    expect(resolveDisplayLabel({
      locale: 'en',
      defaultLabel: '文章',
      localizedLabel: '',
      alias: 'posts',
      systemKey: 'post-12'
    })).toBe('posts')
    expect(resolveDisplayLabel({
      locale: 'en',
      defaultLabel: '文章',
      localizedLabel: '',
      alias: '',
      systemKey: 'post-12'
    })).toBe('post-12')
  })

  it('localizes internal menu links without changing external URLs', () => {
    const menu = source('app/components/public/NavigationMenu.vue')
    const footer = source('app/components/public/SiteFooter.vue')

    expect(menu).toContain('const { publicPath } = useLocale()')
    expect(menu).toContain(':to="linkPath(item.url)"')
    expect(menu).toContain(':to="linkPath(item.url)"')
    expect(footer).toContain('function linkPath(url: string): string')
    expect(footer).toContain(':to="linkPath(child.url)"')
  })
})
