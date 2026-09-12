import { resolveLocale } from '../../../utils/locale'
import { getPublicPostByAlias } from '../../../modules/posts/post.service'
import { isBlogDbReady } from '../../../repositories/db.server'
import { getSessionUser } from '../../../utils/auth'

/** GET /api/public/posts/:alias — one published post in the resolved locale.
    Authenticated viewers get their paywall state evaluated. */
export default defineEventHandler(async (event) => {
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  const alias = getRouterParam(event, 'alias') ?? ''
  const query = getQuery(event) as { locale?: string }
  const locale = query.locale
    ? { code: query.locale }
    : await resolveLocale(event.path, getRequestHeader(event, 'accept-language'))
  const user = await getSessionUser(event)
  const post = await getPublicPostByAlias(locale.code, alias, user ? { id: user.id, email: user.email } : null)
  if (!post) {
    throw createError({ statusCode: 404, statusMessage: 'Post not found' })
  }
  return post
})
