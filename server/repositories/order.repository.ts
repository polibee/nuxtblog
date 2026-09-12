import { and, eq, lt } from 'drizzle-orm'
import { getDb, isBlogDbReady } from './db.server'
import { orderItems, orders } from './schema/orders'

export interface OrderRow {
  id: number
  orderNumber: string
  userId: number | null
  email: string
  currency: string
  subtotalMinor: number
  totalMinor: number
  status: string
  paymentStatus: string
  fulfillmentStatus: string
  createdAt: Date
}

export async function findOrderRow(id: number): Promise<OrderRow | undefined> {
  const rows = await getDb().select().from(orders).where(eq(orders.id, id)).limit(1)
  return rows[0]
}

export async function findOrderByNumber(orderNumber: string): Promise<OrderRow | undefined> {
  const rows = await getDb().select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1)
  return rows[0]
}

export async function insertOrder(input: {
  orderNumber: string
  userId: number | null
  email: string
  localeId: number
  currency: string
  subtotalMinor: number
  totalMinor: number
  status: string
  expiresAt: Date | null
}): Promise<number> {
  const [row] = await getDb().insert(orders).values(input)
  if (!row) throw new Error('order insert returned no id')
  return row.insertId
}

export async function updateOrderStatus(id: number, patch: {
  status?: string
  paymentStatus?: string
  fulfillmentStatus?: string
  paidAt?: Date | null
  fulfilledAt?: Date | null
  canceledAt?: Date | null
}): Promise<void> {
  await getDb().update(orders).set(patch).where(eq(orders.id, id))
}

export async function insertOrderItem(input: {
  orderId: number
  productId: number
  productAliasSnapshot: string
  productTitleSnapshot: string
  productTypeSnapshot: string
  unitAmountMinor: number
  quantity: number
  totalAmountMinor: number
  currency: string
}): Promise<void> {
  await getDb().insert(orderItems).values(input)
}

export function generateOrderNumber(): string {
  const ts = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).toUpperCase().slice(2, 6)
  return `ORD-${ts}${rand}`
}

/** release expired orders: mark expired + release reserved inventory */
export async function expireOldOrders(): Promise<number> {
  if (!isBlogDbReady()) return 0
  const now = new Date()
  const result = await getDb()
    .update(orders)
    .set({ status: 'expired', paymentStatus: 'canceled' })
    .where(and(
      eq(orders.status, 'pending_payment'),
      lt(orders.expiresAt, now)
    ))
  return result[0]?.affectedRows ?? 0
}
