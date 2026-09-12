import { createError } from 'h3'
import { eq, and, sql } from 'drizzle-orm'
import { findOrderByNumber } from '../../../../../repositories/order.repository'
import { getDb, isBlogDbReady } from '../../../../../repositories/db.server'
import { deliveries, orderItems } from '../../../../../repositories/schema/orders'
import { inventoryItems } from '../../../../../repositories/schema/products'
import { decryptSecret } from '../../../../../utils/encryption'
import { hitRateLimit } from '../../../../../utils/rate-limit'

/** POST /api/public/orders/:orderNumber/delivery/reveal — structured_reveal
    step 2 (commerce doc §6.2): return the full delivery content for a
    delivered order item and record reveal statistics. Body: { deliveryId }. */
export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const limit = hitRateLimit({ key: 'delivery-reveal', identity: ip, limit: 30, windowMs: 60_000 })
  if (!limit.allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  const orderNumber = getRouterParam(event, 'orderNumber') ?? ''
  const body = await readBody(event) as { deliveryId?: number } | null
  const deliveryId = Number(body?.deliveryId)
  if (!Number.isInteger(deliveryId) || deliveryId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'deliveryId is required' })
  }

  const order = await findOrderByNumber(orderNumber)
  if (!order) {
    throw createError({ statusCode: 404, statusMessage: 'Order not found' })
  }
  if (order.paymentStatus !== 'captured') {
    throw createError({ statusCode: 409, statusMessage: 'Order is not paid yet' })
  }

  const [delivery] = await getDb()
    .select()
    .from(deliveries)
    .where(and(eq(deliveries.id, deliveryId), eq(deliveries.orderId, order.id)))
    .limit(1)
  if (!delivery) {
    throw createError({ statusCode: 404, statusMessage: 'Delivery not found' })
  }

  const now = new Date()
  await getDb().update(deliveries).set({
    revealCount: sql`${deliveries.revealCount} + 1`,
    firstRevealedAt: delivery.firstRevealedAt ?? now,
    lastRevealedAt: now
  }).where(eq(deliveries.id, deliveryId))

  const delivered = await getDb().select({
    id: inventoryItems.id,
    secretCiphertext: inventoryItems.secretCiphertext,
    secretNonce: inventoryItems.secretNonce,
    secretAuthTag: inventoryItems.secretAuthTag
  }).from(inventoryItems).where(eq(inventoryItems.orderId, order.id))

  const secrets: Array<{ id: number, secret: string }> = []
  for (const item of delivered) {
    try {
      secrets.push({
        id: item.id,
        secret: decryptSecret({
          ciphertext: item.secretCiphertext,
          nonce: item.secretNonce,
          authTag: item.secretAuthTag
        })
      })
    } catch {
      // decryption failure: skip silently, never leak partial data
    }
  }
  if (secrets.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'No delivered content for this order' })
  }
  return { secrets }
})
