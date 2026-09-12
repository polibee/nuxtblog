import { startPayment } from '../../../../modules/payments/gateway-manager'
import { hitRateLimit } from '../../../../utils/rate-limit'

/** POST /api/public/orders/:orderNumber/payment — create a payment attempt
    and return the provider approval URL. Body: { gatewayKey } */
export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const limit = hitRateLimit({ key: 'payment-start', identity: ip, limit: 20, windowMs: 60_000 })
  if (!limit.allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many payment attempts, try again later' })
  }
  const orderNumber = getRouterParam(event, 'orderNumber') ?? ''
  const body = await readBody(event) as { gatewayKey?: string } | null
  const gatewayKey = body?.gatewayKey?.trim()
  if (!gatewayKey) {
    throw createError({ statusCode: 400, statusMessage: 'gatewayKey is required' })
  }
  const origin = getRequestURL(event).origin
  return startPayment(orderNumber, gatewayKey, origin)
})
