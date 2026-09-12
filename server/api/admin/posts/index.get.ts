import { requirePermission } from '../../../utils/auth'
import { listPostItems } from '../../../modules/posts/post.service'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'posts.view')
  const query = getQuery(event) as {
    q?: string
    status?: string
    page?: number
    perPage?: number
    sortBy?: string
    sortDir?: string
  }
  return listPostItems(query)
})
