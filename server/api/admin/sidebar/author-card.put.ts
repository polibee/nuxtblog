import { requirePermission } from '../../../utils/auth'
import { isBlogDbReady } from '../../../repositories/db.server'
import { saveAuthorCardAdmin } from '../../../modules/sidebar/author-card.service'

/** PUT /api/admin/sidebar/author-card — create or update the author
    card row from the visual form (config JSON is storage-only). */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'sidebar-cards.edit')
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  return saveAuthorCardAdmin(await readBody(event))
})
