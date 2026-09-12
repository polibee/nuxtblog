import { asc, eq } from 'drizzle-orm'
import { requirePermission } from '../../../../utils/auth'
import { getDb, isBlogDbReady } from '../../../../repositories/db.server'
import { adSlots, adCampaigns, adPlacements } from '../../../../repositories/schema/advertising'

/** GET /api/admin/advertising/placements — placements with slot/campaign names */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'advertising.view')
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  const items = await getDb()
    .select({
      id: adPlacements.id,
      slotKey: adPlacements.slotKey,
      slotName: adSlots.name,
      campaignId: adPlacements.campaignId,
      campaignName: adCampaigns.name,
      priority: adPlacements.priority,
      enabled: adPlacements.enabled
    })
    .from(adPlacements)
    .leftJoin(adSlots, eq(adPlacements.slotKey, adSlots.key))
    .leftJoin(adCampaigns, eq(adPlacements.campaignId, adCampaigns.id))
    .orderBy(asc(adPlacements.id))
  return { items, total: items.length, page: 1, perPage: Math.max(items.length, 1), totalPages: 1 }
})
