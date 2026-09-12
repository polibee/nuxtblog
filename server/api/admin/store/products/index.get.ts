import { requirePermission } from '../../../../utils/auth'
import { listProductsForAdmin } from '../../../../modules/store/store.service'
import type { Paginated } from '#shared/types/api'

/** GET /api/admin/store/products — paginated product list for the admin table */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'store.products.view')
  const query = getQuery(event) as { page?: number, perPage?: number }
  const page = Math.max(Number(query.page) || 1, 1)
  const perPage = Math.min(Math.max(Number(query.perPage) || 20, 1), 100)

  const items = await listProductsForAdmin()
  const total = items.length
  const start = (page - 1) * perPage
  const result: Paginated<(typeof items)[number]> = {
    items: items.slice(start, start + perPage),
    total,
    page,
    perPage,
    totalPages: Math.max(Math.ceil(total / perPage), 1)
  }
  return result
})
