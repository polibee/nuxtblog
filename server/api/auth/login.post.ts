import { createSession, pruneSessions, setSessionCookie } from '../../utils/auth'
import { hitRateLimit, pruneRateLimits } from '../../utils/rate-limit'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: string, password?: string }>(event)

  if (!body?.email || !body?.password) {
    throw createError({ statusCode: 400, statusMessage: 'Email and password are required' })
  }

  // brute-force guard: 5 attempts per minute per IP+email
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const limit = hitRateLimit({
    key: 'login',
    identity: `${ip}:${body.email.toLowerCase()}`,
    limit: 5,
    windowMs: 60_000
  })
  if (!limit.allowed) {
    throw createError({
      statusCode: 429,
      statusMessage: `Too many attempts, retry in ${limit.retryAfterSeconds}s`
    })
  }

  const session = await createSession(body.email, body.password)
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
  }

  pruneRateLimits()
  void pruneSessions()
  setSessionCookie(event, session.token)
  return { user: session.user }
})
