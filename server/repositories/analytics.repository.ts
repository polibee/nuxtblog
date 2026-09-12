import { and, asc, desc, eq, gte, inArray, sql } from 'drizzle-orm'
import { getDb } from './db.server'
import { analyticsEvents, analyticsSessions } from './schema/analytics'

/* Analytics (architecture §11): collection (dedup + session upsert)
   and report queries. Collection failure must never block rendering. */

// ---------------- collection ----------------

export interface CollectEventInput {
  eventId: string
  path: string
  referrer: string | null
  screen: { width: number, height: number } | null
  localeCode: string
  visitorKey: string
  sessionKey: string
}

export interface UaInfo {
  deviceType: 'desktop' | 'mobile' | 'tablet'
  browser: string
  operatingSystem: string
  isBot: boolean
}

export function parseUserAgent(ua: string): UaInfo {
  const lower = ua.toLowerCase()
  const isBot = /bot|crawler|spider|crawling|headless|lighthouse|pagespeed/i.test(ua)
  const isTablet = /ipad|tablet/i.test(ua)
  const isMobile = /mobile|iphone|android(?!.*tablet)/i.test(lower) && !isTablet
  const deviceType = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop'

  let browser = 'Other'
  if (/firefox/i.test(ua)) browser = 'Firefox'
  else if (/edg\//i.test(ua)) browser = 'Edge'
  else if (/chrome/i.test(ua)) browser = 'Chrome'
  else if (/safari/i.test(ua)) browser = 'Safari'

  let os = 'Other'
  if (/windows/i.test(ua)) os = 'Windows'
  else if (/mac os|macintosh/i.test(ua)) os = 'macOS'
  else if (/linux/i.test(ua) && !/android/i.test(ua)) os = 'Linux'
  else if (/android/i.test(ua)) os = 'Android'
  else if (/ios|iphone|ipad/i.test(ua)) os = 'iOS'

  return { deviceType, browser, operatingSystem: os, isBot }
}

export function parseReferrerDomain(referrer: string | null): { domain: string | null, source: string } {
  if (!referrer) return { domain: null, source: 'direct' }
  try {
    const url = new URL(referrer)
    return { domain: url.hostname, source: url.hostname }
  } catch {
    return { domain: null, source: 'direct' }
  }
}

export function parseUtm(search: string): { source: string | null, medium: string | null, campaign: string | null } {
  try {
    const params = new URLSearchParams(search)
    return {
      source: params.get('utm_source'),
      medium: params.get('utm_medium'),
      campaign: params.get('utm_campaign')
    }
  } catch {
    return { source: null, medium: null, campaign: null }
  }
}

function viewportBucket(width: number): string {
  if (width < 640) return 'xs'
  if (width < 1024) return 'sm'
  if (width < 1280) return 'md'
  return 'lg'
}

/** insert event (deduped by event_id) + upsert session (30-min window) */
export async function collectPageView(input: CollectEventInput, ua: string, search: string): Promise<void> {
  const db = getDb()
  const now = new Date()
  const uaInfo = parseUserAgent(ua)
  const { domain, source } = parseReferrerDomain(input.referrer)
  const utm = parseUtm(search)
  const bucket = input.screen ? viewportBucket(input.screen.width) : null

  await db.insert(analyticsEvents).values({
    eventId: input.eventId,
    eventType: 'page_view',
    occurredAt: now,
    sessionKey: input.sessionKey,
    visitorKey: input.visitorKey,
    path: input.path.slice(0, 2048),
    localeCode: input.localeCode,
    referrerDomain: domain,
    utmSource: utm.source,
    utmMedium: utm.medium,
    utmCampaign: utm.campaign,
    deviceType: uaInfo.deviceType,
    browser: uaInfo.browser,
    operatingSystem: uaInfo.operatingSystem,
    viewportBucket: bucket,
    isBot: uaInfo.isBot
  }).onDuplicateKeyUpdate({ set: { eventId: input.eventId } })

  await db.insert(analyticsSessions).values({
    sessionKey: input.sessionKey,
    visitorKey: input.visitorKey,
    startedAt: now,
    lastSeenAt: now,
    landingPath: input.path.slice(0, 2048),
    source,
    medium: utm.medium,
    campaign: utm.campaign,
    localeCode: input.localeCode,
    deviceType: uaInfo.deviceType,
    browser: uaInfo.browser,
    operatingSystem: uaInfo.operatingSystem,
    pageviews: 1,
    isBot: uaInfo.isBot
  }).onDuplicateKeyUpdate({
    set: {
      lastSeenAt: now,
      pageviews: sql`${analyticsSessions.pageviews} + 1`,
      isBounce: false
    }
  })
}

// ---------------- report queries (§11.7) ----------------

export interface AnalyticsOverview {
  pageviews: number
  sessions: number
  visitors: number
  bounceRate: number
}

export async function getOverview(days: number): Promise<AnalyticsOverview> {
  const since = new Date(Date.now() - days * 86_400_000)
  const db = getDb()

  const [eventStats] = await db
    .select({
      pageviews: sql<number>`count(*)`,
      sessions: sql<number>`count(distinct ${analyticsEvents.sessionKey})`,
      visitors: sql<number>`count(distinct ${analyticsEvents.visitorKey})`
    })
    .from(analyticsEvents)
    .where(gte(analyticsEvents.occurredAt, since))

  const [sessionStats] = await db
    .select({
      total: sql<number>`count(*)`,
      bounces: sql<number>`coalesce(sum(case when ${analyticsSessions.isBounce} then 1 else 0 end), 0)`
    })
    .from(analyticsSessions)
    .where(gte(analyticsSessions.startedAt, since))

  const pageviews = Number(eventStats?.pageviews ?? 0)
  const sessions = Number(eventStats?.sessions ?? 0)
  const totalSessions = Number(sessionStats?.total ?? 0)
  const bounces = Number(sessionStats?.bounces ?? 0)

  return {
    pageviews,
    sessions,
    visitors: Number(eventStats?.visitors ?? 0),
    bounceRate: totalSessions > 0 ? Math.round((bounces / totalSessions) * 100) : 0
  }
}

export interface DailyTrendPoint {
  date: string
  pageviews: number
  sessions: number
}

export async function getDailyTrend(days: number): Promise<DailyTrendPoint[]> {
  const since = new Date(Date.now() - days * 86_400_000)
  const rows = await getDb()
    .select({
      date: sql<string>`cast(${analyticsEvents.occurredAt} as date)`,
      pageviews: sql<number>`count(*)`,
      sessions: sql<number>`count(distinct ${analyticsEvents.sessionKey})`
    })
    .from(analyticsEvents)
    .where(gte(analyticsEvents.occurredAt, since))
    .groupBy(sql`cast(${analyticsEvents.occurredAt} as date)`)
    .orderBy(asc(sql`cast(${analyticsEvents.occurredAt} as date)`))
  return rows.map(row => ({
    date: String(row.date),
    pageviews: Number(row.pageviews),
    sessions: Number(row.sessions)
  }))
}

export interface TopSource {
  source: string
  pageviews: number
}

export async function getTopSources(days: number, limit: number): Promise<TopSource[]> {
  const since = new Date(Date.now() - days * 86_400_000)
  const rows = await getDb()
    .select({
      source: analyticsSessions.source,
      pageviews: sql<number>`sum(${analyticsSessions.pageviews})`
    })
    .from(analyticsSessions)
    .where(gte(analyticsSessions.startedAt, since))
    .groupBy(analyticsSessions.source)
    .orderBy(desc(sql`sum(${analyticsSessions.pageviews})`))
    .limit(limit)
  return rows.map(row => ({ source: row.source, pageviews: Number(row.pageviews) }))
}

export interface TopPage {
  path: string
  pageviews: number
}

export async function getTopPages(days: number, limit: number): Promise<TopPage[]> {
  const since = new Date(Date.now() - days * 86_400_000)
  const rows = await getDb()
    .select({
      path: analyticsEvents.path,
      pageviews: sql<number>`count(*)`
    })
    .from(analyticsEvents)
    .where(gte(analyticsEvents.occurredAt, since))
    .groupBy(analyticsEvents.path)
    .orderBy(desc(sql`count(*)`))
    .limit(limit)
  return rows.map(row => ({ path: row.path, pageviews: Number(row.pageviews) }))
}

/** non-bot page_view totals for exact paths (public post cards) */
export async function listViewCounts(paths: string[]): Promise<Map<string, number>> {
  if (paths.length === 0) return new Map()
  const rows = await getDb()
    .select({
      path: analyticsEvents.path,
      views: sql<number>`count(*)`
    })
    .from(analyticsEvents)
    .where(and(
      eq(analyticsEvents.isBot, false),
      eq(analyticsEvents.eventType, 'page_view'),
      inArray(analyticsEvents.path, paths)
    ))
    .groupBy(analyticsEvents.path)
  return new Map(rows.map(row => [row.path, Number(row.views)]))
}
