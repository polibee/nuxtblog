import { requirePermission } from '../../../../utils/auth'
import { checkFriendLinkNow } from '../../../../modules/friend-links/friend-links.runtime.service'

/** POST /api/admin/friend-links/:id/check — Check Now (§40 bottom):
    re-runs site + backlink checks and stores history rows. */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'friend-links.edit')
  const id = Number(getRouterParam(event, 'id')) || 0
  if (!id) throw createError({ statusCode: 422, statusMessage: 'invalid id' })
  return await checkFriendLinkNow(id)
})
