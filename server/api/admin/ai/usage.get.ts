import { requirePermission } from '../../../utils/auth'
import { getAiUsageReport } from '../../../modules/ai/ai.service'

/** GET /api/admin/ai/usage — aggregated AI telemetry without prompt content. */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'ai.use')
  const days = Number(getQuery(event).days ?? 30)
  return { report: await getAiUsageReport(Number.isFinite(days) ? days : 30) }
})
