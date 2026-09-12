import { eq } from 'drizzle-orm'
import { requirePermission } from '../../../../utils/auth'
import { getDb, isBlogDbReady } from '../../../../repositories/db.server'
import { adCreatives } from '../../../../repositories/schema/advertising'

/** DELETE /api/admin/advertising/creatives/:id */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'advertising.delete')
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  await getDb().delete(adCreatives).where(eq(adCreatives.id, id))
  return { ok: true }
})
