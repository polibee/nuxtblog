import { requirePermission } from '../../../../utils/auth'
import { listPlansForAdmin } from '../../../../modules/membership/membership.service'
import type { Paginated } from '#shared/types/api'

/** GET /api/admin/membership/plans — membership plans for the admin table */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'store.membership.view')
  const items = await listPlansForAdmin()
  const result: Paginated<(typeof items)[number]> = {
    items,
    total: items.length,
    page: 1,
    perPage: Math.max(items.length, 1),
    totalPages: 1
  }
  return result
})
