import { z } from 'zod'
import { collectPageView } from '../../repositories/analytics.repository'
import { resolveLocale } from '../../utils/locale'
import { isBlogDbReady } from '../../repositories/db.server'
import { hitRateLimit } from '../../utils/rate-limit'

const collectSchema = z.object({
  eventId: z.string().min(8).max(64),
  path: z.string().trim().min(1).max(2048),
  referrer: z.string().max(2048).nullish(),
  screenWidth: z.number().int().positive().max(20000).nullish(),
  screenHeight: z.number().int().positive().max(20000).nullish(),
  visitorId: z.string().min(8).max(128),
  sessionId: z.string().min(8).max(128)
})

const BOT_UA = /bot|crawler|spider|crawling|headless|lighthouse|pagespeed|curl|wget|python|java\//i

/** POST /api/analytics/collect — fire-and-forget analytics collection */
export default defineEventHandler(async (event) => {
  if (!isBlogDbReady()) return { ok: false }

  const ua = getRequestHeader(event, 'user-agent') ?? ''
  if (BOT_UA.test(ua)) return { ok: false }

  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const limit = hitRateLimit({ key: 'analytics', identity: ip, limit: 60, windowMs: 60_000 })
  if (!limit.allowed) return { ok: false }

  const body = await readBody(event).catch(() => null)
  const parsed = collectSchema.safeParse(body)
  if (!parsed.success) return { ok: false }
  const data = parsed.data

  if (data.path.startsWith('/admin') || data.path.startsWith('/api') || data.path.startsWith('/preview')) {
    return { ok: false }
  }

  const locale = await resolveLocale(data.path, getRequestHeader(event, 'accept-language'))
  const search = getRequestURL(event).search ?? ''

  collectPageView({
    eventId: data.eventId,
    path: data.path,
    referrer: data.referrer ?? null,
    screen: data.screenWidth && data.screenHeight
      ? { width: data.screenWidth, height: data.screenHeight }
      : null,
    localeCode: locale.code,
    visitorKey: data.visitorId,
    sessionKey: data.sessionId
  }, ua, search).catch(() => undefined)

  return { ok: true }
})
