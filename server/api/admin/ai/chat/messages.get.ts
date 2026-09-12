import { requirePermission } from '../../../../utils/auth'
import { getConversationMessages } from '../../../../modules/ai/chat.service'

/** GET /api/admin/ai/chat/messages?conversationId=123 — transcript for
    one conversation (references included). */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'ai.use')
  const conversationId = Number(getQuery(event).conversationId) || 0
  if (!conversationId) {
    throw createError({ statusCode: 422, statusMessage: 'conversationId is required' })
  }
  return { messages: await getConversationMessages(conversationId) }
})
