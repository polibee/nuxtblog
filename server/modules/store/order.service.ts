import { createError } from 'h3'
import { isBlogDbReady, getDb } from '../../repositories/db.server'
import { products, productTranslations, productPrices } from '../../repositories/schema/products'
import { and, eq, isNull } from 'drizzle-orm'
import { listLocales } from '../../repositories/locale.repository'
import { findOrderByNumber, expireOldOrders, generateOrderNumber, updateOrderStatus } from '../../repositories/order.repository'
import { releaseReserved } from '../../repositories/inventory.repository'

/* Order service (commerce doc §7): server-side pricing, inventory
   reservation, and status machine transitions. All amounts are
   computed from the DB, never from client input. */

export interface CreatedOrder {
  orderNumber: string
  status: string
  totalMinor: number
  currency: string
  expiresAt: string | null
}

const ORDER_TTL_MS = 10 * 60 * 1000

/* shadow products (membership / post access) ride the order+payment
   chain but have no inventory */
const SHADOW_PRODUCT_TYPES = ['membership', 'post_access', 'ad_campaign']

export async function createOrder(body: unknown, user: { id: number, email: string } | null): Promise<CreatedOrder> {
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  const input = body as {
    productAlias?: string
    quantity?: number
    currency?: string
    email?: string
  }
  const productAlias = input.productAlias?.trim() ?? ''
  const guestEmail = typeof input.email === 'string' && input.email.includes('@')
    ? input.email.trim().slice(0, 255)
    : ''
  const quantity = Math.max(1, Math.min(Number(input.quantity) || 1, 100))
  const currency = (input.currency ?? 'USD').toUpperCase()

  const [product] = await getDb()
    .select()
    .from(products)
    .where(and(eq(products.alias, productAlias), isNull(products.deletedAt)))
    .limit(1)
  if (!product) {
    throw createError({ statusCode: 404, statusMessage: 'Product not found' })
  }
  if (product.status !== 'published') {
    throw createError({ statusCode: 422, statusMessage: 'Product is not available for purchase' })
  }
  if (quantity > product.maxQuantityPerOrder) {
    throw createError({ statusCode: 422, statusMessage: `Max ${product.maxQuantityPerOrder} per order` })
  }

  const [price] = await getDb()
    .select()
    .from(productPrices)
    .where(and(
      eq(productPrices.productId, product.id),
      eq(productPrices.currency, currency),
      eq(productPrices.enabled, true)
    ))
    .limit(1)
  if (!price) {
    throw createError({ statusCode: 422, statusMessage: `Price for ${currency} not available` })
  }

  const locales = await listLocales()
  const defaultLocale = locales.find(l => l.isDefault) ?? locales[0]
  const localeId = defaultLocale?.id ?? 1

  // snapshot title from primary locale translation
  const [translation] = await getDb()
    .select()
    .from(productTranslations)
    .where(and(eq(productTranslations.productId, product.id), eq(productTranslations.localeId, product.primaryLocaleId)))
    .limit(1)
  const title = translation?.title ?? product.alias

  const totalMinor = price.amountMinor * quantity
  const orderNumber = generateOrderNumber()
  const orderId = await (async () => {
    const { insertOrder } = await import('../../repositories/order.repository')
    return insertOrder({
      orderNumber,
      userId: user?.id ?? null,
      email: user?.email ?? guestEmail,
      localeId: localeId,
      currency,
      subtotalMinor: totalMinor,
      totalMinor,
      status: 'pending_payment',
      expiresAt: new Date(Date.now() + ORDER_TTL_MS)
    })
  })()

  const { insertOrderItem } = await import('../../repositories/order.repository')
  await insertOrderItem({
    orderId,
    productId: product.id,
    productAliasSnapshot: product.alias,
    productTitleSnapshot: title,
    productTypeSnapshot: product.productType,
    unitAmountMinor: price.amountMinor,
    quantity,
    totalAmountMinor: totalMinor,
    currency
  })

  if (!SHADOW_PRODUCT_TYPES.includes(product.productType)) {
    const { reserveInventory } = await import('../../repositories/inventory.repository')
    await reserveInventory(product.id, quantity, orderId)
  }

  return {
    orderNumber,
    status: 'pending_payment',
    totalMinor,
    currency,
    expiresAt: new Date(Date.now() + ORDER_TTL_MS).toISOString()
  }
}

export async function markOrderPaid(orderId: number): Promise<void> {
  await updateOrderStatus(orderId, {
    status: 'paid',
    paymentStatus: 'captured',
    paidAt: new Date()
  })
}

export async function fulfillOrder(orderId: number): Promise<void> {
  const { deliverReserved } = await import('../../repositories/inventory.repository')
  await deliverReserved(orderId)
  await updateOrderStatus(orderId, {
    status: 'fulfilled',
    fulfillmentStatus: 'delivered',
    fulfilledAt: new Date()
  })
}

export async function cancelOrder(orderId: number): Promise<void> {
  await releaseReserved(orderId)
  await updateOrderStatus(orderId, {
    status: 'canceled',
    paymentStatus: 'canceled',
    canceledAt: new Date()
  })
}

export { findOrderByNumber, expireOldOrders }
