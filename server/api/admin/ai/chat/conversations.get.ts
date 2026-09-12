import { requirePermission, getSessionUser } from '../../../../utils/auth'
import { getConversations } from '../../../../modules/ai/chat.service'

/** GET /api/admin/ai/chat/conversations — recent conversations for the
    signed-in user (all users for admins is v2; keep per-user). */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'ai.use')
  const user = await getSessionUser(event)
  const conversations = await getConversations(user?.id ?? null)
  return { conversations }
})
