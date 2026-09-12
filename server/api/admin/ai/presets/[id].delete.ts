import { requirePermission } from '../../../../utils/auth'
import { deletePreset } from '../../../../modules/ai/presets.service'

/** DELETE /api/admin/ai/presets/:id — custom presets only (§35). */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'ai.use')
  const id = Number(getRouterParam(event, 'id')) || 0
  if (!id) {
    throw createError({ statusCode: 422, statusMessage: 'invalid preset id' })
  }
  await deletePreset(id)
  return { ok: true }
})
