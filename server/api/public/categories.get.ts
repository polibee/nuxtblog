import { resolveLocale } from '../../utils/locale'
import { publicTerms } from '../../modules/taxonomy/taxonomy.service'
import { listLocales } from '../../repositories/locale.repository'
import { isBlogDbReady } from '../../repositories/db.server'

/** GET /api/public/categories — category terms for the resolved locale */
export default defineEventHandler(async (event) => {
  if (!isBlogDbReady()) return { categories: [] }
  const query = getQuery(event) as { locale?: string }
  const locale = query.locale
    ? { code: query.locale }
    : await resolveLocale(event.path, getRequestHeader(event, 'accept-language'))
  const locales = await listLocales()
  const localeId = locales.find(l => l.code === locale.code)?.id
  if (!localeId) return { categories: [] }
  return { categories: await publicTerms('category', localeId) }
})
