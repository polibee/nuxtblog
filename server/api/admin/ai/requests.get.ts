import { requirePermission } from '../../../utils/auth'
import { recentAiRequests } from '../../../modules/ai/ai.service'

/** GET /api/admin/ai/requests — recent AI usage (§83/111) */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'ai.use')
  return { requests: await recentAiRequests(20) }
})
