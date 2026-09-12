import { createError } from 'h3'
import { requirePermission } from '../../../../utils/auth'
import { getDb, isBlogDbReady } from '../../../../repositories/db.server'
import { adSlots } from '../../../../repositories/schema/advertising'

/** POST /api/admin/advertising/slots — create an ad slot */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'advertising.create')
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  const body = await readBody(event) as { key?: string, name?: string, enabled?: boolean } | null
  const key = body?.key?.trim() ?? ''
  const name = body?.name?.trim() ?? ''
  if (!/^[a-z][a-z0-9-]{1,58}$/.test(key)) {
    throw createError({ statusCode: 400, statusMessage: 'key must be a lowercase slug' })
  }
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' })
  }
  try {
    const [row] = await getDb().insert(adSlots).values({ key, name, enabled: body?.enabled ?? true })
    return { id: row!.insertId }
  } catch {
    throw createError({ statusCode: 409, statusMessage: 'Slot key already exists' })
  }
})
