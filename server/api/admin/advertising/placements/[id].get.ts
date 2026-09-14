import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { requirePermission } from '../../../../utils/auth'
import { getDb, isBlogDbReady } from '../../../../repositories/db.server'
import { adCampaigns, adPlacements, adSlots } from '../../../../repositories/schema/advertising'

/** GET /api/admin/advertising/placements/:id — edit form payload */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'advertising.view')
  if (!isBlogDbReady()) throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  const [row] = await getDb().select({ placement: adPlacements, slotName: adSlots.name, campaignName: adCampaigns.name })
    .from(adPlacements).leftJoin(adSlots, eq(adPlacements.slotKey, adSlots.key)).leftJoin(adCampaigns, eq(adPlacements.campaignId, adCampaigns.id))
    .where(eq(adPlacements.id, id)).limit(1)
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Placement not found' })
  return { ...row.placement, slotName: row.slotName, campaignName: row.campaignName }
})
