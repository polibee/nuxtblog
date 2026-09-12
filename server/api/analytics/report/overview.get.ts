import { requirePermission } from '../../../utils/auth'
import {
  getDailyTrend,
  getOverview,
  getTopPages,
  getTopSources
} from '../../../repositories/analytics.repository'
import { isBlogDbReady } from '../../../repositories/db.server'

/** GET /api/analytics/report/overview?days=7 */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'analytics.view')
  if (!isBlogDbReady()) {
    return { overview: { pageviews: 0, sessions: 0, visitors: 0, bounceRate: 0 }, trend: [], sources: [], pages: [] }
  }
  const query = getQuery(event) as { days?: string }
  const days = Math.min(Math.max(Number(query.days) || 7, 1), 90)
  const [overview, trend, sources, pages] = await Promise.all([
    getOverview(days),
    getDailyTrend(days),
    getTopSources(days, 10),
    getTopPages(days, 10)
  ])
  return { overview, trend, sources, pages }
})
