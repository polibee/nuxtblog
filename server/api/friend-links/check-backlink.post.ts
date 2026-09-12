import { checkBacklink } from '../../modules/friend-links/checker'
import { extractDomain, normalizeUrl } from '../../modules/friend-links/url-normalizer'

/** POST /api/friend-links/check-backlink — live check for the
    submission form (设置.txt... 友链 §74). Rate limiting rides on the
    same trust boundary as submissions: coarse per-IP in-memory map. */
const hits = new Map<string, { count: number, resetAt: number }>()

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const now = Date.now()
  const entry = hits.get(ip)
  if (!entry || entry.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + 3600_000 })
  } else {
    entry.count++
    if (entry.count > 20) {
      throw createError({ statusCode: 429, statusMessage: 'Too many checks — try again later' })
    }
  }

  const body = await readBody(event) as { siteUrl?: string, backlinkUrl?: string }
  const normalized = normalizeUrl(String(body?.siteUrl ?? ''))
  const domain = extractDomain(String(body?.siteUrl ?? ''))
  if (!normalized || !domain) {
    throw createError({ statusCode: 422, statusMessage: 'A valid site URL is required' })
  }
  const result = await checkBacklink({
    siteUrl: normalized,
    backlinkUrl: body?.backlinkUrl ? String(body.backlinkUrl) : null,
    expectedDomain: domain
  })
  return { status: result.status, foundUrl: result.foundUrl, anchor: result.anchor, rel: result.rel }
})
