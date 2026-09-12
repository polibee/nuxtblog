import { and, eq, gt } from 'drizzle-orm'
import { getDb } from './db.server'
import { eventOutbox } from './schema/notifications'

export interface OutboxInsert { eventName: string, module: string, severity: string, entityType: string | null, entityId: string | null, payloadJson: string, dedupeKey: string | null }
export async function findRecentOutbox(dedupeKey: string, since: Date): Promise<{ id: number, suppressedCount: number } | undefined> {
  const [row] = await getDb().select({ id: eventOutbox.id, suppressedCount: eventOutbox.suppressedCount }).from(eventOutbox).where(and(eq(eventOutbox.dedupeKey, dedupeKey), gt(eventOutbox.occurredAt, since))).limit(1)
  return row
}
export async function incrementOutboxSuppressed(id: number, count: number): Promise<void> {
  await getDb().update(eventOutbox).set({ suppressedCount: count }).where(eq(eventOutbox.id, id))
}
export async function insertOutbox(input: OutboxInsert): Promise<number> {
  const [row] = await getDb().insert(eventOutbox).values(input)
  if (!row) throw new Error('outbox insert returned no id')
  return row.insertId
}
export async function listPendingOutbox(): Promise<Array<{ id: number }>> {
  return getDb().select({ id: eventOutbox.id }).from(eventOutbox).where(eq(eventOutbox.status, 'pending')).orderBy(eventOutbox.id).limit(20)
}
export async function claimPendingOutbox(id: number): Promise<boolean> {
  const result = await getDb().update(eventOutbox).set({ status: 'processing' }).where(and(eq(eventOutbox.id, id), eq(eventOutbox.status, 'pending')))
  return Number((result as unknown as Array<{ affectedRows: number }>)[0]?.affectedRows ?? 0) > 0
}
export async function findOutbox(id: number): Promise<typeof eventOutbox.$inferSelect | undefined> {
  const [row] = await getDb().select().from(eventOutbox).where(eq(eventOutbox.id, id)).limit(1)
  return row
}
export async function markOutboxProcessed(id: number): Promise<void> {
  await getDb().update(eventOutbox).set({ status: 'processed', processedAt: new Date() }).where(eq(eventOutbox.id, id))
}
