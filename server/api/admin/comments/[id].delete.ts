import { requirePermission } from '../../../utils/auth'
import { deleteComment } from '../../../modules/comments/comment.service'

/** DELETE /api/admin/comments/:id */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'comments.delete')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  await deleteComment(id)
  return { removed: 1 }
})
