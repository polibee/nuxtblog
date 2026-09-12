import { requirePermission, getSessionUser } from '../../../../../utils/auth'
import { purchaseCampaign } from '../../../../../modules/advertising/ad-purchase.service'

/** POST /api/admin/advertising/campaigns/:id/purchase — create the
    budget order through the shadow product; redirect the operator to
    the standard checkout for gateway payment. */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'advertising.edit')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  const body = await readBody(event) as { budgetMinor?: number, currency?: string }
  const user = await getSessionUser(event)
  const buyer = user ? { id: user.id, email: user.email } : null
  return purchaseCampaign(id, { budgetMinor: Number(body.budgetMinor), currency: body.currency }, buyer)
})
