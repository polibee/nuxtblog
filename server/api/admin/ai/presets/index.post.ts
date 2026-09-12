import { requirePermission, getSessionUser } from '../../../../utils/auth'
import { createPreset } from '../../../../modules/ai/presets.service'

/** POST /api/admin/ai/presets — create a custom preset (§9/35). */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'ai.use')
  const user = await getSessionUser(event)
  const body = await readBody(event) as {
    name?: string
    description?: string
    instructions?: string
    defaultScope?: string
    defaultDepth?: string
    allowedToolGroups?: string[]
    suggestedQuestions?: string[]
  }
  const preset = await createPreset({
    name: String(body?.name ?? ''),
    description: body?.description ? String(body.description) : undefined,
    instructions: String(body?.instructions ?? ''),
    defaultScope: body?.defaultScope ? String(body.defaultScope) : undefined,
    defaultDepth: body?.defaultDepth ? String(body.defaultDepth) : undefined,
    allowedToolGroups: Array.isArray(body?.allowedToolGroups)
      ? body.allowedToolGroups.map(String).slice(0, 12)
      : null,
    suggestedQuestions: Array.isArray(body?.suggestedQuestions)
      ? body.suggestedQuestions.map(String)
      : [],
    createdBy: user?.id ?? null
  })
  return { preset }
})
