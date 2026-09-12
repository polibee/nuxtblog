import { requirePermission } from '../../../utils/auth'
import { deletePost } from '../../../modules/posts/post.service'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'posts.delete')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  await deletePost(id)
  return { removed: 1 }
})
