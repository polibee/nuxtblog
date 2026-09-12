import { and, asc, eq, inArray } from 'drizzle-orm'
import { getDb } from './db.server'
import {
  categories,
  categoryTranslations,
  postCategories,
  postTags,
  tagTranslations,
  tags
} from './schema/taxonomy'

export type TaxonomyKind = 'category' | 'tag'

export interface TaxonomyRecord {
  id: number
  alias: string
  createdAt: Date
  updatedAt: Date
  translations: Record<string, { name: string, description: string }>
}

export interface TaxonomyTranslationRow {
  localeId: number
  name: string
  description: string
}

function entityTable(kind: TaxonomyKind) {
  return kind === 'category' ? categories : tags
}

function translationTable(kind: TaxonomyKind) {
  return kind === 'category' ? categoryTranslations : tagTranslations
}

function translationValue(row: { name: string, description: string }): { name: string, description: string } {
  return { name: row.name, description: row.description }
}

export async function listTaxonomy(kind: TaxonomyKind): Promise<TaxonomyRecord[]> {
  const db = getDb()
  const entity = entityTable(kind)
  const table = translationTable(kind)
  const entities = await db.select().from(entity).orderBy(asc(entity.id))
  if (entities.length === 0) return []
  const rows = await db
    .select()
    .from(table)
    .where(inArray(table.entityId, entities.map(e => e.id)))
  const byEntity = new Map<number, Record<string, { name: string, description: string }>>()
  for (const row of rows) {
    const record: Record<string, { name: string, description: string }> = byEntity.get(row.entityId) ?? {}
    record[String(row.localeId)] = translationValue(row)
    byEntity.set(row.entityId, record)
  }
  return entities.map(e => ({
    id: e.id,
    alias: e.alias,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    translations: byEntity.get(e.id) ?? {}
  }))
}

export async function findTaxonomyRow(kind: TaxonomyKind, id: number): Promise<{ id: number } | undefined> {
  const entity = entityTable(kind)
  const rows = await getDb().select({ id: entity.id }).from(entity).where(eq(entity.id, id)).limit(1)
  return rows[0]
}

export async function insertTaxonomy(
  kind: TaxonomyKind,
  alias: string,
  translations: TaxonomyTranslationRow[]
): Promise<number> {
  const entity = entityTable(kind)
  const table = translationTable(kind)
  return getDb().transaction(async (tx) => {
    const [row] = await tx.insert(entity).values({ alias })
    if (!row) throw new Error('taxonomy insert returned no id')
    await tx.insert(table).values(translations.map(t => ({ ...t, entityId: row.insertId })))
    return row.insertId
  })
}

export async function updateTaxonomy(
  kind: TaxonomyKind,
  id: number,
  alias: string,
  translations: TaxonomyTranslationRow[]
): Promise<void> {
  const entity = entityTable(kind)
  const table = translationTable(kind)
  await getDb().transaction(async (tx) => {
    await tx.update(entity).set({ alias }).where(eq(entity.id, id))
    await tx.delete(table).where(eq(table.entityId, id))
    if (translations.length > 0) {
      await tx.insert(table).values(translations.map(t => ({ ...t, entityId: id })))
    }
  })
}

export async function deleteTaxonomy(kind: TaxonomyKind, id: number): Promise<void> {
  const entity = entityTable(kind)
  await getDb().delete(entity).where(eq(entity.id, id))
}

/** taxonomy terms for one locale, keyed by entity id (name + entity alias) */
export async function termsForLocale(
  kind: TaxonomyKind,
  localeId: number,
  entityIds: number[]
): Promise<Map<number, { name: string, alias: string }>> {
  const map = new Map<number, { name: string, alias: string }>()
  if (entityIds.length === 0) return map
  if (kind === 'category') {
    const rows = await getDb()
      .select({ entityId: categoryTranslations.entityId, name: categoryTranslations.name, alias: categories.alias })
      .from(categoryTranslations)
      .innerJoin(categories, eq(categories.id, categoryTranslations.entityId))
      .where(and(inArray(categoryTranslations.entityId, entityIds), eq(categoryTranslations.localeId, localeId)))
    for (const row of rows) map.set(row.entityId, { name: row.name, alias: row.alias })
    return map
  }
  const rows = await getDb()
    .select({ entityId: tagTranslations.entityId, name: tagTranslations.name, alias: tags.alias })
    .from(tagTranslations)
    .innerJoin(tags, eq(tags.id, tagTranslations.entityId))
    .where(and(inArray(tagTranslations.entityId, entityIds), eq(tagTranslations.localeId, localeId)))
  for (const row of rows) map.set(row.entityId, { name: row.name, alias: row.alias })
  return map
}

/* ---------------- post relations ---------------- */

export async function replacePostRelations(
  postId: number,
  categoryIds: number[],
  tagIds: number[]
): Promise<void> {
  const db = getDb()
  await db.transaction(async (tx) => {
    await tx.delete(postCategories).where(eq(postCategories.postId, postId))
    await tx.delete(postTags).where(eq(postTags.postId, postId))
    if (categoryIds.length > 0) {
      await tx.insert(postCategories).values(categoryIds.map(categoryId => ({ postId, categoryId })))
    }
    if (tagIds.length > 0) {
      await tx.insert(postTags).values(tagIds.map(tagId => ({ postId, tagId })))
    }
  })
}

export async function relationsForPost(postId: number): Promise<{ categoryIds: number[], tagIds: number[] }> {
  const [cats, tgs] = await Promise.all([
    getDb().select().from(postCategories).where(eq(postCategories.postId, postId)),
    getDb().select().from(postTags).where(eq(postTags.postId, postId))
  ])
  return {
    categoryIds: cats.map(r => r.categoryId),
    tagIds: tgs.map(r => r.tagId)
  }
}

export async function postsInTaxonomy(
  kind: TaxonomyKind,
  taxonomyId: number
): Promise<number[]> {
  if (kind === 'category') {
    const rows = await getDb()
      .select({ postId: postCategories.postId })
      .from(postCategories)
      .where(eq(postCategories.categoryId, taxonomyId))
    return rows.map(r => r.postId)
  }
  const rows = await getDb()
    .select({ postId: postTags.postId })
    .from(postTags)
    .where(eq(postTags.tagId, taxonomyId))
  return rows.map(r => r.postId)
}

/** alias of a taxonomy term (entity-level, locale-independent) */
export async function findTaxonomyAliasById(kind: TaxonomyKind, taxonomyId: number): Promise<string | null> {
  const entity = entityTable(kind)
  const rows = await getDb().select({ alias: entity.alias }).from(entity).where(eq(entity.id, taxonomyId)).limit(1)
  return rows[0]?.alias ?? null
}
