import { resolveLocale } from '../../utils/locale'
import { getPublicArchive } from '../../modules/posts/post.service'
import { listLocales } from '../../repositories/locale.repository'
import { isBlogDbReady } from '../../repositories/db.server'

/** GET /api/public/archive — published posts (year/month/day) for the archive page */
export default defineEventHandler(async (event) => {
  if (!isBlogDbReady()) return { items: [] }
  const query = getQuery(event) as { locale?: string }
  const locale = query.locale
    ? { code: query.locale }
    : await resolveLocale(event.path, getRequestHeader(event, 'accept-language'))
  const locales = await listLocales()
  const localeId = locales.find(l => l.code === locale.code)?.id
  if (!localeId) return { items: [] }
  return getPublicArchive(locale.code)
})
