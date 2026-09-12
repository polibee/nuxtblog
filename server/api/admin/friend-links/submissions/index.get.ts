import { requirePermission } from '../../../../utils/auth'
import { listSubmissions } from '../../../../modules/friend-links/friend-links.runtime.service'

/** GET /api/admin/friend-links/submissions?status= — review queue (§41). */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'friend-links.view')
  const query = getQuery(event) as { status?: string }
  return { items: await listSubmissions(query.status) }
})
