import { desc } from 'drizzle-orm'
import { createError } from 'h3'
import { requirePermission } from '../../../../utils/auth'
import { getDb, isBlogDbReady } from '../../../../repositories/db.server'
import { adCampaigns } from '../../../../repositories/schema/advertising'

/** GET /api/admin/advertising/campaigns */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'advertising.view')
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  const items = await getDb().select().from(adCampaigns).orderBy(desc(adCampaigns.createdAt))
  return { items, total: items.length, page: 1, perPage: Math.max(items.length, 1), totalPages: 1 }
})
