import { requirePermission } from '../../../utils/auth'
import { moderateComment } from '../../../modules/comments/comment.service'
import { COMMENT_STATUSES, type CommentStatus } from '#shared/schemas/comment'

/** PUT /api/admin/comments/:id — moderation status change */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'comments.edit')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  const body = await readBody<{ status?: string }>(event)
  if (!body?.status || !(COMMENT_STATUSES as readonly string[]).includes(body.status)) {
    throw createError({ statusCode: 422, statusMessage: 'status must be pending, approved or spam' })
  }
  return moderateComment(id, body.status as CommentStatus)
})
