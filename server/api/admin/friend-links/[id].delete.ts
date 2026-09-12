import { requirePermission } from '../../../utils/auth'
import { deleteFriendLink } from '../../../modules/friend-links/friend-links.runtime.service'

/** DELETE /api/admin/friend-links/:id — soft remove (§10). */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'friend-links.edit')
  const id = Number(getRouterParam(event, 'id')) || 0
  if (!id) throw createError({ statusCode: 422, statusMessage: 'invalid id' })
  await deleteFriendLink(id)
  return { ok: true }
})
