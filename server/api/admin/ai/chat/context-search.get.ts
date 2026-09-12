import { and, eq, isNull, like } from 'drizzle-orm'
import { requirePermission } from '../../../../utils/auth'
import { getDb, isBlogDbReady } from '../../../../repositories/db.server'
import { posts, postTranslations } from '../../../../repositories/schema/posts'
import { pages, pageTranslations } from '../../../../repositories/schema/pages'
import { products, productTranslations } from '../../../../repositories/schema/products'

/** GET /api/admin/ai/chat/context-search?q= — entity search for the
    Assistant Context Picker (C2 §38): posts/pages/products, narrow
    projections only. */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'ai.use')
  const q = String(getQuery(event).q ?? '').trim()
  if (q.length < 2 || !isBlogDbReady()) return { items: [] }
  const term = `%${q}%`
  const db = getDb()

  const [postRows, pageRows, productRows] = await Promise.all([
    db.select({ id: posts.id, title: postTranslations.title, status: posts.status })
      .from(postTranslations)
      .innerJoin(posts, eq(postTranslations.postId, posts.id))
      .where(and(isNull(posts.deletedAt), like(postTranslations.title, term)))
      .limit(6),
    db.select({ id: pages.id, title: pageTranslations.title, status: pages.status })
      .from(pageTranslations)
      .innerJoin(pages, eq(pageTranslations.pageId, pages.id))
      .where(like(pageTranslations.title, term))
      .limit(4),
    db.select({ id: products.id, title: productTranslations.title, status: products.status })
      .from(productTranslations)
      .innerJoin(products, eq(productTranslations.productId, products.id))
      .where(and(isNull(products.deletedAt), like(productTranslations.title, term)))
      .limit(4)
  ])

  const items = [
    ...postRows.map(p => ({ type: 'post', id: p.id, title: p.title, status: p.status })),
    ...pageRows.map(p => ({ type: 'page', id: p.id, title: p.title, status: p.status })),
    ...productRows.map(p => ({ type: 'product', id: p.id, title: p.title, status: p.status }))
  ]
  return { items }
})
