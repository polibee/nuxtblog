import { resolveLocale } from '../../../utils/locale'
import { getPublicPageByAlias } from '../../../modules/pages/page.service'
import { isBlogDbReady } from '../../../repositories/db.server'

/** GET /api/public/pages/:slug — one published page in the resolved locale */
export default defineEventHandler(async (event) => {
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  const alias = getRouterParam(event, 'alias') ?? ''
  const query = getQuery(event) as { locale?: string }
  const locale = query.locale
    ? { code: query.locale }
    : await resolveLocale(event.path, getRequestHeader(event, 'accept-language'))
  const page = await getPublicPageByAlias(locale.code, alias)
  if (!page) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
  }
  return page
})
