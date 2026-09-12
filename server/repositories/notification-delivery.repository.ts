import { and, eq, lte } from 'drizzle-orm'
import { getDb } from './db.server'
import { eventOutbox, notificationChannels, notificationDeliveries } from './schema/notifications'

export type DeliveryRow = typeof notificationDeliveries.$inferSelect
export type ChannelRow = typeof notificationChannels.$inferSelect
export type OutboxRow = typeof eventOutbox.$inferSelect
export async function findDelivery(id: number): Promise<DeliveryRow | undefined> {
  const [row] = await getDb().select().from(notificationDeliveries).where(eq(notificationDeliveries.id, id)).limit(1)
  return row
}
export async function findDeliveryContext(delivery: DeliveryRow): Promise<{ channel?: ChannelRow, outbox?: OutboxRow }> {
  const [channel] = await getDb().select().from(notificationChannels).where(eq(notificationChannels.id, delivery.channelId)).limit(1)
  const [outbox] = await getDb().select().from(eventOutbox).where(eq(eventOutbox.id, delivery.outboxId)).limit(1)
  return { channel, outbox }
}
export async function updateDelivery(id: number, patch: Partial<DeliveryRow>): Promise<void> {
  await getDb().update(notificationDeliveries).set(patch).where(eq(notificationDeliveries.id, id))
}
export async function listDueDeliveries(now: Date): Promise<Array<{ id: number }>> {
  return getDb().select({ id: notificationDeliveries.id }).from(notificationDeliveries).where(and(eq(notificationDeliveries.status, 'failed'), lte(notificationDeliveries.nextRetryAt, now))).limit(50)
}
export async function insertDelivery(input: { outboxId: number, subscriptionId: number, channelId: number, provider: string }): Promise<number> {
  const [row] = await getDb().insert(notificationDeliveries).values({ ...input, status: 'pending' })
  if (!row) throw new Error('delivery insert returned no id')
  return row.insertId
}
export async function listPendingDeliveries(outboxId: number): Promise<Array<{ id: number }>> {
  return getDb().select({ id: notificationDeliveries.id }).from(notificationDeliveries).where(and(eq(notificationDeliveries.outboxId, outboxId), eq(notificationDeliveries.status, 'pending')))
}
