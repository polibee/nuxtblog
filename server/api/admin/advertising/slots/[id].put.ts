import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { requirePermission } from '../../../../utils/auth'
import { getDb, isBlogDbReady } from '../../../../repositories/db.server'
import { adSlots } from '../../../../repositories/schema/advertising'

/** PUT /api/admin/advertising/slots/:id — update name/enabled */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'advertising.edit')
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  const body = await readBody(event) as { name?: string, enabled?: boolean } | null
  const patch: { name?: string, enabled?: boolean } = {}
  if (body?.name !== undefined && body.name.trim()) patch.name = body.name.trim()
  if (body?.enabled !== undefined) patch.enabled = body.enabled
  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Nothing to update' })
  }
  await getDb().update(adSlots).set(patch).where(eq(adSlots.id, id))
  return { ok: true }
})
