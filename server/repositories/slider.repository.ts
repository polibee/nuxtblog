import { and, asc, eq, inArray } from 'drizzle-orm'
import { getDb } from './db.server'
import { media } from './schema/media'
import { sliderItemTranslations, sliderItems, sliders } from './schema/slider'

export type SliderRow = typeof sliders.$inferSelect
export type SliderItemRow = typeof sliderItems.$inferSelect
export type SliderItemTranslationRow = typeof sliderItemTranslations.$inferSelect

export async function listSliders(): Promise<SliderRow[]> {
  return getDb().select().from(sliders).orderBy(asc(sliders.sortOrder), asc(sliders.id))
}

export async function findSlider(id: number): Promise<SliderRow | undefined> {
  const rows = await getDb().select().from(sliders).where(eq(sliders.id, id)).limit(1)
  return rows[0]
}

export async function findSliderByKey(key: string): Promise<SliderRow | undefined> {
  const rows = await getDb().select().from(sliders).where(eq(sliders.key, key)).limit(1)
  return rows[0]
}

export async function insertSlider(entity: typeof sliders.$inferInsert): Promise<number> {
  const [row] = await getDb().insert(sliders).values(entity)
  if (!row) throw new Error('slider insert returned no id')
  return row.insertId
}

export async function updateSliderRow(id: number, patch: Partial<typeof sliders.$inferInsert>): Promise<void> {
  await getDb().update(sliders).set(patch).where(eq(sliders.id, id))
}

export async function deleteSliderRow(id: number): Promise<void> {
  const itemRows = await getDb().select({ id: sliderItems.id }).from(sliderItems).where(eq(sliderItems.sliderId, id))
  const itemIds = itemRows.map(r => r.id)
  if (itemIds.length > 0) {
    await getDb().delete(sliderItemTranslations).where(inArray(sliderItemTranslations.sliderItemId, itemIds))
  }
  await getDb().delete(sliderItems).where(eq(sliderItems.sliderId, id))
  await getDb().delete(sliders).where(eq(sliders.id, id))
}

export async function listSliderItems(sliderId: number): Promise<SliderItemRow[]> {
  return getDb()
    .select()
    .from(sliderItems)
    .where(eq(sliderItems.sliderId, sliderId))
    .orderBy(asc(sliderItems.sortOrder), asc(sliderItems.id))
}

export async function findSliderItem(id: number): Promise<SliderItemRow | undefined> {
  const rows = await getDb().select().from(sliderItems).where(eq(sliderItems.id, id)).limit(1)
  return rows[0]
}

export async function insertSliderItem(entity: typeof sliderItems.$inferInsert): Promise<number> {
  const [row] = await getDb().insert(sliderItems).values(entity)
  if (!row) throw new Error('slider item insert returned no id')
  return row.insertId
}

export async function updateSliderItemRow(id: number, patch: Partial<typeof sliderItems.$inferInsert>): Promise<void> {
  await getDb().update(sliderItems).set(patch).where(eq(sliderItems.id, id))
}

export async function deleteSliderItemRow(id: number): Promise<void> {
  await getDb().delete(sliderItemTranslations).where(eq(sliderItemTranslations.sliderItemId, id))
  await getDb().delete(sliderItems).where(eq(sliderItems.id, id))
}

/** save full translation set for one item (delete + insert, MySQL has no onConflict) */
export async function replaceItemTranslations(
  itemId: number,
  rows: Omit<SliderItemTranslationRow, 'id' | 'createdAt' | 'updatedAt'>[]
): Promise<void> {
  const db = getDb()
  await db.transaction(async (tx) => {
    await tx.delete(sliderItemTranslations).where(eq(sliderItemTranslations.sliderItemId, itemId))
    if (rows.length > 0) {
      await tx.insert(sliderItemTranslations).values(rows)
    }
  })
}

export async function listTranslationsForItems(itemIds: number[]): Promise<SliderItemTranslationRow[]> {
  if (itemIds.length === 0) return []
  return getDb().select().from(sliderItemTranslations).where(inArray(sliderItemTranslations.sliderItemId, itemIds))
}

/** deterministic reorder inside one slider */
export async function reorderSliderItems(sliderId: number, ids: number[]): Promise<void> {
  const db = getDb()
  await db.transaction(async (tx) => {
    for (let i = 0; i < ids.length; i++) {
      await tx
        .update(sliderItems)
        .set({ sortOrder: i, sliderId })
        .where(and(eq(sliderItems.id, ids[i]!), eq(sliderItems.sliderId, sliderId)))
    }
  })
}

export async function mediaUrlFor(mediaId: number | null): Promise<string | null> {
  if (!mediaId) return null
  const rows = await getDb().select({ storageKey: media.storageKey }).from(media).where(eq(media.id, mediaId)).limit(1)
  return rows[0] ? `/media/${rows[0].storageKey}` : null
}
