import { requirePermission } from '../../../../utils/auth'
import { updateProduct } from '../../../../modules/store/store.service'

/** PUT /api/admin/store/products/:id — update product (scalars + replace translations/prices) */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'store.products.edit')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  const body = await readBody(event)
  await updateProduct(id, body)
  return { ok: true }
})
