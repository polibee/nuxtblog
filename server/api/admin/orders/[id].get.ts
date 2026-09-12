import { requirePermission } from '../../../utils/auth'
import { isBlogDbReady, getDb } from '../../../repositories/db.server'
import { orders } from '../../../repositories/schema/orders'
import { eq } from 'drizzle-orm'

/** GET /api/admin/orders/:id — order detail */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'store.orders.view')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  const rows = await getDb()
    .select()
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1)
  const order = rows[0]
  if (!order) {
    throw createError({ statusCode: 404, statusMessage: `Order #${id} not found` })
  }
  return order
})
