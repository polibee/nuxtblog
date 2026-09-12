import { requirePermission } from '../../../utils/auth'
import { createPost } from '../../../modules/posts/post.service'

export default defineEventHandler(async (event) => {
  const current = await requirePermission(event, 'posts.create')
  const body = await readBody(event)
  return createPost(body, current.id)
})
