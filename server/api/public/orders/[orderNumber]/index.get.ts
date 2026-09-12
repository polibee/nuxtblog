import { eq } from 'drizzle-orm'
import { findOrderByNumber } from '../../../../repositories/order.repository'
import { getDb, isBlogDbReady } from '../../../../repositories/db.server'
import { deliveries, orderItems } from '../../../../repositories/schema/orders'
import { inventoryItems, products } from '../../../../repositories/schema/products'
import { decryptSecret, maskSecret } from '../../../../utils/encryption'
import { hitRateLimit } from '../../../../utils/rate-limit'

/** GET /api/public/orders/:orderNumber — order status for the checkout page.
    The order number acts as the capability token. Delivered card-key
    secrets decrypt on demand once payment is captured; structured_reveal
    products return masked content until the reveal endpoint is called. */
export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const limit = hitRateLimit({ key: 'order-view', identity: ip, limit: 120, windowMs: 60_000 })
  if (!limit.allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  const orderNumber = getRouterParam(event, 'orderNumber') ?? ''
  const order = await findOrderByNumber(orderNumber)
  if (!order) {
    throw createError({ statusCode: 404, statusMessage: 'Order not found' })
  }

  const items = await getDb().select({
    productId: orderItems.productId,
    productAlias: orderItems.productAliasSnapshot,
    title: orderItems.productTitleSnapshot,
    quantity: orderItems.quantity,
    unitAmountMinor: orderItems.unitAmountMinor,
    totalAmountMinor: orderItems.totalAmountMinor,
    currency: orderItems.currency
  }).from(orderItems).where(eq(orderItems.orderId, order.id))

  // per-item delivery strategy from the (live) product row; deleted products
  // degrade to one_time_reveal so the buyer never loses access
  const strategies = new Map<number, string>()
  for (const item of items) {
    const [product] = await getDb()
      .select({ strategy: products.deliveryStrategy })
      .from(products)
      .where(eq(products.id, item.productId))
      .limit(1)
    strategies.set(item.productId, product?.strategy ?? 'one_time_reveal')
  }

  const deliveryList: Array<{ id: number, strategy: string, secret?: string, masked?: string, deliveryRowId?: number }> = []
  if (order.paymentStatus === 'captured') {
    const [deliveryRow] = await getDb()
      .select({ id: deliveries.id })
      .from(deliveries)
      .where(eq(deliveries.orderId, order.id))
      .limit(1)
    const delivered = await getDb().select({
      id: inventoryItems.id,
      productId: inventoryItems.productId,
      secretCiphertext: inventoryItems.secretCiphertext,
      secretNonce: inventoryItems.secretNonce,
      secretAuthTag: inventoryItems.secretAuthTag
    }).from(inventoryItems).where(eq(inventoryItems.orderId, order.id))
    for (const item of delivered) {
      const strategy = strategies.get(item.productId) ?? 'one_time_reveal'
      try {
        const secret = decryptSecret({
          ciphertext: item.secretCiphertext,
          nonce: item.secretNonce,
          authTag: item.secretAuthTag
        })
        deliveryList.push(strategy === 'structured_reveal'
          ? { id: item.id, strategy, masked: maskSecret(secret), deliveryRowId: deliveryRow?.id }
          : { id: item.id, strategy, secret })
      } catch {
        // decryption failure (e.g. key rotation): never leak partial data
      }
    }
  }

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    totalMinor: order.totalMinor,
    currency: order.currency,
    createdAt: order.createdAt,
    items: items.map(({ productId, ...rest }) => ({ ...rest, deliveryStrategy: strategies.get(productId) ?? 'one_time_reveal' })),
    deliveries: deliveryList
  }
})
