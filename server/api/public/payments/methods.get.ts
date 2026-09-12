import { listCheckoutMethods } from '../../../modules/payments/gateway-manager'
import { hitRateLimit } from '../../../utils/rate-limit'

/** GET /api/public/payments/methods?currency=USD — enabled checkout gateways */
export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const limit = hitRateLimit({ key: 'payment-methods', identity: ip, limit: 60, windowMs: 60_000 })
  if (!limit.allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }
  const query = getQuery(event)
  const currency = typeof query.currency === 'string' ? query.currency : undefined
  return { methods: await listCheckoutMethods(currency?.toUpperCase()) }
})
