import { requirePermission } from '../../../../utils/auth'
import { replyToComment } from '../../../../modules/comments/comment.service'

/** POST /api/admin/comments/:id/reply */
export default defineEventHandler(async (event) => {
  const adminUser = await requirePermission(event, 'comments.edit')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  const body = await readBody(event)
  return replyToComment(id, body, adminUser)
})
