import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { requirePermission } from '../../../../utils/auth'
import { getDb, isBlogDbReady } from '../../../../repositories/db.server'
import { adCampaigns } from '../../../../repositories/schema/advertising'

/** PUT /api/admin/advertising/campaigns/:id */
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
    name?: string
    status?: string
    startAt?: string | null
    endAt?: string | null
  } | null
  const patch: { name?: string, status?: string, startAt?: Date | null, endAt?: Date | null } = {}
  if (body?.name !== undefined && body.name.trim()) patch.name = body.name.trim()
  if (body?.status !== undefined && ['draft', 'active', 'paused', 'ended'].includes(body.status)) patch.status = body.status
  if (body?.startAt !== undefined) patch.startAt = body.startAt && !Number.isNaN(Date.parse(body.startAt)) ? new Date(body.startAt) : null
  if (body?.endAt !== undefined) patch.endAt = body.endAt && !Number.isNaN(Date.parse(body.endAt)) ? new Date(body.endAt) : null
  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Nothing to update' })
  }
  await getDb().update(adCampaigns).set(patch).where(eq(adCampaigns.id, id))
  return { ok: true }
})
