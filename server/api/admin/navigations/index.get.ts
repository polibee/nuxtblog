import { requirePermission } from '../../../utils/auth'
import { listNavigations } from '../../../modules/navigation/navigation.service'
import type { Paginated } from '#shared/types/api'

/** GET /api/admin/navigations — locations with their locale variants */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'navigation.view')
  const items = await listNavigations()
  const result: Paginated<(typeof items)[number]> = {
    items,
    total: items.length,
    page: 1,
    perPage: Math.max(items.length, 1),
    totalPages: 1
  }
  return result
})
