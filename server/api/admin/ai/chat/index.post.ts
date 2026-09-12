import { requirePermission, getSessionUser } from '../../../../utils/auth'
import {
  getOrCreateConversation,
  getConversationMessages,
  saveMessage,
  runAssistantTurn,
  type ChatDepth
} from '../../../../modules/ai/chat.service'
import { getActiveProvider } from '../../../../modules/ai/ai.service'
import { getPreset } from '../../../../modules/ai/presets.service'

/** POST /api/admin/ai/chat — one assistant turn: persists the user
    message, runs the tool-calling loop, persists the reply. Preset
    composition is server-side (§48): the client only sends presetId. */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'ai.use')
  const user = await getSessionUser(event)
  const body = await readBody(event) as {
    conversationId?: number
    message?: string
    scopeType?: string
    depth?: string
    presetId?: number
    context?: Array<{ type?: string, id?: number }>
  }
  const message = String(body?.message ?? '').trim().slice(0, 4000)
  if (!message) {
    throw createError({ statusCode: 422, statusMessage: 'message is required' })
  }
  const provider = await getActiveProvider()
  if (!provider) {
    throw createError({ statusCode: 503, statusMessage: 'No AI provider configured', data: { code: 'AI_PROVIDER_NOT_CONFIGURED' } })
  }

  /* §48 preset service → permission already checked → compose here */
  const preset = Number(body?.presetId) > 0 ? await getPreset(Number(body.presetId)) : null
  let scopeType = String(body?.scopeType ?? preset?.defaultScope ?? 'site').slice(0, 30)
  if (preset?.allowedScopes && !preset.allowedScopes.includes(scopeType)) {
    scopeType = preset.defaultScope
  }
  const depth = (['quick', 'balanced', 'deep'].includes(String(body?.depth))
    ? body?.depth
    : preset?.defaultDepth ?? 'balanced') as ChatDepth
  const context = Array.isArray(body?.context)
    ? body.context
        .map(c => ({ type: String(c?.type ?? '').slice(0, 20), id: Number(c?.id) || 0 }))
        .filter(c => c.id > 0 && ['post', 'page', 'product'].includes(c.type))
        .slice(0, 6)
    : []

  const conversationId = await getOrCreateConversation(user?.id ?? null, Number(body?.conversationId) || null, scopeType, message)
  await saveMessage(conversationId, 'user', message)
  const history = await getConversationMessages(conversationId)

  const { reply, references, toolActivity, contextTokens } = await runAssistantTurn({
    conversationId,
    scopeType,
    messages: history,
    provider,
    depth,
    attachedContext: context,
    presetInstructions: preset?.instructions || null,
    toolPrefixes: preset?.allowedToolGroups ?? null
  })
  await saveMessage(conversationId, 'assistant', reply, references)

  return { conversationId, reply, references, toolActivity, contextTokens, depth, presetId: preset?.id ?? null }
})
