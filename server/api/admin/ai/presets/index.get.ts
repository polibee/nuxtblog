import { requirePermission } from '../../../../utils/auth'
import { listPresets } from '../../../../modules/ai/presets.service'

/** GET /api/admin/ai/presets?all=1 — enabled presets for the picker;
    all=1 includes disabled ones (manager page). */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'ai.use')
  const includeAll = getQuery(event).all === '1'
  return { presets: await listPresets(includeAll) }
})
