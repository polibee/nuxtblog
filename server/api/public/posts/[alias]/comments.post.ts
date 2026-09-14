import { submitComment } from '../../../../modules/comments/comment.service'
import { getPublicPostByAlias } from '../../../../modules/posts/post.service'
import { getSessionUser } from '../../../../utils/auth'
import { hitRateLimit } from '../../../../utils/rate-limit'
import { isBlogDbReady } from '../../../../repositories/db.server'

export default defineEventHandler(async (event) => {
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const limit = hitRateLimit({ key: 'comment', identity: ip, limit: 5, windowMs: 10 * 60_000 })
  if (!limit.allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many comments, try again later' })
  }

  const alias = getRouterParam(event, 'alias') ?? ''
  const body = await readBody(event)

  const post = await getPublicPostByAlias('zh-CN', alias)
  if (!post) {
    throw createError({ statusCode: 404, statusMessage: 'Post not found' })
  }

  const user = await getSessionUser(event)
  return submitComment(
    post.id,
    post.commentStatus,
    body,
    user ? { id: user.id, name: user.name, email: user.email } : null,
    { ip, userAgent: getRequestHeader(event, 'user-agent') ?? '' }
  )
})
