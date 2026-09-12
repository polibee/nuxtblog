import { requirePermission } from '../../../utils/auth'
import { listCommentsForAdmin } from '../../../modules/comments/comment.service'
import type { Paginated } from '#shared/types/api'

/** GET /api/admin/comments?status=pending|approved|spam|all */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'comments.view')
  const query = getQuery(event) as { status?: string, limit?: number }
  const items = await listCommentsForAdmin({ status: query.status, limit: Number(query.limit) || 100 })
  const result: Paginated<(typeof items)[number]> = {
    items,
    total: items.length,
    page: 1,
    perPage: Math.max(items.length, 1),
    totalPages: 1
  }
  return result
})
