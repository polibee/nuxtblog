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
  campaignId: number
  provider: string
  weight: number
  enabled: boolean
} | undefined> {
  const rows = await getDb().select({
    id: adCreatives.id,
    campaignId: adCreatives.campaignId,
    provider: adCreatives.provider,
    weight: adCreatives.weight,
    enabled: adCreatives.enabled
  }).from(adCreatives).where(and(eq(adCreatives.id, creativeId), eq(adCreatives.enabled, true))).limit(1)
  return rows[0]
}

/** Accrue time-based delivery spend atomically. A campaign with no budget
 * keeps legacy unlimited behavior; exhausted campaigns are ended and all
 * placements are disabled in the same transaction. */
export async function chargeCampaignBudget(campaignId: number, now = new Date()): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    const [campaign] = await tx.select({
      status: adCampaigns.status,
      budgetMinor: adCampaigns.budgetMinor,
      spentMinor: adCampaigns.spentMinor,
      billingUnit: adCampaigns.billingUnit,
      unitPriceMinor: adCampaigns.unitPriceMinor,
      lastBilledAt: adCampaigns.lastBilledAt,
      startAt: adCampaigns.startAt,
      endAt: adCampaigns.endAt
    }).from(adCampaigns).where(eq(adCampaigns.id, campaignId)).limit(1)
    if (!campaign || campaign.status !== 'active') return false
    if (campaign.endAt && campaign.endAt <= now) {
      await tx.update(adCampaigns).set({ status: 'ended' }).where(eq(adCampaigns.id, campaignId))
      await tx.update(adPlacements).set({ enabled: false }).where(eq(adPlacements.campaignId, campaignId))
      return false
    }
    if (campaign.budgetMinor <= 0 || campaign.unitPriceMinor <= 0) return true
    const last = campaign.lastBilledAt ?? campaign.startAt ?? now
    const unitMs = campaign.billingUnit === 'month' ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
    const elapsed = Math.max(0, now.getTime() - last.getTime())
    const charge = Math.floor(campaign.unitPriceMinor * elapsed / unitMs)
    if (charge <= 0) return true
    const spent = campaign.spentMinor + charge
    const exhausted = spent >= campaign.budgetMinor
    await tx.update(adCampaigns).set({
      spentMinor: Math.min(spent, campaign.budgetMinor),
      lastBilledAt: now,
      status: exhausted ? 'ended' : 'active'
    }).where(eq(adCampaigns.id, campaignId))
    if (exhausted) {
      await tx.update(adPlacements).set({ enabled: false }).where(eq(adPlacements.campaignId, campaignId))
    }
    return !exhausted
  })
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

/** Narrow, read-only advertising projection for AI analysis. */
export async function getAdvertisingAnalysis(): Promise<{
  overview: { campaigns: number, activeCampaigns: number, impressions: number, clicks: number, ctr: number, budgetMinor: number, spentMinor: number }
  campaigns: Array<{ id: number, name: string, status: string, budgetMinor: number, spentMinor: number, currency: string, impressions: number, clicks: number, ctr: number, placementCount: number }>
}> {
  const db = getDb()
  const [campaignRows, creativeRows, placementRows] = await Promise.all([
    db.select({ id: adCampaigns.id, name: adCampaigns.name, status: adCampaigns.status, budgetMinor: adCampaigns.budgetMinor, spentMinor: adCampaigns.spentMinor, currency: adCampaigns.currency }).from(adCampaigns).orderBy(asc(adCampaigns.id)),
    db.select({ campaignId: adCreatives.campaignId, impressions: adCreatives.impressions, clicks: adCreatives.clicks }).from(adCreatives),
    db.select({ campaignId: adPlacements.campaignId }).from(adPlacements).where(eq(adPlacements.enabled, true))
  ])
  const campaigns = campaignRows.map((campaign) => {
    const creatives = creativeRows.filter(row => row.campaignId === campaign.id)
    const impressions = creatives.reduce((sum, row) => sum + Number(row.impressions ?? 0), 0)
    const clicks = creatives.reduce((sum, row) => sum + Number(row.clicks ?? 0), 0)
    return {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      budgetMinor: Number(campaign.budgetMinor ?? 0),
      spentMinor: Number(campaign.spentMinor ?? 0),
      currency: campaign.currency,
      impressions,
      clicks,
      ctr: impressions > 0 ? Number((clicks / impressions * 100).toFixed(2)) : 0,
      placementCount: placementRows.filter(row => row.campaignId === campaign.id).length
    }
  })
  const impressions = campaigns.reduce((sum, campaign) => sum + campaign.impressions, 0)
  const clicks = campaigns.reduce((sum, campaign) => sum + campaign.clicks, 0)
  return {
    overview: {
      campaigns: campaigns.length,
      activeCampaigns: campaigns.filter(campaign => campaign.status === 'active').length,
      impressions,
      clicks,
      ctr: impressions > 0 ? Number((clicks / impressions * 100).toFixed(2)) : 0,
      budgetMinor: campaigns.reduce((sum, campaign) => sum + campaign.budgetMinor, 0),
      spentMinor: campaigns.reduce((sum, campaign) => sum + campaign.spentMinor, 0)
    },
    campaigns
  }
}
export async function listTranslationsByCreative(creativeId: number) {
  return getDb().select().from(adCreativeTranslations).where(eq(adCreativeTranslations.creativeId, creativeId))
}
