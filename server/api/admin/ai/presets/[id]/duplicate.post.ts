import { requirePermission, getSessionUser } from '../../../../../utils/auth'
import { duplicatePreset } from '../../../../../modules/ai/presets.service'

/** POST /api/admin/ai/presets/:id/duplicate — "Duplicate & Customize"
    for built-ins (§34) or personal copies of custom presets. */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'ai.use')
  const user = await getSessionUser(event)
  const id = Number(getRouterParam(event, 'id')) || 0
  if (!id) {
    throw createError({ statusCode: 422, statusMessage: 'invalid preset id' })
  }
  const preset = await duplicatePreset(id, user?.id ?? null)
  return { preset }
})
