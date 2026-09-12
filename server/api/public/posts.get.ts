import { resolveLocale } from '../../utils/locale'
import { getPublicPosts } from '../../modules/posts/post.service'
import { isBlogDbReady } from '../../repositories/db.server'

/** GET /api/public/posts — published posts for the resolved locale (no cross-locale fallback) */
export default defineEventHandler(async (event) => {
  if (!isBlogDbReady()) return { posts: [], total: 0 }
  const query = getQuery(event) as { locale?: string, page?: number, perPage?: number, category?: string, tag?: string, q?: string }
  const locale = query.locale
    ? { code: query.locale }
    : await resolveLocale(event.path, getRequestHeader(event, 'accept-language'))
  return getPublicPosts(locale.code, {
    page: Number(query.page) || 1,
    perPage: Number(query.perPage) || 12,
    categorySlug: query.category,
    tagSlug: query.tag,
    q: query.q
  })
})
