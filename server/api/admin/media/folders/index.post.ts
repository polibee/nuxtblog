import { createError } from 'h3'
import { requirePermission } from '../../../../utils/auth'
import { getDb, isBlogDbReady } from '../../../../repositories/db.server'
import { mediaFolders } from '../../../../repositories/schema/media'

/** POST /api/admin/media/folders — create a media category */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'media.create')
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  const body = await readBody(event) as { name?: string } | null
  const name = body?.name?.trim() ?? ''
  if (!name || name.length > 80) {
    throw createError({ statusCode: 400, statusMessage: 'name is required (max 80 chars)' })
  }
  const [row] = await getDb().insert(mediaFolders).values({ name })
  return { id: row!.insertId }
})
