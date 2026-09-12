import { asc, eq } from 'drizzle-orm'
import { getDb } from './db.server'
import { friendLinkCategories, friendLinkCategoryTranslations } from './schema/friend-links'

export interface PublicFriendLinkCategory {
  id: number
  name: string
  sortOrder: number
}
export async function listPublicFriendLinkCategories(localeId?: number | null): Promise<PublicFriendLinkCategory[]> {
  const rows = await getDb().select({ id: friendLinkCategories.id, name: friendLinkCategoryTranslations.name, sortOrder: friendLinkCategories.sortOrder }).from(friendLinkCategories).leftJoin(friendLinkCategoryTranslations, eq(friendLinkCategoryTranslations.categoryId, friendLinkCategories.id)).where(localeId == null ? undefined : eq(friendLinkCategoryTranslations.localeId, localeId)).orderBy(asc(friendLinkCategories.sortOrder))
  const seen = new Map<number, PublicFriendLinkCategory>()
  for (const row of rows) if (row.name && !seen.has(row.id)) seen.set(row.id, { id: row.id, name: row.name, sortOrder: row.sortOrder })
  return [...seen.values()]
}
