import { and, asc, desc, eq, inArray, isNull, lte, like, or, sql, type SQL } from 'drizzle-orm'
import { getPostgresDb } from './db-postgres.server'
import { media } from './schema-postgres/media'
import { locales } from './schema-postgres/locales'
import { postTranslations, posts } from './schema-postgres/posts'
import { users } from './schema-postgres/users'
import type { PostAccessType, PostStatus } from '#shared/schemas/post'
import type { TranslationsRecord } from '#shared/types/locale'

export interface PostRecord {
  id: number
  alias: string
  primaryLocaleCode: string
  authorId: number
  featuredMediaId: number | null
  accessType: PostAccessType
  status: PostStatus
  publishedAt: Date | null
  scheduledAt: Date | null
  commentStatus: 'open' | 'closed'
  createdAt: Date
  updatedAt: Date
  translations: TranslationsRecord
  categoryIds: number[]
  tagIds: number[]
}

export interface PostTranslationRow {
  localeId: number
  title: string
  excerpt: string
  content: string
  seoTitle: string
  seoDescription: string
  canonicalUrl: string | null
  noindex: boolean
}

function translationValue(row: typeof postTranslations.$inferSelect): Record<string, unknown> {
  return {
    title: row.title,
    excerpt: row.excerpt,
    content: row.content,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    canonicalUrl: row.canonicalUrl,
    noindex: row.noindex,
    // Legacy read-only compatibility; post inputs must use featuredMediaId.
    featuredImageId: row.featuredImageId
  }
}

async function attachTranslations(postIds: number[]): Promise<Map<number, TranslationsRecord>> {
  const map = new Map<number, TranslationsRecord>()
  if (postIds.length === 0) return map
  const rows = await getPostgresDb()
    .select()
    .from(postTranslations)
    .where(inArray(postTranslations.postId, postIds))
  for (const row of rows) {
    const record = map.get(row.postId) ?? {}
    record[String(row.localeId)] = translationValue(row)
    map.set(row.postId, record)
  }
  return map
}

export interface PostListQuery {
  q?: string
  status?: string
  page?: number
  perPage?: number
  sortBy?: string
  sortDir?: string
}

export async function listPosts(query: PostListQuery): Promise<{
  items: PostRecord[]
  total: number
  page: number
  perPage: number
  totalPages: number
}> {
  const db = getPostgresDb()
  const term = query.q?.trim().toLowerCase()
  const statusCondition = query.status && query.status !== 'all'
    ? eq(posts.status, query.status)
    : undefined

  // search across translations by title/slug
  let idFilter: number[] | undefined
  if (term) {
    const matches = await db
      .select({ postId: postTranslations.postId })
      .from(postTranslations)
      .where(or(
        like(postTranslations.title, `%${term}%`)
      ))
    idFilter = [...new Set(matches.map(m => m.postId))]
    if (idFilter.length === 0) {
      return { items: [], total: 0, page: 1, perPage: Number(query.perPage) || 20, totalPages: 1 }
    }
  }

  const conditions: SQL<unknown>[] = [isNull(posts.deletedAt)]
  if (statusCondition) conditions.push(statusCondition)
  if (idFilter) conditions.push(inArray(posts.id, idFilter))
  const where = and(...conditions)

  const perPage = Math.min(Math.max(Number(query.perPage) || 20, 1), 200)
  const page = Math.max(Number(query.page) || 1, 1)

  const [totals] = await db.select({ total: sql<number>`count(*)` }).from(posts).where(where)
  const sortColumn = query.sortBy === 'status' ? posts.status : posts.createdAt
  const direction = query.sortDir === 'asc' ? asc : desc

  const rows = await db
    .select()
    .from(posts)
    .where(where)
    .orderBy(direction(sortColumn))
    .limit(perPage)
    .offset((page - 1) * perPage)

  const [translationMap, localeRows] = await Promise.all([
    attachTranslations(rows.map(r => r.id)),
    db.select({ id: locales.id, code: locales.code }).from(locales)
  ])
  const codeById = new Map(localeRows.map(l => [l.id, l.code]))

  const items = await Promise.all(rows.map(async row => ({
    id: row.id,
    alias: row.alias,
    primaryLocaleCode: codeById.get(row.primaryLocaleId) ?? 'zh-CN',
    authorId: row.authorId,
    featuredMediaId: row.featuredMediaId,
    accessType: row.accessType as PostAccessType,
    status: row.status as PostStatus,
    publishedAt: row.publishedAt,
    scheduledAt: row.scheduledAt,
    commentStatus: row.commentStatus as 'open' | 'closed',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    translations: translationMap.get(row.id) ?? {},
    categoryIds: [] as number[],
    tagIds: [] as number[]
  })))

  const total = Number(totals?.total ?? 0)
  return { items, total, page, perPage, totalPages: Math.max(Math.ceil(total / perPage), 1) }
}

export async function findPostRow(id: number): Promise<typeof posts.$inferSelect | undefined> {
  const rows = await getPostgresDb().select().from(posts).where(and(eq(posts.id, id), isNull(posts.deletedAt))).limit(1)
  return rows[0]
}

export async function getPost(id: number): Promise<PostRecord | undefined> {
  const row = await findPostRow(id)
  if (!row) return undefined
  const [translationMap, localeRows] = await Promise.all([
    attachTranslations([id]),
    getPostgresDb().select({ id: locales.id, code: locales.code }).from(locales)
  ])
  return {
    id: row.id,
    alias: row.alias,
    primaryLocaleCode: localeRows.find(l => l.id === row.primaryLocaleId)?.code ?? 'zh-CN',
    authorId: row.authorId,
    featuredMediaId: row.featuredMediaId,
    accessType: row.accessType as PostAccessType,
    status: row.status as PostStatus,
    publishedAt: row.publishedAt,
    scheduledAt: row.scheduledAt,
    commentStatus: row.commentStatus as 'open' | 'closed',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    translations: translationMap.get(id) ?? {},
    categoryIds: [],
    tagIds: []
  }
}

export async function insertPost(entity: {
  alias: string
  primaryLocaleId: number
  authorId: number
  featuredMediaId: number | null
  accessType: string
  paidPriceMinor: number | null
  paidCurrency: string | null
  status: string
  publishedAt: Date | null
  scheduledAt: Date | null
  commentStatus: string
}, translations: PostTranslationRow[]): Promise<number> {
  return getPostgresDb().transaction(async (tx) => {
    const [row] = await tx.insert(posts).values(entity).returning({ id: posts.id })
    if (!row) throw new Error('post insert returned no id')
    if (translations.length > 0) {
      await tx.insert(postTranslations).values(translations.map(t => ({ ...t, postId: row.id })))
    }
    return row.id
  })
}

export async function updatePostRow(
  id: number,
  entityPatch: Partial<{
    alias: string
    primaryLocaleId: number
    featuredMediaId: number | null
    accessType: string
    paidPriceMinor: number | null
    paidCurrency: string | null
    status: string
    publishedAt: Date | null
    scheduledAt: Date | null
    commentStatus: string
  }>,
  translations?: PostTranslationRow[]
): Promise<void> {
  await getPostgresDb().transaction(async (tx) => {
    if (Object.keys(entityPatch).length > 0) {
      await tx.update(posts).set(entityPatch).where(eq(posts.id, id))
    }
    if (translations) {
      // Retain legacy translation values while replacing writable translation fields.
      const legacyFeaturedImageIds = new Map((await tx
        .select({ localeId: postTranslations.localeId, featuredImageId: postTranslations.featuredImageId })
        .from(postTranslations)
        .where(eq(postTranslations.postId, id)))
        .map(row => [row.localeId, row.featuredImageId]))
      await tx.delete(postTranslations).where(eq(postTranslations.postId, id))
      if (translations.length > 0) {
        await tx.insert(postTranslations).values(translations.map(t => ({
          ...t,
          postId: id,
          featuredImageId: legacyFeaturedImageIds.get(t.localeId) ?? null
        })))
      }
    }
  })
}

export async function deletePostRow(id: number): Promise<void> {
  await getPostgresDb().delete(posts).where(eq(posts.id, id))
}

/* ---------------- public queries ---------------- */

export interface PublishedTranslation {
  postId: number
  title: string
  alias: string
  excerpt: string
  content: string
  seoTitle: string
  seoDescription: string
  noindex: boolean
  publishedAt: Date
  coverMediaId: number | null
  accessType: PostAccessType
  paidPriceMinor: number | null
  paidCurrency: string | null
  authorName: string | null
  commentStatus: 'open' | 'closed'
}

/** published posts having a translation in the given locale (no fallback) */
export async function listPublished(localeId: number, options: {
  page?: number
  perPage?: number
  postIds?: number[]
  q?: string
} = {}): Promise<{ items: PublishedTranslation[], total: number }> {
  const db = getPostgresDb()
  const conditions: (SQL<unknown> | undefined)[] = [
    eq(posts.status, 'published'),
    isNull(posts.deletedAt),
    lte(posts.publishedAt, new Date()),
    eq(postTranslations.localeId, localeId)
  ]
  if (options.postIds) {
    if (options.postIds.length === 0) {
      return { items: [], total: 0 }
    }
    conditions.push(inArray(posts.id, options.postIds))
  }
  if (options.q?.trim()) {
    const pattern = `%${options.q.trim()}%`
    conditions.push(or(like(postTranslations.title, pattern), like(postTranslations.excerpt, pattern)))
  }
  const perPage = Math.min(Math.max(Number(options.perPage) || 12, 1), 50)
  const page = Math.max(Number(options.page) || 1, 1)

  const rows = await db
    .select({
      postId: posts.id,
      title: postTranslations.title,
      alias: posts.alias,
      excerpt: postTranslations.excerpt,
      content: postTranslations.content,
      seoTitle: postTranslations.seoTitle,
      seoDescription: postTranslations.seoDescription,
      noindex: postTranslations.noindex,
      publishedAt: posts.publishedAt,
      featuredMediaId: posts.featuredMediaId,
      translationFeaturedId: postTranslations.featuredImageId,
      accessType: posts.accessType,
      postsPaidPriceMinor: posts.paidPriceMinor,
      postsPaidCurrency: posts.paidCurrency,
      authorName: users.name,
      commentStatus: posts.commentStatus
    })
    .from(posts)
    .innerJoin(postTranslations, eq(postTranslations.postId, posts.id))
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(and(...conditions))
    .orderBy(desc(posts.publishedAt))
    .limit(500) // bounded scan (dev scale); push-down queries come with P19

  const filtered = rows.filter(row => !row.noindex)

  return {
    items: filtered
      .slice((page - 1) * perPage, page * perPage)
      .map(row => ({
        postId: row.postId,
        title: row.title,
        alias: row.alias,
        excerpt: row.excerpt,
        content: row.content,
        seoTitle: row.seoTitle,
        seoDescription: row.seoDescription,
        noindex: row.noindex,
        publishedAt: row.publishedAt as Date,
        // translationFeaturedId is a legacy-read-only compatibility fallback.
        coverMediaId: (row.translationFeaturedId ?? row.featuredMediaId) as number | null,
        accessType: row.accessType as PostAccessType,
        authorName: row.authorName as string | null,
        paidPriceMinor: row.postsPaidPriceMinor as number | null,
        paidCurrency: row.postsPaidCurrency as string | null,
        commentStatus: row.commentStatus as 'open' | 'closed'
      })),
    total: filtered.length
  }
}

export interface PublishedArchiveItem {
  year: number
  month: number
  day: number
  title: string
  alias: string
  coverMediaId: number | null
}

/** archive page source: all published posts in a locale, newest first (light columns only) */
export async function listPublishedArchive(localeId: number): Promise<PublishedArchiveItem[]> {
  const rows = await getPostgresDb()
    .select({
      alias: posts.alias,
      title: postTranslations.title,
      noindex: postTranslations.noindex,
      publishedAt: posts.publishedAt,
      featuredMediaId: posts.featuredMediaId,
      translationFeaturedId: postTranslations.featuredImageId
    })
    .from(posts)
    .innerJoin(postTranslations, eq(postTranslations.postId, posts.id))
    .where(and(
      eq(posts.status, 'published'),
      isNull(posts.deletedAt),
      lte(posts.publishedAt, new Date()),
      eq(postTranslations.localeId, localeId)
    ))
    .orderBy(desc(posts.publishedAt))
    .limit(500) // bounded scan (dev scale)
  return rows
    .filter(row => !row.noindex)
    .map((row) => {
      const date = row.publishedAt as Date
      return {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate(),
        title: row.title,
        alias: row.alias,
        // Legacy translation covers remain read-only fallback data.
        coverMediaId: row.translationFeaturedId ?? row.featuredMediaId
      }
    })
}

export async function findPublishedByAlias(localeId: number, alias: string): Promise<PublishedTranslation | undefined> {
  const rows = await getPostgresDb()
    .select({
      postId: posts.id,
      title: postTranslations.title,
      alias: posts.alias,
      excerpt: postTranslations.excerpt,
      content: postTranslations.content,
      seoTitle: postTranslations.seoTitle,
      seoDescription: postTranslations.seoDescription,
      noindex: postTranslations.noindex,
      publishedAt: posts.publishedAt,
      featuredMediaId: posts.featuredMediaId,
      translationFeaturedId: postTranslations.featuredImageId,
      accessType: posts.accessType,
      paidPriceMinor: posts.paidPriceMinor,
      paidCurrency: posts.paidCurrency,
      commentStatus: posts.commentStatus,
      authorName: users.name
    })
    .from(posts)
    .innerJoin(postTranslations, eq(postTranslations.postId, posts.id))
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(and(
      eq(posts.status, 'published'),
      isNull(posts.deletedAt),
      eq(postTranslations.localeId, localeId),
      eq(posts.alias, alias)
    ))
    .limit(1)
  const row = rows[0]
  if (!row) return undefined
  return {
    postId: row.postId,
    title: row.title,
    alias: row.alias,
    excerpt: row.excerpt,
    content: row.content,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    noindex: row.noindex,
    publishedAt: row.publishedAt as Date,
    // translationFeaturedId is a legacy-read-only compatibility fallback.
    coverMediaId: (row.translationFeaturedId ?? row.featuredMediaId) as number | null,
    accessType: row.accessType as PostAccessType,
    paidPriceMinor: row.paidPriceMinor as number | null,
    paidCurrency: row.paidCurrency as string | null,
    authorName: row.authorName as string | null,
    commentStatus: row.commentStatus as 'open' | 'closed'
  }
}

/** scheduled -> published promotion (scheduler tick) */
export async function promoteScheduledPosts(): Promise<number> {
  const result = await getPostgresDb()
    .update(posts)
    .set({ status: 'published', publishedAt: new Date() })
    .where(and(
      eq(posts.status, 'scheduled'),
      isNull(posts.deletedAt),
      lte(posts.scheduledAt, new Date())
    ))
  return result.rowCount ?? 0
}

/** cover image public url by media id (null when missing) */
export async function coverUrlFor(mediaId: number | null): Promise<string | null> {
  if (!mediaId) return null
  const rows = await getPostgresDb().select({ storageKey: media.storageKey }).from(media).where(eq(media.id, mediaId)).limit(1)
  return rows[0] ? `/media/${rows[0].storageKey}` : null
}

/** alias of a published post in one locale (navigation reference resolution) */
export async function findPublishedPostAliasById(postId: number, localeId: number): Promise<string | null> {
  const rows = await getPostgresDb()
    .select({ alias: posts.alias })
    .from(posts)
    .innerJoin(postTranslations, eq(postTranslations.postId, posts.id))
    .where(and(
      eq(posts.id, postId),
      eq(posts.status, 'published'),
      isNull(posts.deletedAt),
      lte(posts.publishedAt, new Date()),
      eq(postTranslations.localeId, localeId)
    ))
    .limit(1)
  return rows[0]?.alias ?? null
}

export async function findPostByAlias(alias: string): Promise<PostRecord | undefined> {
  const rows = await getPostgresDb()
    .select()
    .from(posts)
    .where(and(eq(posts.alias, alias), isNull(posts.deletedAt)))
    .limit(1)
  if (!rows[0]) return undefined
  return getPost(rows[0].id)
}

export interface RecentPost {
  id: number
  alias: string
  title: string
  status: string
  publishedAt: Date | null
  commentCount: number
}

export async function countPostsByStatus(status: string): Promise<number> {
  const [row] = await getPostgresDb()
    .select({ total: sql<number>`count(*)` })
    .from(posts)
    .where(and(eq(posts.status, status), isNull(posts.deletedAt)))
  return Number(row?.total ?? 0)
}

/** recent posts for the dashboard, with comment counts */
export async function listRecentPosts(limit: number): Promise<RecentPost[]> {
  const rows = await getPostgresDb()
    .select({
      id: posts.id,
      alias: posts.alias,
      title: postTranslations.title,
      status: posts.status,
      publishedAt: posts.publishedAt,
      commentCount: sql<number>`(select count(*) from comments c where c.post_id = ${posts.id} and c.status = 'approved')`
    })
    .from(posts)
    .innerJoin(postTranslations, and(
      eq(postTranslations.postId, posts.id),
      eq(postTranslations.localeId, posts.primaryLocaleId)
    ))
    .where(isNull(posts.deletedAt))
    .orderBy(desc(posts.createdAt))
    .limit(limit)
  return rows.map(row => ({
    id: row.id,
    alias: row.alias,
    title: row.title,
    status: row.status,
    publishedAt: row.publishedAt,
    commentCount: Number(row.commentCount ?? 0)
  }))
}
