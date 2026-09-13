import type { ResolvedLocale } from '#shared/types/locale'
import { localizedPath } from '#shared/utils/locale-navigation'

/* Content locale state for the public site. The route middleware hydrates
   this from the URL first and the cookie second. */

const BLOG_STATE_KEY = 'blog-locale'
const BLOG_COOKIE = 'blog_locale'
const DEFAULT_CODE = 'zh-CN'

export function useLocale() {
  const locale = useState<ResolvedLocale>(BLOG_STATE_KEY, () => ({
    id: null,
    code: DEFAULT_CODE,
    urlPrefix: ''
  }))

  const localeCode = computed(() => locale.value.code)
  const localePrefix = computed(() =>
    locale.value.urlPrefix ? `/${locale.value.urlPrefix}` : ''
  )

  function setLocale(code: string, urlPrefix = ''): void {
    const cookie = useCookie<string>(BLOG_COOKIE, {
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax'
    })
    cookie.value = code
    locale.value = { ...locale.value, code, urlPrefix }
  }

  function publicPath(path: string): string {
    return localizedPath(path, locale.value, locale.value.urlPrefix ? '__default__' : locale.value.code)
  }

  return { locale, localeCode, localePrefix, setLocale, publicPath }
}
