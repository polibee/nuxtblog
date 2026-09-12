/* resolve the event type from h3 helpers themselves - immune to
   duplicate h3 copies across @nuxt/nitro-server and standalone h3 */
import type { AuthUser } from '#shared/types/api'
import { isDomainDbReady } from '../repositories/domain-status'
import {
  createSession as persistSession,
  deleteExpiredSessions,
  deleteSession,
  findActiveSession
} from '../repositories/session.runtime.repository'
import { findUserRowByEmail } from '../repositories/user.runtime.repository'
import { generateToken, hashToken, verifyPassword } from './password'
import { permissionsForRole } from './permissions'

type H3Evt = Parameters<typeof getCookie>[0]

/* =============================================================
 * Real authentication (P01): accounts live in the MySQL users
 * table, passwords are scrypt-hashed, sessions persist as
 * SHA-256 token hashes with an expiry. Replaces the demo
 * in-memory accounts; the exported contract is unchanged.
 * ============================================================= */

const SESSION_COOKIE = 'admin_session'

function sessionTtlMs(): number {
  const hours = Number(process.env.SESSION_TTL_HOURS) || 8
  return hours * 3_600_000
}

export async function createSession(email: string, password: string): Promise<{ token: string, user: AuthUser } | undefined> {
  if (!isDomainDbReady()) return undefined

  const row = await findUserRowByEmail(email.trim())
  if (!row || row.status !== 'active') return undefined
  if (!(await verifyPassword(password, row.passwordHash))) return undefined

  const token = generateToken()
  await persistSession({
    tokenHash: hashToken(token),
    userId: row.id,
    expiresAt: new Date(Date.now() + sessionTtlMs())
  })

  const user: AuthUser = {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as AuthUser['role'],
    permissions: permissionsForRole(row.role as AuthUser['role'])
  }
  return { token, user }
}

export async function destroySession(token: string): Promise<void> {
  await deleteSession(hashToken(token))
}

export async function getSessionUser(event: H3Evt): Promise<AuthUser | undefined> {
  const token = getCookie(event, SESSION_COOKIE)
  if (!token || !isDomainDbReady()) return undefined

  const found = await findActiveSession(hashToken(token))
  if (!found || found.user.status !== 'active') return undefined

  return {
    id: found.user.id,
    name: found.user.name,
    email: found.user.email,
    role: found.user.role as AuthUser['role'],
    permissions: permissionsForRole(found.user.role as AuthUser['role'])
  }
}

export async function requireUser(event: H3Evt): Promise<AuthUser> {
  const user = await getSessionUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  return user
}

/** server-side permission enforcement (defense in depth) */
export async function requirePermission(event: H3Evt, permission: string): Promise<AuthUser> {
  const user = await requireUser(event)
  if (user.permissions.includes('*')) return user
  if (user.permissions.includes(permission)) return user
  if (user.permissions.some(p => p.endsWith('.*') && permission.startsWith(p.slice(0, -1)))) return user
  throw createError({ statusCode: 403, statusMessage: `Missing permission: ${permission}` })
}

export function setSessionCookie(event: H3Evt, token: string): void {
  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
    maxAge: Math.floor(sessionTtlMs() / 1000)
  })
}

export function clearSessionCookie(event: H3Evt): void {
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
}

/** boot hygiene: purge expired sessions; never blocks startup */
export async function pruneSessions(): Promise<void> {
  try {
    await deleteExpiredSessions()
  } catch (e: unknown) {
    console.error('[auth] session prune failed:', (e as Error).message)
  }
}
