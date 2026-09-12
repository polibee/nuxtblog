import { createError } from 'h3'
import { requirePermission } from '../../../../utils/auth'
import { getDb, isBlogDbReady } from '../../../../repositories/db.server'
import { adPlacements } from '../../../../repositories/schema/advertising'

/** POST /api/admin/advertising/placements — bind a campaign to a slot */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'advertising.create')
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  const body = await readBody(event) as {
    slotKey?: string
    campaignId?: number
    priority?: number
    enabled?: boolean
  } | null
  const slotKey = body?.slotKey?.trim() ?? ''
  const campaignId = Number(body?.campaignId)
  if (!slotKey) {
    throw createError({ statusCode: 400, statusMessage: 'slotKey is required' })
  }
  if (!Number.isInteger(campaignId) || campaignId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'campaignId is required' })
  }
  const [row] = await getDb().insert(adPlacements).values({
    slotKey,
    campaignId,
    priority: Number.isInteger(body?.priority) ? Number(body!.priority) : 0,
    enabled: body?.enabled ?? true
  })
  return { id: row!.insertId }
})
