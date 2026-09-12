import { eq } from 'drizzle-orm'
import { requirePermission } from '../../../../utils/auth'
import { getDb, isBlogDbReady } from '../../../../repositories/db.server'
import { adCampaigns } from '../../../../repositories/schema/advertising'

/** DELETE /api/admin/advertising/campaigns/:id (cascades creatives+placements) */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'advertising.delete')
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  await getDb().delete(adCampaigns).where(eq(adCampaigns.id, id))
  return { ok: true }
})
