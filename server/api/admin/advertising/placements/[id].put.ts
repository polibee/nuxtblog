import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { requirePermission } from '../../../../utils/auth'
import { getDb, isBlogDbReady } from '../../../../repositories/db.server'
import { adPlacements } from '../../../../repositories/schema/advertising'

/** PUT /api/admin/advertising/placements/:id */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'advertising.edit')
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  const body = await readBody(event) as {
    slotKey?: string
    campaignId?: number
    priority?: number
    enabled?: boolean
  } | null
  const patch: { slotKey?: string, campaignId?: number, priority?: number, enabled?: boolean } = {}
  if (body?.slotKey !== undefined && body.slotKey.trim()) patch.slotKey = body.slotKey.trim()
  if (body?.campaignId !== undefined && Number.isInteger(Number(body.campaignId))) patch.campaignId = Number(body.campaignId)
  if (body?.priority !== undefined) patch.priority = Number(body.priority) || 0
  if (body?.enabled !== undefined) patch.enabled = body.enabled
  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Nothing to update' })
  }
  await getDb().update(adPlacements).set(patch).where(eq(adPlacements.id, id))
  return { ok: true }
})
