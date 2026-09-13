import type { ResolvedLocale } from '#shared/types/locale'
import { localizedPath } from '#shared/utils/locale-navigation'

interface PublicLocale { code: string, urlPrefix: string | null, isDefault: boolean, contentEnabled: boolean }

/**
 * Resolves the content locale from an explicit query, a configured path
 * prefix, then the user's cookie. Query state is accepted for legacy links
 * and redirected to the canonical prefixed route.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const cookie = useCookie<string | null>('blog_locale')
  const locales = useState<PublicLocale[]>('public-locales', () => [])
  if (locales.value.length === 0) {
    const result = await $fetch<{ locales: PublicLocale[] }>('/api/public/locales').catch(() => ({ locales: [] }))
    locales.value = result.locales.filter(locale => locale.contentEnabled)
  }
  const defaultLocale = locales.value.find(locale => locale.isDefault) ?? locales.value[0]
  const pathPrefix = to.path.split('/').filter(Boolean)[0]
  const pathLocale = locales.value.find(locale => locale.urlPrefix && locale.urlPrefix === pathPrefix)
  const queryCode = typeof to.query.locale === 'string' ? to.query.locale : undefined
  const selected = locales.value.find(locale => locale.code === queryCode)
    ?? pathLocale
    ?? locales.value.find(locale => locale.code === cookie.value)
    ?? defaultLocale
  const resolved = selected
    ? { id: null, code: selected.code, urlPrefix: selected.urlPrefix ?? '' }
    : { id: null, code: cookie.value ?? 'zh-CN', urlPrefix: '' }
  useState<ResolvedLocale>('blog-locale', () => resolved).value = resolved
  const defaultCode = defaultLocale?.code ?? 'zh-CN'
  const canonical = localizedPath(to.fullPath, { code: selected?.code ?? defaultCode, urlPrefix: selected?.urlPrefix ?? '' }, defaultCode)
  const pathname = to.path.replace(/^\/[a-z]{2,5}(?:-[A-Z]{2})?(?=\/|$)/u, '') || '/'
  if (queryCode || pathname === '/resume') {
    const target = pathname === '/resume'
      ? canonical.replace(/\/resume(?=\/|$)/u, '/profile')
      : canonical
    if (target !== to.fullPath) return navigateTo(target, { redirectCode: 301 })
  }
})
