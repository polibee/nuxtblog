import { asc, eq, inArray } from 'drizzle-orm'
import { getDb } from './db.server'
import { sidebarCards, sidebarCardTranslations } from './schema/sidebar-cards'
import type { TranslationsRecord } from '#shared/types/locale'

export interface SidebarCardRow {
  id: number
  type: string
  linkUrl: string | null
  imageMediaId: number | null
  /** P27: type-specific config JSON (author card) */
  config: unknown
  enabled: boolean
  sortOrder: number
  createdAt: Date
  updatedAt: Date
  translations: TranslationsRecord
}

export interface TranslationRow {
  localeId: number
  title: string
  content: string
}

function translationValue(row: typeof sidebarCardTranslations.$inferSelect): Record<string, unknown> {
  return { title: row.title, content: row.content }
}

async function attachTranslations(cardIds: number[]): Promise<Map<number, TranslationsRecord>> {
  const map = new Map<number, TranslationsRecord>()
  if (cardIds.length === 0) return map
  const rows = await getDb()
    .select()
    .from(sidebarCardTranslations)
    .where(inArray(sidebarCardTranslations.cardId, cardIds))
  for (const row of rows) {
    const record = map.get(row.cardId) ?? {}
    record[String(row.localeId)] = translationValue(row)
    map.set(row.cardId, record)
  }
  return map
}

/** translations keyed by locale ID (raw rows); the service maps codes -> ids */
function toRow(
  card: typeof sidebarCards.$inferSelect,
  translations: Map<number, TranslationsRecord>
): SidebarCardRow {
  return {
    id: card.id,
    type: card.type,
    linkUrl: card.linkUrl,
    imageMediaId: card.imageMediaId,
    config: card.config,
    enabled: card.enabled,
    sortOrder: card.sortOrder,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    translations: translations.get(card.id) ?? {}
  }
}

export async function listCards(): Promise<SidebarCardRow[]> {
  const db = getDb()
  const cards = await db
    .select()
    .from(sidebarCards)
    .orderBy(asc(sidebarCards.sortOrder), asc(sidebarCards.id))
  const translationMap = await attachTranslations(cards.map(c => c.id))
  return cards.map(card => toRow(card, translationMap))
}

export async function findCard(id: number): Promise<SidebarCardRow | undefined> {
  const db = getDb()
  const rows = await db.select().from(sidebarCards).where(eq(sidebarCards.id, id)).limit(1)
  if (!rows[0]) return undefined
  const translationMap = await attachTranslations([id])
  return toRow(rows[0], translationMap)
}

export async function insertCard(
  entity: { type: string, linkUrl: string | null, imageMediaId: number | null, enabled: boolean, sortOrder: number },
  translations: TranslationRow[]
): Promise<number> {
  return getDb().transaction(async (tx) => {
    const [card] = await tx.insert(sidebarCards).values(entity)
    if (!card) throw new Error('sidebar card insert returned no id')
    if (translations.length > 0) {
      await tx.insert(sidebarCardTranslations).values(
        translations.map(t => ({ ...t, cardId: card.insertId }))
      )
    }
    return card.insertId
  })
}

export async function updateCard(
  id: number,
  entityPatch: { type?: string, linkUrl?: string | null, imageMediaId?: number | null, enabled?: boolean, sortOrder?: number },
  translations?: TranslationRow[]
): Promise<void> {
  await getDb().transaction(async (tx) => {
    if (Object.keys(entityPatch).length > 0) {
      await tx.update(sidebarCards).set(entityPatch).where(eq(sidebarCards.id, id))
    }
    if (translations) {
      await tx.delete(sidebarCardTranslations).where(eq(sidebarCardTranslations.cardId, id))
      if (translations.length > 0) {
        await tx.insert(sidebarCardTranslations).values(
          translations.map(t => ({ ...t, cardId: id }))
        )
      }
    }
  })
}

export async function deleteCard(id: number): Promise<void> {
  await getDb().delete(sidebarCards).where(eq(sidebarCards.id, id))
}
