import { requirePermission } from '../../../../utils/auth'
import { listAiProviders } from '../../../../modules/ai/ai.service'

/** GET /api/admin/ai/settings — provider list with masked keys */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'ai.use')
  return { providers: await listAiProviders() }
})
