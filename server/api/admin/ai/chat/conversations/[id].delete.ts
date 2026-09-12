import { createError } from 'h3'
import { requirePermission, getSessionUser } from '../../../../../utils/auth'
import { deleteConversation } from '../../../../../modules/ai/chat.service'

/** DELETE /api/admin/ai/chat/conversations/:id — remove a conversation
    and its messages/tool-call audit rows (owner or admin only). */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'ai.use')
  const user = await getSessionUser(event)
  const id = Number(getRouterParam(event, 'id')) || 0
  if (!id) {
    throw createError({ statusCode: 422, statusMessage: 'invalid conversation id' })
  }
  await deleteConversation(user?.id ?? null, id)
  return { ok: true }
})
