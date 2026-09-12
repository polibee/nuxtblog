import { requirePermission } from '../../../utils/auth'
import { listPublishedProducts } from '../../../modules/store/store.repository'
import { resolveLocale } from '../../../utils/locale'

/** GET /api/public/store/products — published products for the resolved locale */
export default defineEventHandler(async (event) => {
  const query = getQuery(event) as { locale?: string }
  const locale = query.locale
    ? { code: query.locale }
    : await resolveLocale(event.path, getRequestHeader(event, 'accept-language'))
  return { products: await listPublishedProducts(locale.code) }
})
