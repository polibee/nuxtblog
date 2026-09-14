import { createError } from 'h3'
import { z } from 'zod'
import type { AuthUser } from '#shared/types/api'
import { deleteSessionsForUser, deleteSessionsForUserExcept } from '../../repositories/session.runtime.repository'
import { findByUserId, upsertProfile, type ProfilePatch, type UserProfileView } from '../../repositories/user-profile.repository'
import { emailExists, findUserById, findUserRowById, insertUser, updateUserRow } from '../../repositories/user.runtime.repository'
import { hashPassword, verifyPassword } from '../../utils/password'
import { permissionsForRole } from '../../utils/permissions'

export interface RegisterUserInput { email: string, name: string, password: string }

export const profileUpdateSchema = z.object({
  name: z.string().max(80).optional(),
  websiteUrl: z.string().max(500).nullable().optional(),
  bio: z.string().max(10_000).optional(),
  locale: z.string().min(2).max(20).optional(),
  timezone: z.string().min(1).max(64).optional(),
  avatarMediaId: z.number().int().positive().nullable().optional()
}).strict()

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128)
}).strict()

function invalid(message: string): never {
  throw createError({ statusCode: 422, statusMessage: message })
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function toAuthUser(user: { id: number, name: string, email: string, role: string }): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as AuthUser['role'],
    permissions: permissionsForRole(user.role as AuthUser['role'])
  }
}

export function toRegistrationResponse(user: AuthUser): { user: { id: number, name: string, role: AuthUser['role'] } } {
  return { user: { id: user.id, name: user.name, role: user.role } }
}

export async function registerUser(input: RegisterUserInput): Promise<AuthUser> {
  const email = normalizeEmail(input.email)
  const name = input.name.trim()
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 255) invalid('Invalid email')
  if (!name || name.length > 80) invalid('Name is required and must be at most 80 characters')
  if (input.password.length < 8 || input.password.length > 128) invalid('Password must be 8-128 characters')
  if (await emailExists(email)) throw createError({ statusCode: 409, statusMessage: 'Email already exists' })
  let record
  try {
    record = await insertUser({ email, name, role: 'viewer', status: 'active', passwordHash: await hashPassword(input.password) })
  } catch (error: unknown) {
    const dbError = error as { code?: string, errno?: number }
    if (dbError.code === 'ER_DUP_ENTRY' || dbError.errno === 1062) {
      throw createError({ statusCode: 409, statusMessage: 'Email already exists' })
    }
    throw error
  }
  await upsertProfile(record.id, {})
  return toAuthUser(record)
}

export async function getOwnProfile(userId: number): Promise<UserProfileView> {
  const profile = await findByUserId(userId)
  if (!profile) throw createError({ statusCode: 404, statusMessage: `User #${userId} not found` })
  return profile
}

function validateUrl(value: string | null | undefined): void {
  if (value === undefined || value === null || value === '') return
  if (value.length > 500) {
    invalid('Website URL must be at most 500 characters')
  }
  let url: URL
  try {
    url = new URL(value)
  } catch {
    invalid('Website URL is invalid')
  }
  if (!['http:', 'https:'].includes(url.protocol)) invalid('Website URL must use HTTP or HTTPS')
}

export async function updateOwnProfile(actorId: number, userId: number, input: { name?: string, websiteUrl?: string | null, bio?: string, locale?: string, timezone?: string, avatarMediaId?: number | null }): Promise<UserProfileView> {
  if (actorId !== userId) throw createError({ statusCode: 403, statusMessage: 'You can only update your own profile' })
  validateUrl(input.websiteUrl)
  if (input.name !== undefined && (!input.name.trim() || input.name.trim().length > 80)) {
    invalid('Name is required and must be at most 80 characters')
  }
  if (input.bio !== undefined && input.bio.length > 10_000) invalid('Bio is too long')
  if (input.locale !== undefined && (input.locale.length < 2 || input.locale.length > 20)) invalid('Locale is invalid')
  if (input.timezone !== undefined && (input.timezone.length < 1 || input.timezone.length > 64)) invalid('Timezone is invalid')
  const patch: ProfilePatch = { ...input, websiteUrl: input.websiteUrl === '' ? null : input.websiteUrl }
  if (input.name !== undefined) await updateUserRow(userId, { name: input.name.trim() })
  return upsertProfile(userId, patch)
}

export async function changePassword(userId: number, currentPassword: string, newPassword: string, currentTokenHash?: string): Promise<void> {
  if (newPassword.length < 8 || newPassword.length > 128) invalid('Password must be 8-128 characters')
  const user = await findUserRowById(userId)
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw createError({ statusCode: 422, statusMessage: 'Current password is incorrect' })
  }
  await updateUserRow(userId, { passwordHash: await hashPassword(newPassword) })
  if (currentTokenHash) await deleteSessionsForUserExcept(userId, currentTokenHash)
  else await deleteSessionsForUser(userId)
}

export { findUserById }
