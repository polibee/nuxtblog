import { requirePermission } from '../../../../../utils/auth'
import { rejectCampaign } from '../../../../../modules/advertising/ad-purchase.service'

/** POST /api/admin/advertising/campaigns/:id/reject — compliance review
    fail; the note is stored on the campaign. */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'advertising.edit')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  const body = await readBody(event) as { note?: string }
  await rejectCampaign(id, String(body?.note ?? ''))
  return { ok: true }
})
