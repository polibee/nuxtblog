import { requirePermission } from '../../../utils/auth'
import { updatePost } from '../../../modules/posts/post.service'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'posts.edit')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  const body = await readBody(event)
  return updatePost(id, body)
})
