import { and, eq, gt, isNull, lt } from 'drizzle-orm'
import { getDb } from './db.server'
import { passwordResetTokens, sessions, users } from './schema/users'
import type { UserRecord } from '#shared/schemas/user'
import type { UserRow } from './user.repository'

export interface AuthenticatedSession {
  session: typeof sessions.$inferSelect
  user: UserRow
}

function toRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as UserRecord['role'],
    status: row.status as UserRecord['status'],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  }
}

export async function createSession(input: {
  tokenHash: string
  userId: number
  expiresAt: Date
}): Promise<void> {
  await getDb().insert(sessions).values(input)
}

export async function findActiveSession(
  tokenHash: string
): Promise<AuthenticatedSession | undefined> {
  const rows = await getDb()
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())))
    .limit(1)
  return rows[0]
}

export async function deleteSession(tokenHash: string): Promise<void> {
  await getDb().delete(sessions).where(eq(sessions.tokenHash, tokenHash))
}

export async function deleteSessionsForUser(userId: number): Promise<void> {
  await getDb().delete(sessions).where(eq(sessions.userId, userId))
}

export async function deleteExpiredSessions(): Promise<number> {
  const result = await getDb().delete(sessions).where(lt(sessions.expiresAt, new Date()))
  return result[0]?.affectedRows ?? 0
}

/* ---------------- password reset tokens ---------------- */

export async function createResetToken(input: {
  tokenHash: string
  userId: number
  expiresAt: Date
}): Promise<void> {
  await getDb().insert(passwordResetTokens).values(input)
}

export async function findUsableResetToken(
  tokenHash: string
): Promise<typeof passwordResetTokens.$inferSelect | undefined> {
  const rows = await getDb()
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date())
      )
    )
    .limit(1)
  return rows[0]
}

export async function markResetTokenUsed(id: number): Promise<void> {
  await getDb()
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.id, id))
}

export function sessionUserRecord(row: UserRow): UserRecord {
  return toRecord(row)
}
