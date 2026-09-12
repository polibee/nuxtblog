import { and, asc, desc, eq, gt, isNull, lt } from 'drizzle-orm'
import { getDb } from './db.server'
import { posts, postTranslations } from './schema/posts'

/* Published post neighbors: previous = closest older, next = closest newer
   by publishedAt among posts with a translation in the same locale. */

export interface PostNeighbor {
  alias: string
  title: string
}

export async function findPublishedNeighbors(
  localeId: number,
  postId: number,
  publishedAt: Date
): Promise<{ prev: PostNeighbor | null, next: PostNeighbor | null }> {
  const base = and(
    eq(posts.status, 'published'),
    isNull(posts.deletedAt),
    eq(postTranslations.localeId, localeId)
  )

  const [prev] = await getDb()
    .select({ alias: posts.alias, title: postTranslations.title, publishedAt: posts.publishedAt })
    .from(posts)
    .innerJoin(postTranslations, eq(postTranslations.postId, posts.id))
    .where(and(base, lt(posts.publishedAt, publishedAt)))
    .orderBy(desc(posts.publishedAt))
    .limit(1)

  const [next] = await getDb()
    .select({ alias: posts.alias, title: postTranslations.title, publishedAt: posts.publishedAt })
    .from(posts)
    .innerJoin(postTranslations, eq(postTranslations.postId, posts.id))
    .where(and(base, gt(posts.publishedAt, publishedAt)))
    .orderBy(asc(posts.publishedAt))
    .limit(1)

  return {
    prev: prev ? { alias: prev.alias, title: prev.title } : null,
    next: next ? { alias: next.alias, title: next.title } : null
  }
}
