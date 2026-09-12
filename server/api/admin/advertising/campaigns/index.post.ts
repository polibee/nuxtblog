import { createError } from 'h3'
import { requirePermission } from '../../../../utils/auth'
import { getDb, isBlogDbReady } from '../../../../repositories/db.server'
import { adCampaigns } from '../../../../repositories/schema/advertising'

/** POST /api/admin/advertising/campaigns */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'advertising.create')
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  const body = await readBody(event) as {
    name?: string
    status?: string
    startAt?: string | null
    endAt?: string | null
  } | null
  const name = body?.name?.trim() ?? ''
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' })
  }
  const status = ['draft', 'active', 'paused', 'ended'].includes(body?.status ?? '') ? body!.status! : 'draft'
  const parseDate = (v?: string | null) => (v && !Number.isNaN(Date.parse(v)) ? new Date(v) : null)
  const [row] = await getDb().insert(adCampaigns).values({
    name,
    status,
    startAt: parseDate(body?.startAt),
    endAt: parseDate(body?.endAt)
  })
  return { id: row!.insertId }
})
