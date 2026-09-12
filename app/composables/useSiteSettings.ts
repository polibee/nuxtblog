/* Site identity from public settings, locale-aware (P02). Falls back
   to static defaults while loading or when the DB is unavailable. */

export type PublicSettings = Record<string, string | number | boolean>

export function useSiteSettings() {
  const { localeCode } = useLocale()

  const { data } = useFetch<PublicSettings>('/api/public-settings', {
    key: `public-settings-${localeCode.value}`,
    query: { locale: localeCode },
    lazy: true
  })

  const settings = computed<PublicSettings>(() => data.value ?? {})

  const siteName = computed(() => {
    const name = settings.value.SITE_NAME
    return typeof name === 'string' && name.trim() ? name : 'Blog Framework'
  })
  const siteDescription = computed(() => {
    const value = settings.value.SITE_DESCRIPTION
    return typeof value === 'string' ? value : ''
  })
  const siteUrl = computed(() => {
    const value = settings.value.SITE_URL
    return typeof value === 'string' ? value : ''
  })

  return { settings, siteName, siteDescription, siteUrl }
}
