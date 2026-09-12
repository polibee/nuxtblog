import { and, eq, gt } from 'drizzle-orm'
import { getDb, isBlogDbReady } from '../../repositories/db.server'
import {
  findSlotByKey,
  listCampaignsByIds,
  listEnabledCreativesByCampaign,
  listPlacements
} from '../../repositories/advertising.repository'
import { membershipPlans, subscriptions } from '../../repositories/schema/membership'
import { getSettingValue } from '../settings/settings.service'

/* Decision Service (impl doc §4): the ONLY place that decides NO_AD.
   Chain: global kill switch → slot disabled → page excluded → member
   ad_free → placement → campaign window → weighted creative pick.
   Pure decision: no rendering, no impression side effects. */

export interface DecisionResult {
  creativeId: number | null
  reason: string
}

async function isCampaignActive(campaign: { status: string, startAt: Date | null, endAt: Date | null }, now: Date): Promise<boolean> {
  if (campaign.status !== 'active') return false
  if (campaign.startAt && campaign.startAt > now) return false
  if (campaign.endAt && campaign.endAt < now) return false
  return true
}

async function isAdFreeMember(userId: number): Promise<boolean> {
  const rows = await getDb()
    .select({ features: membershipPlans.features })
    .from(subscriptions)
    .innerJoin(membershipPlans, eq(subscriptions.planId, membershipPlans.id))
    .where(and(
      eq(subscriptions.userId, userId),
      eq(subscriptions.status, 'active'),
      gt(subscriptions.currentPeriodEnd, new Date())
    ))
    .limit(1)
  const features = rows[0]?.features
  if (!features) return false
  try {
    return (JSON.parse(features) as string[]).includes('ad_free')
  } catch {
    return false
  }
}

function pathExcluded(path: string, excluded: string[]): boolean {
  return excluded.some(p => p !== '' && (path === p || path.startsWith(p.endsWith('/') ? p : `${p}/`)))
}

export interface DecisionInput {
  slotKey: string
  path: string
  localeId: number
  userId: number | null
}

/** full decision chain; returns the chosen creative id or NO_AD reason */
export async function decide(input: DecisionInput): Promise<DecisionResult> {
  if (!isBlogDbReady()) {
    return { creativeId: null, reason: 'db_unavailable' }
  }
  const enabled = await getSettingValue('advertising_enabled', true)
  if (enabled === false) {
    return { creativeId: null, reason: 'globally_disabled' }
  }
  const slot = await findSlotByKey(input.slotKey)
  if (!slot) {
    return { creativeId: null, reason: 'unknown_slot' }
  }
  if (!slot.enabled) {
    return { creativeId: null, reason: 'slot_disabled' }
  }
  const excludedRaw = String(await getSettingValue('advertising_excluded_paths', ''))
  const excluded = excludedRaw.split(',').map(p => p.trim())
  if (pathExcluded(input.path, excluded)) {
    return { creativeId: null, reason: 'page_excluded' }
  }
  if (input.userId && await isAdFreeMember(input.userId)) {
    return { creativeId: null, reason: 'member_ad_free' }
  }
  const cacheKey = `${input.slotKey}:${input.localeId}`
  const cached = candidateCache.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { creativeId: cached.creativeId, reason: cached.creativeId ? 'cached' : 'no_campaign' }
  }
  const creativeId = await pickCandidateCreative(input.slotKey)
  candidateCache.set(cacheKey, { at: Date.now(), creativeId })
  return creativeId
    ? { creativeId, reason: 'ok' }
    : { creativeId: null, reason: 'no_campaign' }
}

const CACHE_TTL_MS = 60_000
const candidateCache = new Map<string, { at: number, creativeId: number | null }>()

async function pickCandidateCreative(slotKey: string): Promise<number | null> {
  const placements = await listPlacements(slotKey)
  const campaigns = await listCampaignsByIds(placements.map(p => p.campaignId))
  const now = new Date()

  /* all eligible placements compete, weighted by priority (higher =
     more traffic; P22 self-serve campaigns share the slot fairly) */
  const eligible: Array<{ creativeId: number, weight: number }> = []
  for (const placement of placements) {
    const campaign = campaigns.find(c => c.id === placement.campaignId)
    if (!campaign || !isCampaignActive(campaign, now)) continue
    const creatives = await listEnabledCreativesByCampaign(campaign.id)
    if (creatives.length === 0) continue
    const placementWeight = Math.max(placement.priority, 0) + 1
    const totalWeight = creatives.reduce((sum, c) => sum + Math.max(c.weight, 0), 0)
    for (const c of creatives) {
      eligible.push({ creativeId: c.id, weight: placementWeight * Math.max(c.weight, 0) / Math.max(totalWeight, 1) })
    }
  }
  const total = eligible.reduce((sum, e) => sum + e.weight, 0)
  if (total <= 0) return null
  let roll = Math.random() * total
  for (const entry of eligible) {
    roll -= entry.weight
    if (roll <= 0) return entry.creativeId
  }
  return eligible[eligible.length - 1]!.creativeId
}
