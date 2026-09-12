import { syncPaymentStatus } from '../../../../../modules/payments/gateway-manager'

/** GET /api/public/orders/:orderNumber/payment/status — local state with
    provider sync; captures server-side when the provider reports completion. */
export default defineEventHandler(async (event) => {
  const orderNumber = getRouterParam(event, 'orderNumber') ?? ''
  return syncPaymentStatus(orderNumber)
})
