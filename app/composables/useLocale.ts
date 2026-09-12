import type { ResolvedLocale } from '#shared/types/locale'

/* Content locale state for the public site. Dev phase only serves the
   default locale (no url prefix); P20 activates prefixed routes. */

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

  function setLocale(code: string): void {
    const cookie = useCookie<string>(BLOG_COOKIE, {
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax'
    })
    cookie.value = code
    locale.value = { ...locale.value, code }
    // P20: navigate to the prefixed content route and refetch lists
  }

  return { locale, localeCode, localePrefix, setLocale }
}
