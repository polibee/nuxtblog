import { cacheStatsSnapshot } from '../../../utils/pageCache'
import { requirePermission } from '../../../utils/auth'

/** GET /api/admin/cache/stats — hit/miss metrics for the monitor widget */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'settings.edit')
  return await cacheStatsSnapshot()
})
