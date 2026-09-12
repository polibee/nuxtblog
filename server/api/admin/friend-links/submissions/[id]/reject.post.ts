import { requirePermission, getSessionUser } from '../../../../../utils/auth'
import { reviewSubmission } from '../../../../../modules/friend-links/friend-links.runtime.service'

/** POST /api/admin/friend-links/submissions/:id/reject — body { action:
    'reject' | 'spam', reason? } (§43). */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'friend-links.edit')
  const user = await getSessionUser(event)
  const id = Number(getRouterParam(event, 'id')) || 0
  if (!id) throw createError({ statusCode: 422, statusMessage: 'invalid id' })
  const body = await readBody(event) as { action?: string, reason?: string }
  const action = body?.action === 'spam' ? 'spam' : 'reject'
  await reviewSubmission(id, action, { userId: user?.id ?? null }, body?.reason ? String(body.reason) : undefined)
  return { ok: true }
})
