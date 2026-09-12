import { and, eq, gt } from 'drizzle-orm'
import { getPostgresDb } from './db-postgres.server'
import { eventOutbox } from './schema-postgres/notifications'
import type { OutboxInsert } from './notification-outbox.repository'

export async function findRecentOutbox(dedupeKey: string, since: Date) {
  const [row] = await getPostgresDb().select({ id: eventOutbox.id, suppressedCount: eventOutbox.suppressedCount }).from(eventOutbox).where(and(eq(eventOutbox.dedupeKey, dedupeKey), gt(eventOutbox.occurredAt, since))).limit(1)
  return row
}
export async function incrementOutboxSuppressed(id: number, count: number): Promise<void> {
  await getPostgresDb().update(eventOutbox).set({ suppressedCount: count }).where(eq(eventOutbox.id, id))
}
export async function insertOutbox(input: OutboxInsert): Promise<number> {
  const [row] = await getPostgresDb().insert(eventOutbox).values(input).returning({ id: eventOutbox.id })
  if (!row) throw new Error('outbox insert returned no id')
  return row.id
}
export async function listPendingOutbox() {
  return getPostgresDb().select({ id: eventOutbox.id }).from(eventOutbox).where(eq(eventOutbox.status, 'pending')).orderBy(eventOutbox.id).limit(20)
}
export async function claimPendingOutbox(id: number): Promise<boolean> {
  const rows = await getPostgresDb().update(eventOutbox).set({ status: 'processing' }).where(and(eq(eventOutbox.id, id), eq(eventOutbox.status, 'pending'))).returning({ id: eventOutbox.id })
  return rows.length > 0
}
export async function findOutbox(id: number) {
  const [row] = await getPostgresDb().select().from(eventOutbox).where(eq(eventOutbox.id, id)).limit(1)
  return row
}
export async function markOutboxProcessed(id: number): Promise<void> {
  await getPostgresDb().update(eventOutbox).set({ status: 'processed', processedAt: new Date() }).where(eq(eventOutbox.id, id))
}
