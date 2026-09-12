import { requirePermission } from '../../../../utils/auth'
import { updatePreset } from '../../../../modules/ai/presets.service'

/** PUT /api/admin/ai/presets/:id — edit a custom preset; built-ins
    return 403 (§34 duplicate & customize instead). */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'ai.use')
  const id = Number(getRouterParam(event, 'id')) || 0
  if (!id) {
    throw createError({ statusCode: 422, statusMessage: 'invalid preset id' })
  }
  const body = await readBody(event) as {
    name?: string
    description?: string
    instructions?: string
    defaultScope?: string
    defaultDepth?: string
    enabled?: boolean
    suggestedQuestions?: string[]
  }
  const preset = await updatePreset(id, {
    name: body?.name !== undefined ? String(body.name) : undefined,
    description: body?.description !== undefined ? String(body.description) : undefined,
    instructions: body?.instructions !== undefined ? String(body.instructions) : undefined,
    defaultScope: body?.defaultScope !== undefined ? String(body.defaultScope) : undefined,
    defaultDepth: body?.defaultDepth !== undefined ? String(body.defaultDepth) : undefined,
    enabled: body?.enabled !== undefined ? Boolean(body.enabled) : undefined,
    suggestedQuestions: Array.isArray(body?.suggestedQuestions)
      ? body.suggestedQuestions.map(String)
      : undefined
  })
  return { preset }
})
