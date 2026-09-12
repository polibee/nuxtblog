import { resolveLocale } from '../../utils/locale'
import { listLocales } from '../../repositories/locale.runtime.repository'
import { listPublishedPages } from '../../repositories/page.runtime.repository'
import { isDomainDbReady } from '../../repositories/domain-status'

/** GET /api/public/pages — published pages for the resolved locale (footer/nav use) */
export default defineEventHandler(async (event) => {
  if (!isDomainDbReady()) return { pages: [] }
  const query = getQuery(event) as { locale?: string }
  const locale = query.locale
    ? { code: query.locale }
    : await resolveLocale(event.path, getRequestHeader(event, 'accept-language'))
  const locales = await listLocales()
  const localeId = locales.find(l => l.code === locale.code)?.id
  if (!localeId) return { pages: [] }
  const pages = await listPublishedPages(localeId)
  return { pages: pages.map(p => ({ alias: p.alias, title: p.title })) }
})
