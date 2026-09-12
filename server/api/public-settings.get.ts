import { withPageCache } from '../utils/pageCache'
import { resolveLocale, withLocaleKey } from '../utils/locale'
import { listLocales } from '../repositories/locale.repository'
import { localizedSettingsMap, publicSettingsMap } from '../modules/settings/settings.runtime.service'
import { isBlogDbReady } from '../repositories/db.server'

/**
 * Public settings endpoint for the frontend/theme layer.
 * Only exposes settings flagged `public` and never `secret`-typed values.
 * With ?locale=<code>, localized values (e.g. SITE_DESCRIPTION) override
 * the plain ones for that content locale. Cache key is locale-scoped.
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event) as { locale?: string }
  let localeCode = query.locale?.trim() ?? ''
  if (!localeCode && isBlogDbReady()) {
    localeCode = (await resolveLocale(event.path, getRequestHeader(event, 'accept-language'))).code
  }

  const { body } = await withPageCache(
    withLocaleKey('public-settings', localeCode || 'default'),
    async () => {
      const exposed = await publicSettingsMap()
      if (localeCode && isBlogDbReady()) {
        const locales = await listLocales()
        const match = locales.find(l => l.code.toLowerCase() === localeCode.toLowerCase())
        if (match) {
          const localized = await localizedSettingsMap(match.id)
          for (const [key, value] of Object.entries(localized)) {
            if (key in exposed) exposed[key] = value
          }
        }
      }
      return JSON.stringify(exposed)
    },
    { ttlSec: 600 }
  )
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  return JSON.parse(body)
})
