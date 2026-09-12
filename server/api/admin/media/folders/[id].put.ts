import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { requirePermission } from '../../../../utils/auth'
import { getDb, isBlogDbReady } from '../../../../repositories/db.server'
import { mediaFolders } from '../../../../repositories/schema/media'

/** PUT /api/admin/media/folders/:id — rename a media category */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'media.edit')
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  const body = await readBody(event) as { name?: string }
  const name = String(body?.name ?? '').trim().slice(0, 80)
  if (!name) {
    throw createError({ statusCode: 422, statusMessage: 'Folder name is required' })
  }
  const result = await getDb().update(mediaFolders).set({ name }).where(eq(mediaFolders.id, id))
  if ((result[0]?.affectedRows ?? 0) === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Folder not found' })
  }
  return { ok: true, name }
})
