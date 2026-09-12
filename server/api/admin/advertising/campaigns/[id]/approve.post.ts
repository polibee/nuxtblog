import { requirePermission } from '../../../../../utils/auth'
import { approveCampaign } from '../../../../../modules/advertising/ad-purchase.service'

/** POST /api/admin/advertising/campaigns/:id/approve — compliance review
    pass: activates the campaign and auto-builds creative + placement. */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'advertising.edit')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  await approveCampaign(id)
  return { ok: true }
})
