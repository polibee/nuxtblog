import { requirePermission } from '../../../utils/auth'
import { isBlogDbReady } from '../../../repositories/db.server'
import { getAuthorCardAdmin } from '../../../modules/sidebar/author-card.service'

/** GET /api/admin/sidebar/author-card — the author-type card's config
    (single instance; null config until first save). */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'sidebar-cards.view')
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  return getAuthorCardAdmin()
})
