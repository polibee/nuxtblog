import { asc } from 'drizzle-orm'
import { requirePermission } from '../../../../utils/auth'
import { getDb, isBlogDbReady } from '../../../../repositories/db.server'
import { adSlots } from '../../../../repositories/schema/advertising'

/** GET /api/admin/advertising/slots — ad slot list */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'advertising.view')
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  const items = await getDb().select().from(adSlots).orderBy(asc(adSlots.id))
  return { items, total: items.length, page: 1, perPage: Math.max(items.length, 1), totalPages: 1 }
})
