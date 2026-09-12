import { resolveLocale } from '../../utils/locale'
import { resolveNavigation } from '../../modules/navigation/navigation.service'
import { isBlogDbReady } from '../../repositories/db.server'

/** GET /api/public/navigation?location=header&locale=zh-CN — public DTO (spec §8.2) */
export default defineEventHandler(async (event) => {
  if (!isBlogDbReady()) {
    return { location: String(getQuery(event).location ?? 'header'), locale: '', fallbackUsed: false, items: [] }
  }
  const query = getQuery(event) as { location?: string, locale?: string }
  const location = query.location ?? 'header'
  const locale = query.locale
    ? { code: query.locale }
    : await resolveLocale(event.path, getRequestHeader(event, 'accept-language'))
  return resolveNavigation(location, locale.code)
})
