import { resolveLocale } from '../../../../utils/locale'
import { getPublicCommentTreeByAlias } from '../../../../modules/comments/comment.service'
import { isBlogDbReady } from '../../../../repositories/db.server'

/** GET /api/public/posts/:alias/comments — approved comment tree */
export default defineEventHandler(async (event) => {
  if (!isBlogDbReady()) return { comments: [] }
  const alias = getRouterParam(event, 'alias') ?? ''
  const query = getQuery(event) as { locale?: string }
  const locale = query.locale
    ? { code: query.locale }
    : await resolveLocale(event.path, getRequestHeader(event, 'accept-language'))
  return { comments: await getPublicCommentTreeByAlias(locale.code, alias) }
})
