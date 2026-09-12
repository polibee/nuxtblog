import { z } from 'zod'
import { isDomainDbReady } from '../../../repositories/domain-status'
import { createResetToken } from '../../../repositories/session.runtime.repository'
import { findUserRowByEmail } from '../../../repositories/user.runtime.repository'
import { generateToken, hashToken } from '../../../utils/password'
import { hitRateLimit } from '../../../utils/rate-limit'
import { sendMail } from '../../../utils/mail'

const RESET_TTL_MS = 60 * 60 * 1000

const requestSchema = z.object({ email: z.string().trim().email() })

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  // never disclose whether the email exists: always 200
  const limit = hitRateLimit({ key: 'pwreset', identity: ip, limit: 3, windowMs: 10 * 60_000 })
  if (!limit.allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests, try again later' })
  }

  const parsed = requestSchema.safeParse(await readBody(event))
  if (!parsed.success || !isDomainDbReady()) {
    return { ok: true }
  }
  const row = await findUserRowByEmail(parsed.data.email)
  if (!row || row.status !== 'active') {
    return { ok: true }
  }

  const token = generateToken()
  await createResetToken({
    tokenHash: hashToken(token),
    userId: row.id,
    expiresAt: new Date(Date.now() + RESET_TTL_MS)
  })

  const origin = getRequestURL(event).origin
  const resetUrl = `${origin}/reset-password?token=${token}`
  const sent = await sendMail(
    row.email,
    'Reset your password',
    `<p>Click the link below to reset your password (valid for 1 hour):</p><p><a href="${resetUrl}">${resetUrl}</a></p>`
  )
  if (!sent.ok) {
    // mail not configured or failed: log the link so local dev can still reset
    console.log(`[auth] password reset mail not sent (${sent.error}); reset link: ${resetUrl}`)
  }
  return { ok: true }
})
