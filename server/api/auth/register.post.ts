import { registerUser, toRegistrationResponse } from '../../modules/account/account.service'
import { createSession, setSessionCookie } from '../../utils/auth'
import { hitRateLimit } from '../../utils/rate-limit'

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const limit = hitRateLimit({ key: 'register', identity: ip, limit: 5, windowMs: 10 * 60_000 })
  if (!limit.allowed) throw createError({ statusCode: 429, statusMessage: 'Too many requests, try again later' })
  const body = await readBody(event)
  const user = await registerUser({ email: String(body?.email ?? ''), name: String(body?.name ?? ''), password: String(body?.password ?? '') })
  const session = await createSession(user.email, String(body?.password ?? ''))
  if (session) setSessionCookie(event, session.token)
  return toRegistrationResponse(user)
})
