import { createError } from 'h3'
import { findOrderByNumber } from '../../../../repositories/order.repository'
import { listPaymentAttemptsForOrder } from '../../../../repositories/payment.repository'
import { captureAttempt, syncPaymentStatus } from '../../../../modules/payments/gateway-manager'

/** GET /api/public/payments/:gateway/return?order=ORD-XXX — buyer came back
    from the provider. The redirect itself never confirms payment; state is
    advanced only by server-side sync/capture (§9.5). */
export default defineEventHandler(async (event) => {
  const gatewayKey = getRouterParam(event, 'gateway') ?? ''
  const query = getQuery(event)
  const orderNumber = typeof query.order === 'string' ? query.order : ''

  let state = 'unknown'
  try {
    await syncPaymentStatus(orderNumber)
    const order = await findOrderByNumber(orderNumber)
    if (!order) throw createError({ statusCode: 404, statusMessage: 'Order not found' })
    if (order.status === 'pending_payment' && order.paymentStatus !== 'captured') {
      const attempts = await listPaymentAttemptsForOrder(order.id)
      const latest = attempts.find(a => a.gatewayKey === gatewayKey)
      if (latest && latest.status === 'approved') {
        await captureAttempt(latest, order)
      }
    }
    state = (await findOrderByNumber(orderNumber))?.paymentStatus ?? order.paymentStatus
  } catch {
    state = 'error'
  }
  await sendRedirect(event, `/checkout/${encodeURIComponent(orderNumber)}?payment=${encodeURIComponent(state)}`, 302)
})
