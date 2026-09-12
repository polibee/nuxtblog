import { createError } from 'h3'
import { findPublishedProduct } from '../../../../modules/store/store.repository'
import { resolveLocale } from '../../../../utils/locale'

/** GET /api/public/store/products/:alias — single published product for the resolved locale */
export default defineEventHandler(async (event) => {
  const alias = getRouterParam(event, 'alias') ?? ''
  const query = getQuery(event) as { locale?: string }
  const locale = query.locale
    ? { code: query.locale }
    : await resolveLocale(event.path, getRequestHeader(event, 'accept-language'))
  const product = await findPublishedProduct(alias, locale.code)
  if (!product) {
    throw createError({ statusCode: 404, statusMessage: 'Product not found' })
  }
  return { product }
})
