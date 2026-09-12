import { requirePermission } from '../../../../utils/auth'
import { testAiProvider } from '../../../../modules/ai/ai.service'

/** POST /api/admin/ai/settings/test — tiny completion against the
    active provider (§35 Test Connection). */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'ai.edit')
  try {
    return await testAiProvider()
  } catch (e: unknown) {
    const err = e as Error & { data?: { code?: string } }
    throw createError({
      statusCode: 502,
      statusMessage: err.data?.code ?? err.message ?? 'AI test failed',
      data: { code: err.data?.code ?? 'AI_PROVIDER_ERROR' }
    })
  }
})
