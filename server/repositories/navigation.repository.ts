import { and, asc, eq, inArray } from 'drizzle-orm'
import { getDb } from './db.server'
import {
  navigationItemTranslations,
  navigationItems,
  navigationVariants,
  navigations
} from './schema/navigations'

export interface NavigationVariantMeta {
  id: number
  navigationId: number
  localeId: number
  status: string
  isDefault: boolean
}

export interface NavigationRecord {
  id: number
  key: string
  location: string
  adminName: string
  enabled: boolean
  variants: NavigationVariantMeta[]
}

export interface NavigationItemRow {
  id: number
  parentId: number | null
  type: string
  targetEntityType: string | null
  targetEntityId: number | null
  sortOrder: number
  enabled: boolean
  openInNewTab: boolean
  rel: string | null
  label: string | null
  alias: string | null
  customUrl: string | null
  titleAttribute: string | null
  nofollow: boolean
}

export async function listNavigations(): Promise<NavigationRecord[]> {
  const db = getDb()
  const menus = await db.select().from(navigations).orderBy(asc(navigations.id))
  const variants = menus.length > 0
    ? await db
        .select()
        .from(navigationVariants)
        .where(inArray(navigationVariants.navigationId, menus.map(m => m.id)))
    : []
  return menus.map(menu => ({
    id: menu.id,
    key: menu.key,
    location: menu.location,
    adminName: menu.adminName,
    enabled: menu.enabled,
    variants: variants
      .filter(v => v.navigationId === menu.id)
      .map(v => ({
        id: v.id,
        navigationId: v.navigationId,
        localeId: v.localeId,
        status: v.status,
        isDefault: v.isDefault
      }))
  }))
}

export async function findNavigationRow(id: number): Promise<NavigationRecord | undefined> {
  const rows = await getDb().select().from(navigations).where(eq(navigations.id, id)).limit(1)
  const menu = rows[0]
  if (!menu) return undefined
  const variants = await getDb()
    .select()
    .from(navigationVariants)
    .where(eq(navigationVariants.navigationId, id))
  return {
    id: menu.id,
    key: menu.key,
    location: menu.location,
    adminName: menu.adminName,
    enabled: menu.enabled,
    variants: variants.map(v => ({
      id: v.id,
      navigationId: v.navigationId,
      localeId: v.localeId,
      status: v.status,
      isDefault: v.isDefault
    }))
  }
}

export async function findNavigationByLocation(location: string): Promise<NavigationRecord | undefined> {
  const rows = await getDb().select().from(navigations).where(eq(navigations.location, location)).limit(1)
  const menu = rows[0]
  if (!menu) return undefined
  return findNavigationRow(menu.id)
}

export async function updateNavigationMeta(id: number, patch: { adminName?: string, enabled?: boolean }): Promise<void> {
  await getDb().update(navigations).set(patch).where(eq(navigations.id, id))
}

export async function updateVariantStatus(variantId: number, status: string): Promise<void> {
  await getDb().update(navigationVariants).set({ status }).where(eq(navigationVariants.id, variantId))
}

export async function insertNavigation(input: { key: string, location: string, adminName: string }): Promise<number> {
  const [row] = await getDb().insert(navigations).values(input)
  if (!row) throw new Error('navigation insert returned no id')
  return row.insertId
}

/* ---------------- variants ---------------- */

export async function findVariant(navigationId: number, localeId: number): Promise<NavigationVariantMeta | undefined> {
  const rows = await getDb()
    .select()
    .from(navigationVariants)
    .where(and(eq(navigationVariants.navigationId, navigationId), eq(navigationVariants.localeId, localeId)))
    .limit(1)
  return rows[0] ? toVariantMeta(rows[0]) : undefined
}

export async function findVariantById(variantId: number): Promise<NavigationVariantMeta | undefined> {
  const rows = await getDb().select().from(navigationVariants).where(eq(navigationVariants.id, variantId)).limit(1)
  return rows[0] ? toVariantMeta(rows[0]) : undefined
}

function toVariantMeta(row: typeof navigationVariants.$inferSelect): NavigationVariantMeta {
  return {
    id: row.id,
    navigationId: row.navigationId,
    localeId: row.localeId,
    status: row.status,
    isDefault: row.isDefault
  }
}

export async function insertVariant(input: {
  navigationId: number
  localeId: number
  status?: string
  isDefault?: boolean
}): Promise<number> {
  const [row] = await getDb().insert(navigationVariants).values({
    navigationId: input.navigationId,
    localeId: input.localeId,
    status: input.status ?? 'published',
    isDefault: input.isDefault ?? false
  })
  if (!row) throw new Error('variant insert returned no id')
  return row.insertId
}

export async function deleteVariant(variantId: number): Promise<void> {
  await getDb().delete(navigationVariants).where(eq(navigationVariants.id, variantId))
}

export async function deleteNavigationRow(id: number): Promise<void> {
  await getDb().delete(navigations).where(eq(navigations.id, id))
}

export async function clearDefaultFlags(navigationId: number, exceptVariantId?: number): Promise<void> {
  const variants = await getDb()
    .select()
    .from(navigationVariants)
    .where(eq(navigationVariants.navigationId, navigationId))
  for (const variant of variants) {
    if (variant.isDefault && variant.id !== exceptVariantId) {
      await getDb().update(navigationVariants).set({ isDefault: false }).where(eq(navigationVariants.id, variant.id))
    }
  }
}

/* ---------------- items ---------------- */

export async function listVariantItems(variantId: number): Promise<NavigationItemRow[]> {
  const db = getDb()
  const items = await db
    .select()
    .from(navigationItems)
    .where(eq(navigationItems.navigationVariantId, variantId))
    .orderBy(asc(navigationItems.sortOrder), asc(navigationItems.id))
  if (items.length === 0) return []
  const labelRows = await db
    .select()
    .from(navigationItemTranslations)
    .where(inArray(navigationItemTranslations.itemId, items.map(i => i.id)))
  const labels = new Map<number, { label: string, alias: string | null, customUrl: string | null, titleAttribute: string | null, nofollow: boolean }>()
  for (const row of labelRows) {
    labels.set(row.itemId, {
      label: row.label,
      alias: row.alias,
      customUrl: row.customUrl,
      titleAttribute: row.titleAttribute,
      nofollow: row.nofollow
    })
  }
  return items.map((item) => {
    const translation = labels.get(item.id)
    return {
      id: item.id,
      parentId: item.parentId,
      type: item.type,
      targetEntityType: item.targetEntityType,
      targetEntityId: item.targetEntityId,
      sortOrder: item.sortOrder,
      enabled: item.enabled,
      openInNewTab: item.openInNewTab,
      rel: item.rel,
      label: translation?.label ?? null,
      alias: translation?.alias ?? null,
      customUrl: translation?.customUrl ?? null,
      titleAttribute: translation?.titleAttribute ?? null,
      nofollow: translation?.nofollow ?? false
    }
  })
}

export interface ItemInsertRow {
  /** stable temp key used by sibling/child rows to reference this item */
  tempKey: number
  parentTempKey: number | null
  sortOrder: number
  type: string
  targetEntityType: string | null
  targetEntityId: number | null
  enabled: boolean
  openInNewTab: boolean
  rel: string | null
  label: string
  alias: string | null
  customUrl: string | null
  titleAttribute: string | null
  nofollow: boolean
}

/** replace the whole item tree of a variant inside one transaction */
export async function replaceVariantItems(
  variantId: number,
  localeId: number,
  rows: ItemInsertRow[]
): Promise<void> {
  await getDb().transaction(async (tx) => {
    await tx.delete(navigationItems).where(eq(navigationItems.navigationVariantId, variantId))
    const tempToId = new Map<number, number>()
    for (const row of rows) {
      const parentId = row.parentTempKey !== null ? tempToId.get(row.parentTempKey) ?? null : null
      const [inserted] = await tx.insert(navigationItems).values({
        navigationVariantId: variantId,
        parentId,
        sortOrder: row.sortOrder,
        type: row.type,
        targetEntityType: row.targetEntityType,
        targetEntityId: row.targetEntityId,
        enabled: row.enabled,
        openInNewTab: row.openInNewTab,
        rel: row.rel
      })
      if (!inserted) throw new Error('navigation item insert returned no id')
      tempToId.set(row.tempKey, inserted.insertId)
      await tx.insert(navigationItemTranslations).values({
        itemId: inserted.insertId,
        localeId,
        label: row.label,
        alias: row.alias,
        customUrl: row.customUrl,
        titleAttribute: row.titleAttribute,
        nofollow: row.nofollow
      })
    }
  })
}

/** copy the item tree of a source variant into a target variant */
export async function copyVariantItems(fromVariantId: number, toVariantId: number, toLocaleId: number, copyLabels = true): Promise<void> {
  const source = await listVariantItems(fromVariantId)
  const sourceIds = source.map(item => item.id)
  const sourceLabels = sourceIds.length > 0
    ? await getDb()
        .select()
        .from(navigationItemTranslations)
        .where(inArray(navigationItemTranslations.itemId, sourceIds))
    : []
  const labelByItem = new Map(sourceLabels.map(row => [row.itemId, row]))

  await getDb().transaction(async (tx) => {
    await tx.delete(navigationItems).where(eq(navigationItems.navigationVariantId, toVariantId))
    const sourceIdToNewId = new Map<number, number>()
    for (const item of source) {
      const [inserted] = await tx.insert(navigationItems).values({
        navigationVariantId: toVariantId,
        parentId: item.parentId ? sourceIdToNewId.get(item.parentId) ?? null : null,
        sortOrder: item.sortOrder,
        type: item.type,
        targetEntityType: item.targetEntityType,
        targetEntityId: item.targetEntityId,
        enabled: item.enabled,
        openInNewTab: item.openInNewTab,
        rel: item.rel
      })
      if (!inserted) continue
      sourceIdToNewId.set(item.id, inserted.insertId)
      const sourceTranslation = labelByItem.get(item.id)
      await tx.insert(navigationItemTranslations).values({
        itemId: inserted.insertId,
        localeId: toLocaleId,
        label: copyLabels ? sourceTranslation?.label ?? '' : '',
        alias: sourceTranslation?.alias ?? null,
        customUrl: sourceTranslation?.customUrl ?? null,
        titleAttribute: sourceTranslation?.titleAttribute ?? null,
        nofollow: sourceTranslation?.nofollow ?? false
      })
    }
  })
}
