import { requirePermission } from '../../../../utils/auth'
import { upsertAiProvider } from '../../../../modules/ai/ai.service'
import { aiProviderSchema } from '#shared/schemas/ai'

/** POST /api/admin/ai/settings — create or update the AI provider.
    Empty apiKey keeps the stored key. */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'ai.edit')
  const body = await readBody(event)
  const parsed = aiProviderSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: parsed.error.issues[0]?.message ?? 'Invalid input' })
  }
  const input = { ...parsed.data, id: Number(body?.id) || undefined }
  return { provider: await upsertAiProvider(input) }
})
