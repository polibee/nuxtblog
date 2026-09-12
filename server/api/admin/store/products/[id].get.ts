import { createError } from 'h3'
import { requirePermission } from '../../../../utils/auth'
import { getProductForAdmin } from '../../../../modules/store/store.service'

/** GET /api/admin/store/products/:id — product detail with translations map */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'store.products.view')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  const product = await getProductForAdmin(id)
  if (!product) {
    throw createError({ statusCode: 404, statusMessage: `Product #${id} not found` })
  }
  return product
})
