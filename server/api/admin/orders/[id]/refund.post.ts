import { requirePermission } from '../../../../utils/auth'
import { refundOrderViaGateway } from '../../../../modules/payments/gateway-manager'
import { isBlogDbReady, getDb } from '../../../../repositories/db.server'
import { eq } from 'drizzle-orm'
import { orders } from '../../../../repositories/schema/orders'

/** POST /api/admin/orders/:id/refund — gateway refund when a captured
    attempt exists, otherwise records a local refund transaction. */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'store.orders.refund')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  const [order] = await getDb().select().from(orders).where(eq(orders.id, id)).limit(1)
  if (!order) {
    throw createError({ statusCode: 404, statusMessage: `Order #${id} not found` })
  }
  const result = await refundOrderViaGateway(order)
  return { ok: true, viaGateway: result.viaGateway }
})
