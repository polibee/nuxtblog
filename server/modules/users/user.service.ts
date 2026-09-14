import { createError } from 'h3'
import {
  userCreateSchema,
  userUpdateSchema,
  type UserCreateInput,
  type UserRecord,
  type UserUpdateInput
} from '#shared/schemas/user'
import { isDomainDbReady } from '../../repositories/domain-status'
import { deleteSessionsForUser } from '../../repositories/session.runtime.repository'
import {
  countUsers,
  countUsersByRoleAndStatus,
  deleteUserRow,
  emailExists,
  findUserById,
  findUserRowById,
  insertUser,
  listUsers,
  updateUserRow
} from '../../repositories/user.runtime.repository'
import { hashPassword } from '../../utils/password'
import { grantBadge, revokeBadge } from '../../repositories/badge.repository'
import { demoAccountEmail, isDemoAccountEnabled } from '../../utils/demo-account'

/* User domain service (P01): validation, uniqueness, password
   hashing and the "never remove the last active admin" invariant. */

function invalid(message?: string): never {
  throw createError({ statusCode: 422, statusMessage: message ?? 'Invalid input' })
}

async function assertNotLastAdmin(targetId: number, nextRole?: string, nextStatus?: string): Promise<void> {
  const target = await findUserRowById(targetId)
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: `User #${targetId} not found` })
  }
  const staysAdmin = nextRole ? nextRole === 'admin' : target.role === 'admin'
  const staysActive = nextStatus ? nextStatus === 'active' : target.status === 'active'
  if (target.role === 'admin' && (!staysAdmin || !staysActive)) {
    const activeAdmins = await countUsersByRoleAndStatus('admin', 'active')
    if (activeAdmins <= 1) {
      throw createError({ statusCode: 409, statusMessage: 'Cannot remove the last active admin' })
    }
  }
}

export async function createUser(body: unknown): Promise<UserRecord> {
  if (!isDomainDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  const result = userCreateSchema.safeParse(body)
  if (!result.success) invalid(result.error.issues[0]?.message)
  const input: UserCreateInput = result.data
  if (await emailExists(input.email)) {
    throw createError({ statusCode: 409, statusMessage: 'Email already exists' })
  }
  const record = await insertUser({
    email: input.email,
    name: input.name,
    role: input.role ?? 'viewer',
    status: input.status ?? 'active',
    passwordHash: await hashPassword(input.password)
  })
  const { notifyWelcome } = await import('../notify/notify.service')
  void notifyWelcome(input.email, input.name)
  return record
}

export async function updateUser(id: number, body: unknown): Promise<UserRecord> {
  const result = userUpdateSchema.safeParse(body)
  if (!result.success) invalid(result.error.issues[0]?.message)
  const input: UserUpdateInput = result.data
  if (input.email && await emailExists(input.email, id)) {
    throw createError({ statusCode: 409, statusMessage: 'Email already exists' })
  }
  if (input.role || input.status) {
    await assertNotLastAdmin(id, input.role, input.status)
  }
  const patch: Parameters<typeof updateUserRow>[1] = {}
  if (input.email) patch.email = input.email
  if (input.name) patch.name = input.name
  if (input.role) patch.role = input.role
  if (input.status) patch.status = input.status
  if (input.password) {
    patch.passwordHash = await hashPassword(input.password)
    await deleteSessionsForUser(id)
  }
  if (Object.keys(patch).length > 0) {
    await updateUserRow(id, patch)
  }
  if (input.badgeKey && input.badgeAction === 'grant') {
    await grantBadge({ userId: id, badgeKey: input.badgeKey, sourceType: 'admin' })
  } else if (input.badgeKey && input.badgeAction === 'revoke') {
    await revokeBadge(id, input.badgeKey)
  }
  const updated = await findUserById(id)
  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: `User #${id} not found` })
  }
  return updated
}

export async function deleteUser(id: number, currentUserId: number): Promise<void> {
  if (id === currentUserId) {
    throw createError({ statusCode: 409, statusMessage: 'Cannot delete your own account' })
  }
  await assertNotLastAdmin(id)
  await deleteUserRow(id)
}

export async function getUser(id: number): Promise<UserRecord> {
  const user = await findUserById(id)
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: `User #${id} not found` })
  }
  return user
}

export { listUsers }

/** boot seed: first admin account when the users table is empty */
export async function seedInitialAdmin(): Promise<void> {
  if (!isDomainDbReady()) return
  if ((await countUsers()) > 0) return
  const email = (process.env.BLOG_ADMIN_EMAIL ?? 'admin@example.com').toLowerCase()
  const password = process.env.BLOG_ADMIN_PASSWORD ?? 'admin123456'
  await insertUser({
    email,
    name: process.env.BLOG_ADMIN_NAME ?? 'Administrator',
    role: 'admin',
    status: 'active',
    passwordHash: await hashPassword(password)
  })
  console.log(`[blog-db] seeded initial admin ${email}`)
}

/** Seed the public demo account without changing an existing account. */
export async function seedDemoAccount(): Promise<void> {
  if (!isDomainDbReady() || !isDemoAccountEnabled()) return
  const email = demoAccountEmail()
  if (await emailExists(email)) return
  const password = process.env.DEMO_ACCOUNT_PASSWORD ?? 'demo123456'
  const name = process.env.DEMO_ACCOUNT_NAME ?? 'Demo Visitor'
  await insertUser({
    email,
    name,
    role: 'viewer',
    status: 'active',
    passwordHash: await hashPassword(password)
  })
  console.log(`[blog-db] seeded read-only demo account ${email}`)
}
