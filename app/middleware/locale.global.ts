import type { ResolvedLocale } from '#shared/types/locale'

/**
 * Parses the content locale for the current visit. Dev phase: the
 * default locale only (no url prefix). P20 will strip the locale
 * prefix from to.path and look it up in the locale registry.
 */
export default defineNuxtRouteMiddleware((to) => {
  const cookie = useCookie<string | null>('blog_locale')
  const code = cookie.value ?? 'zh-CN'
  useState<ResolvedLocale>('blog-locale', () => ({ id: null, code, urlPrefix: '' }))
  void to
})
