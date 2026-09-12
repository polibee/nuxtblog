import { requirePermission } from '../../../../utils/auth'
import { cancelOrderById } from '../../../../modules/store/order-lifecycle.service'
import { isBlogDbReady } from '../../../../repositories/db.server'

/** POST /api/admin/orders/:id/cancel — cancel pending order + release inventory */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'store.orders.manage')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  await cancelOrderById(id)
  return { ok: true }
})
