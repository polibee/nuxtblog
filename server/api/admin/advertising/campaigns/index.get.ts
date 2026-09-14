import { desc, eq, inArray } from 'drizzle-orm'
import { createError } from 'h3'
import { requirePermission } from '../../../../utils/auth'
import { getDb, isBlogDbReady } from '../../../../repositories/db.server'
import { adCampaigns, adCreatives, adPlacements, adSlots } from '../../../../repositories/schema/advertising'
import { media } from '../../../../repositories/schema/media'

/** GET /api/admin/advertising/campaigns */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'advertising.view')
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  const db = getDb()
  const items = await db.select().from(adCampaigns).orderBy(desc(adCampaigns.createdAt))
  const creatives = await db.select({ campaignId: adCreatives.campaignId, impressions: adCreatives.impressions, clicks: adCreatives.clicks }).from(adCreatives)
  const creativeRows = await db.select({ id: adCreatives.id, campaignId: adCreatives.campaignId, provider: adCreatives.provider, enabled: adCreatives.enabled, impressions: adCreatives.impressions, clicks: adCreatives.clicks }).from(adCreatives)
  const placementRows = await db.select({ id: adPlacements.id, campaignId: adPlacements.campaignId, slotKey: adPlacements.slotKey, slotName: adSlots.name, priority: adPlacements.priority, enabled: adPlacements.enabled }).from(adPlacements).leftJoin(adSlots, eq(adPlacements.slotKey, adSlots.key))
  const mediaIds = items.map(item => item.materialImageMediaId).filter((id): id is number => Boolean(id))
  const mediaRows = mediaIds.length ? await db.select({ id: media.id, storageKey: media.storageKey }).from(media).where(inArray(media.id, mediaIds)) : []
  const imageUrls = new Map(mediaRows.map(row => [row.id, `/media/${row.storageKey}`]))
  const metrics = new Map<number, { impressions: number, clicks: number }>()
  for (const creative of creatives) {
    const current = metrics.get(creative.campaignId) ?? { impressions: 0, clicks: 0 }
    current.impressions += Number(creative.impressions ?? 0)
    current.clicks += Number(creative.clicks ?? 0)
    metrics.set(creative.campaignId, current)
  }
  const enriched = items.map((item) => {
    const metric = metrics.get(item.id) ?? { impressions: 0, clicks: 0 }
    return {
      ...item,
      ...metric,
      ctr: metric.impressions ? metric.clicks / metric.impressions * 100 : 0,
      materialImageUrl: item.materialImageMediaId ? imageUrls.get(item.materialImageMediaId) ?? null : null,
      creatives: creativeRows.filter(creative => creative.campaignId === item.id),
      placements: placementRows.filter(placement => placement.campaignId === item.id)
    }
  })
  return { items: enriched, total: enriched.length, page: 1, perPage: Math.max(enriched.length, 1), totalPages: 1 }
})
