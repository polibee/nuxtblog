import { requirePermission } from '../../../utils/auth'
import { PROVIDER_TEMPLATES } from '../../../modules/payments/provider-registry'

/** GET /api/admin/payment-gateways/providers — channel templates that
    drive the visual gateway manager UI. */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'store.payments.view')
  return { providers: PROVIDER_TEMPLATES }
})
