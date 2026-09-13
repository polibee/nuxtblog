import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import { useI18n } from '../../app/admin/i18n'

const root = resolve(import.meta.dirname, '../..')

function source(path: string): string {
  return readFileSync(resolve(root, path), 'utf8')
}

describe('localized core UI', () => {
  it('resolves the core public and admin labels from both active locales', () => {
    vi.stubGlobal('useCookie', () => ({ value: 'zh-CN' }))
    const { locale, t } = useI18n()

    locale.value = 'zh-CN'
    expect(t('posts.meta.views', { n: 12 })).toBe('12 次浏览')
    expect(t('comments.actions.reply')).toBe('回复')
    expect(t('settings.ui.loadFailed')).toBe('设置加载失败')
    expect(t('media.library.upload')).toBe('上传媒体')

    locale.value = 'en'
    expect(t('posts.meta.views', { n: 12 })).toBe('12 views')
    expect(t('comments.actions.reply')).toBe('Reply')
    expect(t('settings.ui.loadFailed')).toBe('Failed to load settings')
    expect(t('media.library.upload')).toBe('Upload media')
    expect(t('common.status.loading')).toBe('Loading…')
    expect(t('common.errors.loadFailed')).toBe('Failed to load')

    vi.unstubAllGlobals()
  })

  it('keeps locale switching in-app and preserves the localized route contract', () => {
    const postList = source('app/components/public/PostList.vue')
    const detail = source('app/components/public/PostDetail.vue')
    const footer = source('app/components/public/SiteFooter.vue')
    const switcher = source('app/components/public/LanguageSwitcher.vue')
    const comments = source('app/modules/comments/admin/CommentsResource.ts')
    const settings = source('app/modules/settings/admin/SettingsWorkspacePage.vue')
    const media = source('app/modules/media/admin/MediaLibraryPage.vue')

    expect(postList).toContain('t(\'posts.meta.views\'')
    expect(postList).toContain('t(\'posts.actions.open\'')
    expect(postList).not.toContain('t(\'public.posts.readingTime\'')
    expect(detail).toContain('t(\'posts.meta.views\'')
    expect(detail).toContain('t(\'posts.actions.buyFor\'')
    expect(detail).toContain('post.title')
    expect(footer).toContain('siteName')
    expect(switcher).toContain('localizedPath')
    expect(switcher).toContain('navigateTo(cleanPath)')
    expect(switcher).not.toContain('window.location.reload')
    expect(switcher).not.toMatch(/nativeName:\s*['"](?:English|简体中文)['"]/u)
    expect(comments).toContain('t(\'comments.actions.approve\'')
    expect(settings).toContain('t(\'settings.ui.loadFailed\'')
    expect(settings).toContain('t(\'common.status.loading\'')
    expect(media).toContain('t(\'media.library.upload\'')
    expect(media).toContain('t(\'common.status.loading\'')
  })
})
