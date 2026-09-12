import { and, eq, gt, isNull, lt } from 'drizzle-orm'
import { getPostgresDb } from './db-postgres.server'
import { passwordResetTokens, sessions, users } from './schema-postgres/users'
import type { UserRow } from './user.postgres.repository'

export interface AuthenticatedSession {
  session: typeof sessions.$inferSelect
  user: UserRow
}

export async function createSession(input: { tokenHash: string, userId: number, expiresAt: Date }) {
  await getPostgresDb().insert(sessions).values(input)
}

export async function findActiveSession(tokenHash: string) {
  const rows = await getPostgresDb().select({ session: sessions, user: users }).from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date()))).limit(1)
  return rows[0]
}

export async function deleteSession(tokenHash: string) {
  await getPostgresDb().delete(sessions).where(eq(sessions.tokenHash, tokenHash))
}

export async function deleteSessionsForUser(userId: number) {
  await getPostgresDb().delete(sessions).where(eq(sessions.userId, userId))
}

export async function deleteExpiredSessions() {
  const result = await getPostgresDb().delete(sessions).where(lt(sessions.expiresAt, new Date()))
  return result.rowCount ?? 0
}

export async function createResetToken(input: { tokenHash: string, userId: number, expiresAt: Date }) {
  await getPostgresDb().insert(passwordResetTokens).values(input)
}

export async function findUsableResetToken(tokenHash: string) {
  const rows = await getPostgresDb().select().from(passwordResetTokens)
    .where(and(eq(passwordResetTokens.tokenHash, tokenHash), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, new Date()))).limit(1)
  return rows[0]
}

export async function markResetTokenUsed(id: number) {
  await getPostgresDb().update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, id))
}
