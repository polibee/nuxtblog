import { and, asc, eq, inArray } from 'drizzle-orm'
import { getPostgresDb } from './db-postgres.server'
import { categories, categoryTranslations, postCategories, postTags, tagTranslations, tags } from './schema-postgres/taxonomy'

export type TaxonomyKind = 'category' | 'tag'
export interface TaxonomyRecord { id: number, alias: string, createdAt: Date, updatedAt: Date, translations: Record<string, { name: string, description: string }> }
export interface TaxonomyTranslationRow { localeId: number, name: string, description: string }

function entityTable(kind: TaxonomyKind) {
  return kind === 'category' ? categories : tags
}
function translationTable(kind: TaxonomyKind) {
  return kind === 'category' ? categoryTranslations : tagTranslations
}

export async function listTaxonomy(kind: TaxonomyKind): Promise<TaxonomyRecord[]> {
  const db = getPostgresDb()
  const entity = entityTable(kind)
  const table = translationTable(kind)
  const entities = await db.select().from(entity).orderBy(asc(entity.id))
  if (entities.length === 0) return []
  const rows = await db.select().from(table).where(inArray(table.entityId, entities.map(e => e.id)))
  const byEntity = new Map<number, Record<string, { name: string, description: string }>>()
  for (const row of rows) byEntity.set(row.entityId, { ...(byEntity.get(row.entityId) ?? {}), [String(row.localeId)]: { name: row.name, description: row.description } })
  return entities.map(e => ({ id: e.id, alias: e.alias, createdAt: e.createdAt, updatedAt: e.updatedAt, translations: byEntity.get(e.id) ?? {} }))
}
export async function findTaxonomyRow(kind: TaxonomyKind, id: number) {
  const entity = entityTable(kind)
  const rows = await getPostgresDb().select({ id: entity.id }).from(entity).where(eq(entity.id, id)).limit(1)
  return rows[0]
}
export async function insertTaxonomy(kind: TaxonomyKind, alias: string, translations: TaxonomyTranslationRow[]): Promise<number> {
  const entity = entityTable(kind)
  const table = translationTable(kind)
  return getPostgresDb().transaction(async (tx) => {
    const [row] = await tx.insert(entity).values({ alias }).returning({ id: entity.id })
    if (!row) throw new Error('taxonomy insert returned no id')
    if (translations.length) await tx.insert(table).values(translations.map(t => ({ ...t, entityId: row.id })))
    return row.id
  })
}
export async function updateTaxonomy(kind: TaxonomyKind, id: number, alias: string, translations: TaxonomyTranslationRow[]) {
  const entity = entityTable(kind)
  const table = translationTable(kind)
  await getPostgresDb().transaction(async (tx) => {
    await tx.update(entity).set({ alias }).where(eq(entity.id, id))
    await tx.delete(table).where(eq(table.entityId, id))
    if (translations.length) await tx.insert(table).values(translations.map(t => ({ ...t, entityId: id })))
  })
}
export async function deleteTaxonomy(kind: TaxonomyKind, id: number) {
  const entity = entityTable(kind)
  await getPostgresDb().delete(entity).where(eq(entity.id, id))
}
export async function termsForLocale(kind: TaxonomyKind, localeId: number, entityIds: number[]): Promise<Map<number, { name: string, alias: string }>> {
  const map = new Map<number, { name: string, alias: string }>()
  if (!entityIds.length) return map
  if (kind === 'category') {
    const rows = await getPostgresDb().select({ entityId: categoryTranslations.entityId, name: categoryTranslations.name, alias: categories.alias }).from(categoryTranslations).innerJoin(categories, eq(categories.id, categoryTranslations.entityId)).where(and(inArray(categoryTranslations.entityId, entityIds), eq(categoryTranslations.localeId, localeId)))
    for (const row of rows) map.set(row.entityId, row)
    return map
  }
  const rows = await getPostgresDb().select({ entityId: tagTranslations.entityId, name: tagTranslations.name, alias: tags.alias }).from(tagTranslations).innerJoin(tags, eq(tags.id, tagTranslations.entityId)).where(and(inArray(tagTranslations.entityId, entityIds), eq(tagTranslations.localeId, localeId)))
  for (const row of rows) map.set(row.entityId, row)
  return map
}
export async function replacePostRelations(postId: number, categoryIds: number[], tagIds: number[]) {
  await getPostgresDb().transaction(async (tx) => {
    await tx.delete(postCategories).where(eq(postCategories.postId, postId))
    await tx.delete(postTags).where(eq(postTags.postId, postId))
    if (categoryIds.length) await tx.insert(postCategories).values(categoryIds.map(categoryId => ({ postId, categoryId })))
    if (tagIds.length) await tx.insert(postTags).values(tagIds.map(tagId => ({ postId, tagId })))
  })
}
export async function relationsForPost(postId: number) {
  const [cats, tgs] = await Promise.all([getPostgresDb().select().from(postCategories).where(eq(postCategories.postId, postId)), getPostgresDb().select().from(postTags).where(eq(postTags.postId, postId))])
  return { categoryIds: cats.map(r => r.categoryId), tagIds: tgs.map(r => r.tagId) }
}
export async function postsInTaxonomy(kind: TaxonomyKind, taxonomyId: number) {
  const rows = kind === 'category' ? await getPostgresDb().select({ postId: postCategories.postId }).from(postCategories).where(eq(postCategories.categoryId, taxonomyId)) : await getPostgresDb().select({ postId: postTags.postId }).from(postTags).where(eq(postTags.tagId, taxonomyId))
  return rows.map(r => r.postId)
}
export async function findTaxonomyAliasById(kind: TaxonomyKind, taxonomyId: number) {
  const entity = entityTable(kind)
  const rows = await getPostgresDb().select({ alias: entity.alias }).from(entity).where(eq(entity.id, taxonomyId)).limit(1)
  return rows[0]?.alias ?? null
}
