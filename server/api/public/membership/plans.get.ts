import { listPublishedPlans } from '../../../modules/membership/membership.service'
import { hitRateLimit } from '../../../utils/rate-limit'

/** GET /api/public/membership/plans — published membership plans (checkout
    uses productAlias, a shadow product riding the standard order flow) */
export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const limit = hitRateLimit({ key: 'plans', identity: ip, limit: 60, windowMs: 60_000 })
  if (!limit.allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }
  return { plans: await listPublishedPlans() }
})
