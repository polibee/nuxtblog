import { and, asc, desc, eq, inArray, isNull, lte, like, or, sql } from 'drizzle-orm'
import { getPostgresDb } from './db-postgres.server'
import { locales } from './schema-postgres/locales'
import { pageTranslations, pages } from './schema-postgres/pages'
import type { TranslationsRecord } from '#shared/types/locale'

export interface PageRecord {
  id: number
  alias: string
  primaryLocaleCode: string
  authorId: number
  template: string
  status: 'draft' | 'published' | 'archived'
  publishedAt: Date | null
  createdAt: Date
  updatedAt: Date
  translations: TranslationsRecord
}

export interface PageTranslationRow {
  localeId: number
  title: string
  content: string
  seoTitle: string
  seoDescription: string
  canonicalUrl: string | null
  noindex: boolean
}

function translationValue(row: typeof pageTranslations.$inferSelect): Record<string, unknown> {
  return {
    title: row.title,
    content: row.content,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    canonicalUrl: row.canonicalUrl,
    noindex: row.noindex
  }
}

async function attachTranslations(pageIds: number[]): Promise<Map<number, TranslationsRecord>> {
  const map = new Map<number, TranslationsRecord>()
  if (pageIds.length === 0) return map
  const rows = await getPostgresDb()
    .select()
    .from(pageTranslations)
    .where(inArray(pageTranslations.pageId, pageIds))
  for (const row of rows) {
    const record = map.get(row.pageId) ?? {}
    record[String(row.localeId)] = translationValue(row)
    map.set(row.pageId, record)
  }
  return map
}

export interface PageListQuery {
  q?: string
  status?: string
  page?: number
  perPage?: number
  sortBy?: string
  sortDir?: string
}

export async function listPages(query: PageListQuery): Promise<{
  items: PageRecord[]
  total: number
  page: number
  perPage: number
  totalPages: number
}> {
  const db = getPostgresDb()
  const term = query.q?.trim().toLowerCase()
  const statusCondition = query.status && query.status !== 'all'
    ? eq(pages.status, query.status)
    : undefined

  let idFilter: number[] | undefined
  if (term) {
    const matches = await db
      .select({ pageId: pageTranslations.pageId })
      .from(pageTranslations)
      .where(or(
        like(pageTranslations.title, `%${term}%`)
      ))
    idFilter = [...new Set(matches.map(m => m.pageId))]
    if (idFilter.length === 0) {
      return { items: [], total: 0, page: 1, perPage: Number(query.perPage) || 20, totalPages: 1 }
    }
  }

  const conditions = [isNull(pages.deletedAt)]
  if (statusCondition) conditions.push(statusCondition)
  if (idFilter) conditions.push(inArray(pages.id, idFilter))
  const where = and(...conditions)

  const perPage = Math.min(Math.max(Number(query.perPage) || 20, 1), 200)
  const page = Math.max(Number(query.page) || 1, 1)

  const [totals] = await db.select({ total: sql<number>`count(*)` }).from(pages).where(where)
  const order = query.sortDir === 'asc' ? asc : desc
  const rows = await db
    .select()
    .from(pages)
    .where(where)
    .orderBy(order(pages.id))
    .limit(perPage)
    .offset((page - 1) * perPage)

  const [translationMap, localeRows] = await Promise.all([
    attachTranslations(rows.map(r => r.id)),
    db.select({ id: locales.id, code: locales.code }).from(locales)
  ])
  const codeById = new Map(localeRows.map(l => [l.id, l.code]))

  const items = rows.map(row => ({
    id: row.id,
    alias: row.alias,
    primaryLocaleCode: codeById.get(row.primaryLocaleId) ?? 'zh-CN',
    authorId: row.authorId,
    template: row.template,
    status: row.status as PageRecord['status'],
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    translations: translationMap.get(row.id) ?? {}
  }))

  const total = Number(totals?.total ?? 0)
  return { items, total, page, perPage, totalPages: Math.max(Math.ceil(total / perPage), 1) }
}

export async function findPageRow(id: number): Promise<typeof pages.$inferSelect | undefined> {
  const rows = await getPostgresDb().select().from(pages).where(and(eq(pages.id, id), isNull(pages.deletedAt))).limit(1)
  return rows[0]
}

export async function getPage(id: number): Promise<PageRecord | undefined> {
  const row = await findPageRow(id)
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
    template: row.template,
    status: row.status as PageRecord['status'],
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    translations: translationMap.get(id) ?? {}
  }
}

export async function insertPage(entity: {
  alias: string
  primaryLocaleId: number
  authorId: number
  template: string
  status: string
  publishedAt: Date | null
}, translations: PageTranslationRow[]): Promise<number> {
  return getPostgresDb().transaction(async (tx) => {
    const [row] = await tx.insert(pages).values(entity).returning({ id: pages.id })
    if (!row) throw new Error('page insert returned no id')
    if (translations.length > 0) {
      await tx.insert(pageTranslations).values(translations.map(t => ({ ...t, pageId: row.id })))
    }
    return row.id
  })
}

export async function updatePageRow(
  id: number,
  entityPatch: Partial<{
    alias: string
    primaryLocaleId: number
    template: string
    status: string
    publishedAt: Date | null
  }>,
  translations?: PageTranslationRow[]
): Promise<void> {
  await getPostgresDb().transaction(async (tx) => {
    if (Object.keys(entityPatch).length > 0) {
      await tx.update(pages).set(entityPatch).where(eq(pages.id, id))
    }
    if (translations) {
      await tx.delete(pageTranslations).where(eq(pageTranslations.pageId, id))
      if (translations.length > 0) {
        await tx.insert(pageTranslations).values(translations.map(t => ({ ...t, pageId: id })))
      }
    }
  })
}

export async function deletePageRow(id: number): Promise<void> {
  await getPostgresDb().delete(pages).where(eq(pages.id, id))
}

/* ---------------- public queries ---------------- */

export interface PublishedPage {
  title: string
  alias: string
  content: string
  seoTitle: string
  seoDescription: string
  noindex: boolean
  template: string
  publishedAt: Date | null
}

export async function findPublishedPageByAlias(localeId: number, alias: string): Promise<PublishedPage | undefined> {
  const rows = await getPostgresDb()
    .select({
      title: pageTranslations.title,
      alias: pages.alias,
      content: pageTranslations.content,
      seoTitle: pageTranslations.seoTitle,
      seoDescription: pageTranslations.seoDescription,
      noindex: pageTranslations.noindex,
      template: pages.template,
      publishedAt: pages.publishedAt
    })
    .from(pages)
    .innerJoin(pageTranslations, eq(pageTranslations.pageId, pages.id))
    .where(and(
      eq(pages.status, 'published'),
      isNull(pages.deletedAt),
      lte(pages.publishedAt, new Date()),
      eq(pageTranslations.localeId, localeId),
      eq(pages.alias, alias)
    ))
    .limit(1)
  return rows[0]
}

export async function listPublishedPages(localeId: number): Promise<PublishedPage[]> {
  const rows = await getPostgresDb()
    .select({
      title: pageTranslations.title,
      alias: pages.alias,
      content: pageTranslations.content,
      seoTitle: pageTranslations.seoTitle,
      seoDescription: pageTranslations.seoDescription,
      noindex: pageTranslations.noindex,
      template: pages.template,
      publishedAt: pages.publishedAt
    })
    .from(pages)
    .innerJoin(pageTranslations, eq(pageTranslations.pageId, pages.id))
    .where(and(
      eq(pages.status, 'published'),
      isNull(pages.deletedAt),
      lte(pages.publishedAt, new Date()),
      eq(pageTranslations.localeId, localeId)
    ))
    .orderBy(desc(pages.publishedAt))
    .limit(200)
  return rows.filter(row => !row.noindex)
}

/** alias of a published page in one locale (navigation reference resolution) */
export async function findPublishedPageAliasById(pageId: number, localeId: number): Promise<string | null> {
  const rows = await getPostgresDb()
    .select({ alias: pages.alias })
    .from(pages)
    .innerJoin(pageTranslations, eq(pageTranslations.pageId, pages.id))
    .where(and(
      eq(pages.id, pageId),
      eq(pages.status, 'published'),
      isNull(pages.deletedAt),
      eq(pageTranslations.localeId, localeId)
    ))
    .limit(1)
  return rows[0]?.alias ?? null
}

export async function findPageByAlias(alias: string): Promise<PageRecord | undefined> {
  const rows = await getPostgresDb()
    .select()
    .from(pages)
    .where(and(eq(pages.alias, alias), isNull(pages.deletedAt)))
    .limit(1)
  if (!rows[0]) return undefined
  return getPage(rows[0].id)
}

export async function countPagesByStatus(status: string): Promise<number> {
  const [row] = await getPostgresDb()
    .select({ total: sql<number>`count(*)` })
    .from(pages)
    .where(and(eq(pages.status, status), isNull(pages.deletedAt)))
  return Number(row?.total ?? 0)
}
