import {
  findOrderByNumber,
  findOrderRow,
  updateOrderStatus,
  type OrderRow
} from '../../repositories/order.repository'
import { releaseReserved, deliverReserved } from '../../repositories/inventory.repository'
import { recordCharge, recordRefund } from '../../repositories/payment.repository'
import { getDb } from '../../repositories/db.server'
import { notifyOrderFailed, notifyOrderPaid, notifyOrderRefunded } from '../notify/notify.service'
import { fulfillShadowOrderItems } from '../membership/membership.service'
import { orderItems, deliveries } from '../../repositories/schema/orders'
import { eq } from 'drizzle-orm'

/* Order lifecycle service (P12): complete status machine transitions
   with payment recording and inventory sync. */

export async function getOrderDetail(orderNumber: string): Promise<OrderRow | undefined> {
  return findOrderByNumber(orderNumber)
}

/** mark order as paid (called by payment gateway capture or mock).
    All v1 products are virtual (commerce doc §2.1/§2.2): payment capture
    triggers automatic delivery of the reserved inventory. */
export async function processPaidOrder(orderId: number, gatewayKey: string, attemptId: number, amountMinor: number, currency: string): Promise<void> {
  await updateOrderStatus(orderId, {
    status: 'paid',
    paymentStatus: 'captured',
    paidAt: new Date()
  })
  await recordCharge(orderId, attemptId, gatewayKey, amountMinor, currency)
  await processFulfillment(orderId)
  const paidRow = await findOrderRow(orderId)
  void notifyOrderPaid(paidRow?.email, paidRow?.orderNumber ?? '', amountMinor, currency)
}

/** fulfill order: deliver reserved inventory and record delivery rows
    (one per order item) for reveal tracking (structured_reveal §6.2) */
export async function processFulfillment(orderId: number): Promise<void> {
  const delivered = await deliverReserved(orderId)
  await fulfillShadowOrderItems(orderId)
  if (delivered.length > 0) {
    const items = await getDb().select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.orderId, orderId))
    const now = new Date()
    for (const item of items) {
      await getDb().insert(deliveries).values({
        orderId,
        orderItemId: item.id,
        status: 'delivered',
        deliveredAt: now
      })
    }
  }
  await updateOrderStatus(orderId, {
    status: 'fulfilled',
    fulfillmentStatus: 'delivered',
    fulfilledAt: new Date()
  })
}

/** cancel a pending order and release inventory */
export async function cancelOrderById(orderId: number): Promise<void> {
  await releaseReserved(orderId)
  await updateOrderStatus(orderId, {
    status: 'canceled',
    paymentStatus: 'canceled',
    canceledAt: new Date()
  })
  const row = await findOrderRow(orderId)
  void notifyOrderFailed(row?.email, row?.orderNumber ?? '')
}

/** refund an order and record refund transaction */
export async function refundOrder(orderId: number, amountMinor: number, currency: string): Promise<void> {
  await updateOrderStatus(orderId, {
    status: 'refunded',
    paymentStatus: 'refunded'
  })
  await recordRefund(orderId, amountMinor, currency, `Refund for order #${orderId}`)
  const row = await findOrderRow(orderId)
  void notifyOrderRefunded(row?.email, row?.orderNumber ?? '', amountMinor, currency)
}
