import { and, isNull, asc, count, desc, eq, inArray, like, ne, or, sql } from 'drizzle-orm'
import { getPostgresDb } from './db-postgres.server'
import { media, mediaTranslations, mediaVariants } from './schema-postgres/media'
import type { TranslationsRecord } from '#shared/types/locale'
import { bumpAiDomains } from '../modules/ai/optimization/invalidate'

export interface MediaRecord {
  id: number
  filename: string
  mime: string
  size: number
  width: number | null
  height: number | null
  url: string
  storageKey: string
  folderId: number | null
  usageType: string
  hash: string | null
  createdAt: Date
  updatedAt: Date
  translations: TranslationsRecord
}

export interface MediaTranslationRow {
  localeId: number
  alt: string
  caption: string
}

export interface MediaVariantRow {
  mediaId: number
  variant: string
  storageKey: string
  width: number | null
  height: number | null
  size: number
  format: string
}

function toRecord(
  row: typeof media.$inferSelect,
  translations: TranslationsRecord
): MediaRecord {
  return {
    id: row.id,
    filename: row.filename,
    mime: row.mime,
    size: row.size,
    width: row.width,
    height: row.height,
    url: `/media/${row.storageKey}`,
    storageKey: row.storageKey,
    folderId: row.folderId,
    usageType: row.usageType,
    hash: row.hash,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    translations
  }
}

async function attachTranslations(mediaIds: number[]): Promise<Map<number, TranslationsRecord>> {
  const map = new Map<number, TranslationsRecord>()
  if (mediaIds.length === 0) return map
  const rows = await getPostgresDb()
    .select()
    .from(mediaTranslations)
    .where(inArray(mediaTranslations.mediaId, mediaIds))
  for (const row of rows) {
    const record = map.get(row.mediaId) ?? {}
    record[String(row.localeId)] = { alt: row.alt, caption: row.caption }
    map.set(row.mediaId, record)
  }
  return map
}

export interface MediaListQuery {
  q?: string
  page?: number
  perPage?: number
  sortBy?: string
  sortDir?: string
  folderId?: number
  usageType?: string
  used?: boolean
  missingAlt?: boolean
}

export async function listMedia(query: MediaListQuery): Promise<{
  items: MediaRecord[]
  total: number
  page: number
  perPage: number
  totalPages: number
}> {
  const db = getPostgresDb()
  const term = query.q?.trim().toLowerCase()
  const conditions = []
  if (term) {
    conditions.push(or(
      like(media.filename, `%${term}%`),
      like(media.mime, `%${term}%`)
    ))
  }
  if (typeof query.folderId === 'number') {
    conditions.push(query.folderId === 0 ? isNull(media.folderId) : eq(media.folderId, query.folderId))
  }
  if (query.usageType) {
    conditions.push(eq(media.usageType, query.usageType))
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined

  const sortColumn = query.sortBy === 'filename'
    ? media.filename
    : query.sortBy === 'size'
      ? media.size
      : media.createdAt
  const direction = query.sortDir === 'asc' ? asc : desc

  /* used / missingAlt filters are reference-based (P20); applied after the
     page query would break pagination, so pre-compute matching ids instead */
  let idFilter: number[] | null = null
  if (query.used !== undefined || query.missingAlt) {
    const all = await db.select({ id: media.id }).from(media).where(where).limit(2000)
    let ids = all.map(r => r.id)
    if (query.used !== undefined) {
      const referenced = new Set<number>(await findReferencedMediaIds())
      ids = ids.filter(id => referenced.has(id) === query.used)
    }
    if (query.missingAlt) {
      const withAlt = new Set<number>(
        (await db.select({ id: mediaTranslations.mediaId }).from(mediaTranslations)
          .where(and(inArray(mediaTranslations.mediaId, ids.length > 0 ? ids : [0]), ne(mediaTranslations.alt, ''))))
          .map(r => r.id)
      )
      ids = ids.filter(id => !withAlt.has(id))
    }
    idFilter = ids
  }

  const finalWhere = idFilter
    ? and(where, idFilter.length > 0 ? inArray(media.id, idFilter) : sql`false`)
    : where

  const perPage = Math.min(Math.max(Number(query.perPage) || 24, 1), 200)
  const page = Math.max(Number(query.page) || 1, 1)
  const [totals] = await db.select({ total: count() }).from(media).where(finalWhere)
  const rows = await db
    .select()
    .from(media)
    .where(finalWhere)
    .orderBy(direction(sortColumn))
    .limit(perPage)
    .offset((page - 1) * perPage)

  const translationMap = await attachTranslations(rows.map(r => r.id))
  const total = totals?.total ?? 0
  return {
    items: rows.map(row => toRecord(row, translationMap.get(row.id) ?? {})),
    total,
    page,
    perPage,
    totalPages: Math.max(Math.ceil(total / perPage), 1)
  }
}

/** media ids referenced by structured columns (featured images, slider,
    ad creatives, sidebar cards) — the used/unused filter source */
async function findReferencedMediaIds(): Promise<number[]> {
  const { postTranslations } = await import('./schema-postgres/posts')
  const { sliderItems } = await import('./schema-postgres/slider')
  const { adCreativeTranslations } = await import('./schema-postgres/advertising')
  const { sidebarCards } = await import('./schema-postgres/sidebar-cards')
  const db = getPostgresDb()
  const [featured, slider, ads, cards] = await Promise.all([
    db.selectDistinct({ id: postTranslations.featuredImageId }).from(postTranslations),
    db.select({ id: sliderItems.imageMediaId }).from(sliderItems),
    db.select({ id: adCreativeTranslations.imageId }).from(adCreativeTranslations),
    db.select({ id: sidebarCards.imageMediaId }).from(sidebarCards)
  ])
  const ids = new Set<number>()
  const collect = (value: unknown) => {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) ids.add(value)
  }
  for (const row of featured) collect(row.id)
  for (const row of slider) collect(row.id)
  for (const row of ads) collect(row.id)
  for (const row of cards) collect(row.id)
  return [...ids]
}

export async function findMediaRow(id: number): Promise<typeof media.$inferSelect | undefined> {
  const rows = await getPostgresDb().select().from(media).where(eq(media.id, id)).limit(1)
  return rows[0]
}

export async function findMediaByStorageKey(key: string): Promise<typeof media.$inferSelect | undefined> {
  const rows = await getPostgresDb().select().from(media).where(eq(media.storageKey, key)).limit(1)
  return rows[0]
}

export async function getMedia(id: number): Promise<MediaRecord | undefined> {
  const row = await findMediaRow(id)
  if (!row) return undefined
  const translationMap = await attachTranslations([id])
  return toRecord(row, translationMap.get(id) ?? {})
}

export async function insertMedia(input: {
  storageKey: string
  filename: string
  mime: string
  size: number
  width?: number | null
  height?: number | null
  usageType?: string
  hash?: string | null
}, translations: MediaTranslationRow[]): Promise<number> {
  return getPostgresDb().transaction(async (tx) => {
    const [row] = await tx.insert(media).values(input).returning({ id: media.id })
    if (!row) throw new Error('media insert returned no id')
    if (translations.length > 0) {
      await tx.insert(mediaTranslations).values(
        translations.map(t => ({ ...t, mediaId: row.id }))
      )
    }
    await bumpAiDomains(['media'])
    return row.id
  })
}

export async function updateMediaRow(
  id: number,
  patch: Partial<{ filename: string, mime: string, width: number | null, height: number | null, folderId: number | null, usageType: string }>,
  translations?: MediaTranslationRow[]
): Promise<void> {
  await getPostgresDb().transaction(async (tx) => {
    if (Object.keys(patch).length > 0) {
      await tx.update(media).set(patch).where(eq(media.id, id))
    }
    if (translations) {
      await tx.delete(mediaTranslations).where(eq(mediaTranslations.mediaId, id))
      if (translations.length > 0) {
        await tx.insert(mediaTranslations).values(
          translations.map(t => ({ ...t, mediaId: id }))
        )
      }
    }
  })
}

export async function deleteMediaRow(id: number): Promise<string | undefined> {
  return getPostgresDb().transaction(async (tx) => {
    const [row] = await tx.select().from(media).where(eq(media.id, id)).limit(1)
    if (!row) return undefined
    await tx.delete(media).where(eq(media.id, id))
    await bumpAiDomains(['media'])
    return row.storageKey
  })
}

/* ---------- variants (P20 media asset centre) ---------- */

export async function insertMediaVariants(rows: MediaVariantRow[]): Promise<void> {
  if (rows.length === 0) return
  await getPostgresDb().insert(mediaVariants).values(rows)
}

export async function listVariantsForMedia(mediaIds: number[]): Promise<Map<number, (MediaVariantRow & { url: string })[]>> {
  const map = new Map<number, (MediaVariantRow & { url: string })[]>()
  if (mediaIds.length === 0) return map
  const rows = await getPostgresDb().select().from(mediaVariants).where(inArray(mediaVariants.mediaId, mediaIds))
  for (const row of rows) {
    const list = map.get(row.mediaId) ?? []
    list.push({ ...row, url: `/media/${row.storageKey}` })
    map.set(row.mediaId, list)
  }
  return map
}

export async function findVariantStorageKeys(mediaId: number): Promise<string[]> {
  const rows = await getPostgresDb()
    .select({ storageKey: mediaVariants.storageKey })
    .from(mediaVariants)
    .where(eq(mediaVariants.mediaId, mediaId))
  return rows.map(r => r.storageKey)
}

export async function findVariantByStorageKey(key: string): Promise<typeof mediaVariants.$inferSelect | undefined> {
  const rows = await getPostgresDb().select().from(mediaVariants).where(eq(mediaVariants.storageKey, key)).limit(1)
  return rows[0]
}

/** first media row with the same content hash (duplicate detection) */
export async function findMediaIdByHash(hash: string, excludeId?: number): Promise<number | null> {
  const rows = await getPostgresDb()
    .select({ id: media.id })
    .from(media)
    .where(excludeId ? and(eq(media.hash, hash), ne(media.id, excludeId)) : eq(media.hash, hash))
    .limit(1)
  return rows[0]?.id ?? null
}
