import { requirePermission } from '../../../../utils/auth'
import { createProduct } from '../../../../modules/store/store.service'

export default defineEventHandler(async (event) => {
  const user = await requirePermission(event, 'store.products.create')
  const body = await readBody(event)
  return createProduct(body, user.id)
})
