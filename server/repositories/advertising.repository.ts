import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { getDb } from './db.server'
import {
  adCampaigns,
  adCreativeTranslations,
  adCreatives,
  adPlacements,
  adSlots
} from './schema/advertising'
import { media } from './schema/media'

/* Advertising repositories: thin typed queries over the ad_* tables.
   Services in server/modules/advertising compose these. */

export interface AdSlotRow {
  id: number
  key: string
  name: string
  enabled: boolean
}

export async function listSlots(): Promise<AdSlotRow[]> {
  return getDb().select({
    id: adSlots.id,
    key: adSlots.key,
    name: adSlots.name,
    enabled: adSlots.enabled
  }).from(adSlots).orderBy(asc(adSlots.id))
}

export async function findSlotByKey(key: string): Promise<AdSlotRow | undefined> {
  const rows = await getDb().select({
    id: adSlots.id,
    key: adSlots.key,
    name: adSlots.name,
    enabled: adSlots.enabled
  }).from(adSlots).where(eq(adSlots.key, key)).limit(1)
  return rows[0]
}

export async function listPlacements(slotKey: string): Promise<Array<{ campaignId: number, priority: number }>> {
  return getDb().select({ campaignId: adPlacements.campaignId, priority: adPlacements.priority })
    .from(adPlacements)
    .where(and(eq(adPlacements.slotKey, slotKey), eq(adPlacements.enabled, true)))
    .orderBy(asc(adPlacements.priority))
}

export interface CampaignRow {
  id: number
  name: string
  status: string
  startAt: Date | null
  endAt: Date | null
}

export async function listCampaignsByIds(ids: number[]): Promise<CampaignRow[]> {
  if (ids.length === 0) return []
  return getDb().select({
    id: adCampaigns.id,
    name: adCampaigns.name,
    status: adCampaigns.status,
    startAt: adCampaigns.startAt,
    endAt: adCampaigns.endAt
  }).from(adCampaigns).where(inArray(adCampaigns.id, ids))
}

export async function listEnabledCreativesByCampaign(campaignId: number): Promise<Array<{
  id: number
  provider: string
  weight: number
  enabled: boolean
}>> {
  return getDb().select({
    id: adCreatives.id,
    provider: adCreatives.provider,
    weight: adCreatives.weight,
    enabled: adCreatives.enabled
  }).from(adCreatives).where(and(eq(adCreatives.campaignId, campaignId), eq(adCreatives.enabled, true)))
}

export interface CreativeTranslation {
  creativeId: number
  localeId: number
  title: string
  content: string | null
  buttonText: string | null
  imageId: number | null
  targetUrl: string | null
  altText: string | null
  imageUrl: string | null
}

export async function findCreativeTranslation(creativeId: number, localeId: number): Promise<CreativeTranslation | undefined> {
  const rows = await getDb().select({
    creativeId: adCreativeTranslations.creativeId,
    localeId: adCreativeTranslations.localeId,
    title: adCreativeTranslations.title,
    content: adCreativeTranslations.content,
    buttonText: adCreativeTranslations.buttonText,
    imageId: adCreativeTranslations.imageId,
    targetUrl: adCreativeTranslations.targetUrl,
    altText: adCreativeTranslations.altText,
    storageKey: media.storageKey
  })
    .from(adCreativeTranslations)
    .leftJoin(media, eq(adCreativeTranslations.imageId, media.id))
    .where(and(
      eq(adCreativeTranslations.creativeId, creativeId),
      eq(adCreativeTranslations.localeId, localeId)
    ))
    .limit(1)
  const row = rows[0]
  if (!row) return undefined
  return { ...row, imageUrl: row.storageKey ? `/media/${row.storageKey}` : null }
}

export async function findEnabledCreativeById(creativeId: number): Promise<{
  id: number
  provider: string
  weight: number
  enabled: boolean
} | undefined> {
  const rows = await getDb().select({
    id: adCreatives.id,
    provider: adCreatives.provider,
    weight: adCreatives.weight,
    enabled: adCreatives.enabled
  }).from(adCreatives).where(and(eq(adCreatives.id, creativeId), eq(adCreatives.enabled, true))).limit(1)
  return rows[0]
}

export async function incrementImpressions(creativeId: number): Promise<void> {
  await getDb().update(adCreatives).set({ impressions: sqlAdd('impressions') }).where(eq(adCreatives.id, creativeId))
}

export async function incrementClicks(creativeId: number): Promise<void> {
  await getDb().update(adCreatives).set({ clicks: sqlAdd('clicks') }).where(eq(adCreatives.id, creativeId))
}

function sqlAdd(column: string) {
  return sql.raw(`\`${column}\` + 1`)
}

/* admin CRUD helpers */
export async function listAllSlots() {
  return getDb().select().from(adSlots).orderBy(asc(adSlots.id))
}
export async function listAllCampaigns() {
  return getDb().select().from(adCampaigns).orderBy(asc(adCampaigns.id))
}
export async function listAllCreatives() {
  return getDb().select().from(adCreatives).orderBy(asc(adCreatives.id))
}
export async function listAllPlacements() {
  return getDb().select().from(adPlacements).orderBy(asc(adPlacements.id))
}
export async function listTranslationsByCreative(creativeId: number) {
  return getDb().select().from(adCreativeTranslations).where(eq(adCreativeTranslations.creativeId, creativeId))
}
