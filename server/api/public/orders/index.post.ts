import { createOrder } from '../../../modules/store/order.service'
import { getSessionUser } from '../../../utils/auth'
import { hitRateLimit } from '../../../utils/rate-limit'

/** POST /api/public/orders — create order with inventory reservation */
export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const limit = hitRateLimit({ key: 'order', identity: ip, limit: 10, windowMs: 10 * 60_000 })
  if (!limit.allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many orders, try again later' })
  }

  const user = await getSessionUser(event)
  const body = await readBody(event)
  return createOrder(body, user ? { id: user.id, email: user.email } : null)
})
