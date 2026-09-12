import { requirePermission } from '../../../../../utils/auth'
import { campaignPayments } from '../../../../../modules/advertising/ad-purchase.service'

/** GET /api/admin/advertising/campaigns/:id/payments — orders, payment
    attempts (gateways) and financial transactions for this campaign. */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'advertising.view')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  return { payments: await campaignPayments(id) }
})
