import { createError } from 'h3'
import type { Paginated } from '#shared/types/api'
import type { PublicArchiveItem, PublicPostDetail, PublicPostSummary, PublicTaxonomyTerm } from '#shared/types/post'
import {
  POST_STATUSES,
  ensureAlias,
  isReservedAlias,
  postInputSchema,
  type PostInput
} from '#shared/schemas/post'
import { isBlogDbReady } from '../../repositories/db.server'
import { listLocales } from '../../repositories/locale.runtime.repository'
import { bumpAiDomains } from '../ai/optimization/invalidate'
import { emitCmsEvent } from '../../utils/events'
import {
  coverUrlFor,
  deletePostRow,
  findPostRow,
  findPublishedByAlias,
  findPostByAlias,
  getPost,
  insertPost,
  listPosts,
  listPublished,
  listPublishedArchive,
  updatePostRow,
  type PostRecord,
  type PostTranslationRow
} from '../../repositories/post.runtime.repository'
import { findTaxonomyRow, postsInTaxonomy, relationsForPost, replacePostRelations, termsForLocale } from '../../repositories/taxonomy.repository'
import { findTaxonomyIdByAlias } from '../taxonomy/taxonomy.service'
import { withCodeKeyedTranslations, withCodeKeyedTranslationsAll } from '../../utils/translations'
import { sanitizeRichText } from '../../utils/sanitize'
import { readingMinutes } from '#shared/utils/reading'
import { contentUrl, recordUrlRedirect } from '../../utils/contentUrl'
import { invalidateAllNavigationCaches } from '../../utils/navigationCache'
import { countApprovedCommentsByPostIds } from '../../repositories/comment.runtime.repository'
import { resolvePostExcerpt } from '#shared/utils/post-excerpt'
import { normalizeArticleEmbeds } from '#shared/utils/article-embed'

/* Post domain service (P04). Splits translations[locale][field] into
   posts + post_translations and relations into post_categories /
   post_tags inside transactions. Publishing is gated on a complete
   primary-locale translation (title/content). */

export type { PostRecord }

export interface AdminPost extends PostRecord {
  title: string
}

interface LocaleMaps {
  codeToId: Map<string, number>
  idToCode: Map<number, string>
  defaultCode: string
  defaultId: number
}

async function localeMaps(): Promise<LocaleMaps> {
  const locales = await listLocales()
  const defaultLocale = locales.find(l => l.isDefault) ?? locales[0]
  if (!defaultLocale) {
    throw createError({ statusCode: 503, statusMessage: 'Locale registry unavailable' })
  }
  return {
    codeToId: new Map(locales.map(l => [l.code, l.id])),
    idToCode: new Map(locales.map(l => [l.id, l.code])),
    defaultCode: defaultLocale.code,
    defaultId: defaultLocale.id
  }
}

function previewTitle(record: PostRecord): string {
  const entries = Object.entries(record.translations)
    .map(([code, value]) => ({ code, title: String((value as { title?: unknown }).title ?? '').trim() }))
    .filter(entry => entry.title)
  if (entries.length === 0) return ''
  return entries
    .sort((a, b) => (a.code === record.primaryLocaleCode ? -1 : b.code === record.primaryLocaleCode ? 1 : a.code.localeCompare(b.code)))
    .map(entry => `${entry.code}: ${entry.title}`)
    .join(' / ')
}

function parseInput(body: unknown): Partial<PostInput> {
  const result = postInputSchema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 422,
      statusMessage: result.error.issues[0]?.message ?? 'Invalid input'
    })
  }
  return result.data
}

async function buildTranslationRows(
  translations: NonNullable<PostInput['translations']> | undefined,
  maps: LocaleMaps,
  mode: 'create' | 'update'
): Promise<PostTranslationRow[] | undefined> {
  if (!translations) {
    if (mode === 'create') {
      throw createError({ statusCode: 422, statusMessage: 'At least one locale translation is required' })
    }
    return undefined
  }
  const entries = Object.entries(translations)
  if (mode === 'create' && entries.length === 0) {
    throw createError({ statusCode: 422, statusMessage: 'At least one locale translation is required' })
  }
  return entries.map(([code, fields]) => {
    const localeId = maps.codeToId.get(code)
    if (!localeId) {
      throw createError({ statusCode: 422, statusMessage: `Unknown locale "${code}"` })
    }
    return {
      localeId,
      title: fields.title,
      excerpt: fields.excerpt ?? '',
      content: sanitizeRichText(normalizeArticleEmbeds(fields.content ?? '')),
      seoTitle: fields.seoTitle ?? '',
      seoDescription: fields.seoDescription ?? '',
      canonicalUrl: fields.canonicalUrl ?? null,
      noindex: fields.noindex ?? false
    }
  })
}

function checkStatus(
  status: PostInput['status'],
  input: Partial<PostInput>,
  translations: PostTranslationRow[] | undefined,
  primaryLocaleId: number
): void {
  if (!status || status === 'draft' || status === 'archived') return
  // only validate completeness when translations are explicitly provided;
  // partial updates (e.g. commentStatus toggle) trust the existing data
  if (!translations) return
  const primary = translations.find(t => t.localeId === primaryLocaleId)
  if (status === 'published') {
    const complete = Boolean(
      primary
      && primary.title.trim()
      && primary.content.replace(/<[^>]*>/g, '').trim()
    )
    if (!complete) {
      throw createError({
        statusCode: 422,
        statusMessage: 'Publishing requires a complete primary-locale translation (title/content)'
      })
    }
  }
  if (status === 'scheduled') {
    const when = input.scheduledAt ? new Date(input.scheduledAt) : null
    if (!when || Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      throw createError({ statusCode: 422, statusMessage: 'Scheduling requires a future scheduled_at' })
    }
  }
}

async function resolveRelations(input: Partial<PostInput>): Promise<{
  categoryIds?: number[]
  tagIds?: number[]
}> {
  const result: { categoryIds?: number[], tagIds?: number[] } = {}
  if (input.categoryIds) {
    for (const id of input.categoryIds) {
      if (!(await findTaxonomyRow('category', id))) {
        throw createError({ statusCode: 422, statusMessage: `Category #${id} not found` })
      }
    }
    result.categoryIds = input.categoryIds
  }
  if (input.tagIds) {
    for (const id of input.tagIds) {
      if (!(await findTaxonomyRow('tag', id))) {
        throw createError({ statusCode: 422, statusMessage: `Tag #${id} not found` })
      }
    }
    result.tagIds = input.tagIds
  }
  return result
}

export async function createPost(body: unknown, authorId: number): Promise<AdminPost> {
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  const input = parseInput(body)
  const maps = await localeMaps()
  const status = input.status ?? 'draft'
  const translations = await buildTranslationRows(input.translations, maps, 'create')
  checkStatus(status, input, translations, maps.defaultId)

  const alias = ensureAlias(translations?.find(t => t.localeId === maps.defaultId)?.title ?? '', input.alias)
  if (isReservedAlias(alias)) {
    throw createError({ statusCode: 422, statusMessage: `Alias "${alias}" is a reserved path` })
  }
  if (await findPostByAlias(alias)) {
    throw createError({ statusCode: 409, statusMessage: `Alias "${alias}" already exists` })
  }

  const id = await insertPost({
    alias,
    primaryLocaleId: maps.defaultId,
    authorId,
    featuredMediaId: input.featuredMediaId ?? null,
    accessType: input.accessType ?? 'public',
    paidPriceMinor: input.accessType === 'paid' ? input.paidPriceMinor ?? null : null,
    paidCurrency: input.accessType === 'paid' ? input.paidCurrency ?? null : null,
    status,
    publishedAt: status === 'published' ? new Date() : null,
    scheduledAt: status === 'scheduled' ? new Date(input.scheduledAt!) : null,
    commentStatus: input.commentStatus ?? 'closed'
  }, translations!)
  const relations = await resolveRelations(input)
  await replacePostRelations(id, relations.categoryIds ?? [], relations.tagIds ?? [])
  await bumpAiDomains(['posts'])
  const created = await finalize(await getPost(id))
  if (created.status === 'published') {
    await emitCmsEvent('content.published', { resource: 'posts', record: { id: created.id, title: created.title, status: created.status } })
  }
  return created
}

export async function updatePost(id: number, body: unknown): Promise<AdminPost> {
  const existing = await getPost(id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: `Post #${id} not found` })
  }
  const input = parseInput(body)
  const maps = await localeMaps()
  const status = input.status ?? existing.status
  const translations = await buildTranslationRows(input.translations, maps, 'update')
  checkStatus(status, input, translations, maps.defaultId)

  let alias = existing.alias
  if (input.alias !== undefined && input.alias !== existing.alias) {
    if (isReservedAlias(input.alias)) {
      throw createError({ statusCode: 422, statusMessage: `Alias "${input.alias}" is a reserved path` })
    }
    if (await findPostByAlias(input.alias)) {
      throw createError({ statusCode: 409, statusMessage: `Alias "${input.alias}" already exists` })
    }
    if (existing.status === 'published') {
      await recordUrlRedirect({
        entityType: 'post',
        entityId: existing.id,
        oldPath: contentUrl('post', existing.alias),
        newPath: contentUrl('post', input.alias)
      })
    }
    alias = input.alias
  }

  const entityPatch: Parameters<typeof updatePostRow>[1] = {}
  if (alias !== existing.alias) entityPatch.alias = alias
  if (input.status !== undefined) entityPatch.status = input.status
  if (input.accessType !== undefined) {
    entityPatch.accessType = input.accessType
    entityPatch.paidPriceMinor = input.accessType === 'paid' ? input.paidPriceMinor ?? null : null
    entityPatch.paidCurrency = input.accessType === 'paid' ? input.paidCurrency ?? null : null
  } else if (input.paidPriceMinor !== undefined) entityPatch.paidPriceMinor = input.paidPriceMinor
  if (input.paidCurrency !== undefined) entityPatch.paidCurrency = input.paidCurrency
  if (input.featuredMediaId !== undefined) entityPatch.featuredMediaId = input.featuredMediaId
  if (input.commentStatus !== undefined) entityPatch.commentStatus = input.commentStatus
  if (input.scheduledAt !== undefined) {
    entityPatch.scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null
  }
  // publishedAt: set on entering published, cleared when leaving it
  if (input.status !== undefined) {
    const wasPublished = existing.status === 'published'
    if (input.status === 'published' && !wasPublished) entityPatch.publishedAt = new Date()
    if (input.status !== 'published' && wasPublished) entityPatch.publishedAt = null
  }

  await updatePostRow(id, entityPatch, translations)
  if (alias !== existing.alias) {
    await invalidateAllNavigationCaches()
  }
  const relations = await resolveRelations(input)
  if (relations.categoryIds !== undefined || relations.tagIds !== undefined) {
    const current = { categoryIds: existing.categoryIds, tagIds: existing.tagIds }
    await replacePostRelations(
      id,
      relations.categoryIds ?? current.categoryIds,
      relations.tagIds ?? current.tagIds
    )
  }
  await bumpAiDomains(['posts'])
  const updated = await finalize(await getPost(id))
  const wasPublished = existing.status === 'published'
  if (updated.status === 'published' && !wasPublished) {
    await emitCmsEvent('content.published', { resource: 'posts', record: { id: updated.id, title: updated.title, status: updated.status } })
  } else if (updated.status !== 'published' && wasPublished) {
    await emitCmsEvent('content.unpublished', { resource: 'posts', id: updated.id, record: { id: updated.id, title: updated.title, status: updated.status } })
  } else {
    await emitCmsEvent('content.afterUpdate', { resource: 'posts', id: updated.id, record: { id: updated.id, title: updated.title, status: updated.status } })
  }
  return updated
}

export async function deletePost(id: number): Promise<void> {
  if (!(await findPostRow(id))) {
    throw createError({ statusCode: 404, statusMessage: `Post #${id} not found` })
  }
  await deletePostRow(id)
  await bumpAiDomains(['posts'])
  await emitCmsEvent('content.afterDelete', { resource: 'posts', id })
}

export async function getPostItem(id: number): Promise<AdminPost> {
  const post = await getPost(id)
  if (!post) {
    throw createError({ statusCode: 404, statusMessage: `Post #${id} not found` })
  }
  return finalize(post)
}

export async function listPostItems(query: Parameters<typeof listPosts>[0]): Promise<Paginated<AdminPost>> {
  const result = await listPosts(query)
  const items = (await withCodeKeyedTranslationsAll(result.items)) as AdminPost[]
  for (const item of items) item.title = previewTitle(item)
  return { ...result, items }
}

async function finalize(post: PostRecord | undefined): Promise<AdminPost> {
  if (!post) throw createError({ statusCode: 500, statusMessage: 'Post disappeared after write' })
  const withCodes = await withCodeKeyedTranslations(post) as AdminPost
  withCodes.title = previewTitle(withCodes)
  return withCodes
}

export { POST_STATUSES }
export { promoteScheduledPosts } from '../../repositories/post.runtime.repository'

/* ---------------- public reads (strict per-locale, no fallback) ---------------- */

async function taxonomyTermsForPosts(
  localeId: number,
  postIds: number[]
): Promise<Map<number, { categories: PublicTaxonomyTerm[], tags: PublicTaxonomyTerm[] }>> {
  const map = new Map<number, { categories: PublicTaxonomyTerm[], tags: PublicTaxonomyTerm[] }>()
  for (const postId of postIds) {
    const relations = await relationsForPost(postId)
    const [cats, tgs] = await Promise.all([
      termsForLocale('category', localeId, relations.categoryIds),
      termsForLocale('tag', localeId, relations.tagIds)
    ])
    map.set(postId, {
      categories: relations.categoryIds.map(id => cats.get(id)).filter((t): t is PublicTaxonomyTerm => t !== undefined),
      tags: relations.tagIds.map(id => tgs.get(id)).filter((t): t is PublicTaxonomyTerm => t !== undefined)
    })
  }
  return map
}

export async function getPublicPosts(localeCode: string, options: {
  page?: number
  perPage?: number
  categorySlug?: string
  tagSlug?: string
  q?: string
}): Promise<{ items: PublicPostSummary[], total: number }> {
  const maps = await localeMaps()
  const localeId = maps.codeToId.get(localeCode)
  if (!localeId) return { items: [], total: 0 }

  let postIds: number[] | undefined
  if (options.categorySlug) {
    const id = await findTaxonomyIdByAlias('category', options.categorySlug ?? '')
    if (id === null) return { items: [], total: 0 }
    postIds = await postsInTaxonomy('category', id)
  }
  if (options.tagSlug) {
    const id = await findTaxonomyIdByAlias('tag', options.tagSlug ?? '')
    if (id === null) return { items: [], total: 0 }
    const tagPostIds = await postsInTaxonomy('tag', id)
    postIds = postIds
      ? postIds.filter(pid => tagPostIds.includes(pid))
      : tagPostIds
  }

  const result = await listPublished(localeId, { page: options.page, perPage: options.perPage, postIds, q: options.q })
  const terms = await taxonomyTermsForPosts(localeId, result.items.map(i => i.postId))
  const { listViewCounts } = await import('../../repositories/analytics.repository')
  const views = await listViewCounts(result.items.map(i => `/posts/${i.alias}`))
  const commentCounts = await countApprovedCommentsByPostIds(result.items.map(i => i.postId))
  const items = await Promise.all(result.items.map(async row => ({
    alias: row.alias,
    title: row.title,
    excerpt: resolvePostExcerpt(row.excerpt, row.content),
    publishedAt: row.publishedAt.toISOString(),
    coverUrl: await coverUrlFor(row.coverMediaId),
    authorName: row.authorName,
    views: views.get(`/posts/${row.alias}`) ?? 0,
    commentCount: commentCounts.get(row.postId) ?? 0,
    readingMinutes: readingMinutes(row.content),
    categories: terms.get(row.postId)?.categories ?? [],
    tags: terms.get(row.postId)?.tags ?? []
  })))
  return { items, total: result.total }
}

export async function getPublicArchive(localeCode: string): Promise<{ items: PublicArchiveItem[] }> {
  const maps = await localeMaps()
  const localeId = maps.codeToId.get(localeCode)
  if (!localeId) return { items: [] }
  const rows = await listPublishedArchive(localeId)
  return {
    items: await Promise.all(rows.map(async row => ({
      year: row.year,
      month: row.month,
      day: row.day,
      title: row.title,
      alias: row.alias,
      coverUrl: await coverUrlFor(row.coverMediaId)
    })))
  }
}

export async function getPublicPostByAlias(
  localeCode: string,
  alias: string,
  viewer: { id: number, email: string } | null = null
): Promise<PublicPostDetail | undefined> {
  const maps = await localeMaps()
  const localeId = maps.codeToId.get(localeCode)
  if (!localeId) return undefined
  const row = await findPublishedByAlias(localeId, alias)
  if (!row) return undefined
  const terms = await taxonomyTermsForPosts(localeId, [row.postId])

  /* paywall (P15): content split on the [paid] ... [/paid] markers.
     free part always visible; the paid block ships only when the viewer
     has purchased the post or holds an active membership. */
  // Normalize legacy content on read as well as at write time so existing
  // posts gain safe Markdown/BBCode image support without a data rewrite.
  let content = sanitizeRichText(normalizeArticleEmbeds(row.content))
  let paidContent: string | null = null
  let locked = false
  let price: { priceMinor: number, currency: string, productAlias: string } | null = null
  if (row.accessType === 'paid' || row.accessType === 'members') {
    const { hasPostAccess, shadowProductAlias, ensureShadowProduct } = await import('../membership/membership.service')
    const access = await hasPostAccess(row.postId, viewer)
    if (row.accessType === 'paid') {
      await ensureShadowProduct('post_access', row.postId, row.title, row.paidPriceMinor ?? 0, row.paidCurrency ?? 'USD')
      price = {
        priceMinor: row.paidPriceMinor ?? 0,
        currency: row.paidCurrency ?? 'USD',
        productAlias: shadowProductAlias('post_access', row.postId)
      }
    }
    const markerOpen = content.indexOf('[paid]')
    if (row.accessType === 'paid' && markerOpen !== -1) {
      const markerClose = content.indexOf('[/paid]', markerOpen)
      const free = content.slice(0, markerOpen)
      const paid = markerClose === -1
        ? content.slice(markerOpen + 6)
        : content.slice(markerOpen + 6, markerClose) + content.slice(markerClose + 7)
      if (access) content = free + paid
      else {
        content = free
        paidContent = paid
        locked = true
      }
    } else if (!access) {
      locked = true
      content = ''
    }
  }

  const { findPublishedNeighbors } = await import('../../repositories/post-neighbors.repository')
  const neighbors = await findPublishedNeighbors(localeId, row.postId, row.publishedAt)

  const { listViewCounts } = await import('../../repositories/analytics.repository')
  const views = (await listViewCounts([`/posts/${row.alias}`])).get(`/posts/${row.alias}`) ?? 0

  return {
    id: row.postId,
    alias: row.alias,
    title: row.title,
    excerpt: resolvePostExcerpt(row.excerpt, row.content),
    publishedAt: row.publishedAt.toISOString(),
    coverUrl: await coverUrlFor(row.coverMediaId),
    categories: terms.get(row.postId)?.categories ?? [],
    tags: terms.get(row.postId)?.tags ?? [],
    content,
    paidContent,
    locked,
    price,
    neighbors,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    noindex: row.noindex,
    authorName: row.authorName,
    views,
    readingMinutes: readingMinutes(row.content),
    accessType: row.accessType,
    commentStatus: row.commentStatus
  }
}
