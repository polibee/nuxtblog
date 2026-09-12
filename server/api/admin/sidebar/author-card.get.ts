import { eq } from 'drizzle-orm'
import { requirePermission } from '../../../utils/auth'
import { getDb, isBlogDbReady } from '../../../repositories/db.server'
import { sidebarCards } from '../../../repositories/schema/sidebar-cards'

/** GET /api/admin/sidebar/author-card — the author-type card's config
    (single instance; null config until first save). */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'sidebar-cards.view')
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  const [row] = await getDb().select()
    .from(sidebarCards)
    .where(eq(sidebarCards.type, 'author'))
    .limit(1)
  return {
    id: row?.id ?? null,
    enabled: row?.enabled ?? true,
    sortOrder: row?.sortOrder ?? 5,
    config: row?.config ?? null
  }
})
