import { requirePermission, getSessionUser } from '../../../utils/auth'
import { runEditorFeature } from '../../../modules/ai/ai.service'
import { editorAiSchema } from '#shared/schemas/ai'

/** POST /api/admin/ai/editor — unified editor AI endpoint (§14).
    feature drives the prompt; AI never writes to the DB. */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'ai.use')
  const user = await getSessionUser(event)
  const body = await readBody(event)
  const parsed = editorAiSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: parsed.error.issues[0]?.message ?? 'Invalid input' })
  }
  const result = await runEditorFeature(parsed.data, user?.id ?? null)
  return {
    text: result.text,
    model: result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens
  }
})
