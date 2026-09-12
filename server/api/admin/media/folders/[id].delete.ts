import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { requirePermission } from '../../../../utils/auth'
import { getDb, isBlogDbReady } from '../../../../repositories/db.server'
import { media, mediaFolders } from '../../../../repositories/schema/media'

/** DELETE /api/admin/media/folders/:id — delete a category; its media
    simply become uncategorised (folder_id has no FK by design). */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'media.delete')
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  const result = await getDb().delete(mediaFolders).where(eq(mediaFolders.id, id))
  if ((result[0]?.affectedRows ?? 0) === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Folder not found' })
  }
  await getDb().update(media).set({ folderId: null }).where(eq(media.folderId, id))
  return { ok: true }
})
