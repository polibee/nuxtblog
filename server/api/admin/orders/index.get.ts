import { requirePermission } from '../../../utils/auth'
import { getDb, isBlogDbReady } from '../../../repositories/db.server'
import { orders } from '../../../repositories/schema/orders'
import { desc, sql } from 'drizzle-orm'
import type { Paginated } from '#shared/types/api'

/** GET /api/admin/orders — list all orders */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'store.orders.view')
  if (!isBlogDbReady()) {
    return { items: [], total: 0, page: 1, perPage: 20, totalPages: 1 }
  }
  const query = getQuery(event) as { page?: number, perPage?: number }
  const page = Math.max(Number(query.page) || 1, 1)
  const perPage = Math.min(Math.max(Number(query.perPage) || 20, 1), 100)
  const rows = await getDb()
    .select()
    .from(orders)
    .orderBy(desc(orders.createdAt))
    .limit(perPage)
    .offset((page - 1) * perPage)
  const [total] = await getDb().select({ total: sql<number>`count(*)` }).from(orders)
  const totalCount = Number(total?.total ?? 0)
  const result: Paginated<(typeof rows)[number]> = {
    items: rows,
    total: totalCount,
    page,
    perPage,
    totalPages: Math.max(Math.ceil(totalCount / perPage), 1)
  }
  return result
})
