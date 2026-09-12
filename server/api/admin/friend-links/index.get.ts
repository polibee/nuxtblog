import { and, desc, eq, isNull } from 'drizzle-orm'
import { requirePermission } from '../../../utils/auth'
import { getDb } from '../../../repositories/db.server'
import { friendLinks } from '../../../repositories/schema/friend-links'

/** GET /api/admin/friend-links?status= — friend link list with backlink
    health columns (docs/友链.txt §38). */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'friend-links.view')
  const query = getQuery(event) as { status?: string }
  const db = getDb()
  const conditions = [isNull(friendLinks.deletedAt)]
  if (query.status && ['active', 'disabled', 'broken', 'removed'].includes(query.status)) {
    conditions.push(eq(friendLinks.status, query.status))
  }
  const rows = await db.select().from(friendLinks)
    .where(and(...conditions))
    .orderBy(desc(friendLinks.featured), friendLinks.sortOrder, friendLinks.name)
    .limit(500)
  return { items: rows }
})
