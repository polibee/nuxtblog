import { cacheStatsSnapshot, invalidatePageCache } from '../../../utils/pageCache'
import { requirePermission } from '../../../utils/auth'

/** POST /api/admin/cache/clear — purge every cached page */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'settings.edit')
  const purged = await invalidatePageCache()
  return { ok: true, purged, stats: await cacheStatsSnapshot() }
})
