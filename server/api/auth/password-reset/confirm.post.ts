import { z } from 'zod'
import { isDomainDbReady } from '../../../repositories/domain-status'
import {
  findUsableResetToken,
  markResetTokenUsed
} from '../../../repositories/session.runtime.repository'
import { findUserRowById, updateUserRow } from '../../../repositories/user.runtime.repository'
import { hashPassword, hashToken } from '../../../utils/password'
import { hitRateLimit } from '../../../utils/rate-limit'

const confirmSchema = z.object({
  token: z.string().min(16).max(128),
  password: z.string().min(8).max(128)
})

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const limit = hitRateLimit({ key: 'pwreset-confirm', identity: ip, limit: 10, windowMs: 10 * 60_000 })
  if (!limit.allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests, try again later' })
  }

  const parsed = confirmSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: 'Invalid token or password (min 8 chars)' })
  }
  if (!isDomainDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }

  const token = await findUsableResetToken(hashToken(parsed.data.token))
  if (!token) {
    throw createError({ statusCode: 400, statusMessage: 'Reset link is invalid or expired' })
  }
  const user = await findUserRowById(token.userId)
  if (!user || user.status !== 'active') {
    throw createError({ statusCode: 400, statusMessage: 'Reset link is invalid or expired' })
  }

  await updateUserRow(user.id, { passwordHash: await hashPassword(parsed.data.password) })
  await markResetTokenUsed(token.id)
  return { ok: true }
})
